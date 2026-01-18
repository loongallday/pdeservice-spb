/**
 * Serial Stock Service
 * Full tracking for serialized inventory items
 */

import { createServiceClient } from '../../_shared/supabase.ts';
import { NotFoundError, DatabaseError, ValidationError } from '../../_shared/error.ts';

// Types
export type SerialStatus = 'in_stock' | 'reserved' | 'deployed' | 'defective' | 'returned' | 'scrapped';
export type SerialMovementType = 'receive' | 'transfer' | 'reserve' | 'unreserve' | 'deploy' | 'return' | 'defective' | 'repair' | 'scrap' | 'adjust';

export interface SerialItem {
  id: string;
  model_id: string;
  serial_no: string;
  location_id: string | null;
  status: SerialStatus;
  ticket_id: string | null;
  site_id: string | null;
  received_at: string;
  received_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  model?: { id: string; model: string; name_th: string };
  location?: { id: string; name: string; code: string } | null;
  ticket?: { id: string; ticket_code: string } | null;
  site?: { id: string; name: string } | null;
}

export interface SerialMovement {
  id: string;
  serial_item_id: string;
  movement_type: SerialMovementType;
  from_location_id: string | null;
  to_location_id: string | null;
  from_status: SerialStatus | null;
  to_status: SerialStatus;
  ticket_id: string | null;
  performed_by: string;
  performed_at: string;
  notes: string | null;
  performer?: { id: string; name: string };
  from_location?: { id: string; name: string } | null;
  to_location?: { id: string; name: string } | null;
}

// Select statements
const SERIAL_SELECT = `
  id, model_id, serial_no, location_id, status, ticket_id, site_id,
  received_at, received_by, notes, created_at, updated_at,
  model:main_models(id, model, name_th),
  location:main_stock_locations(id, name, code),
  ticket:main_tickets(id, ticket_code),
  site:main_sites(id, name)
`;

const SERIAL_LIST_SELECT = `
  id, model_id, serial_no, location_id, status, ticket_id,
  received_at, created_at,
  model:main_models(id, model, name_th),
  location:main_stock_locations(id, name, code)
`;

const MOVEMENT_SELECT = `
  id, serial_item_id, movement_type, from_location_id, to_location_id,
  from_status, to_status, ticket_id, performed_by, performed_at, notes,
  performer:main_employees!child_stock_serial_movements_performed_by_fkey(id, name),
  from_location:main_stock_locations!child_stock_serial_movements_from_location_id_fkey(id, name),
  to_location:main_stock_locations!child_stock_serial_movements_to_location_id_fkey(id, name)
`;

/**
 * List serial items with filters
 */
export async function listSerialItems(filters?: {
  location_id?: string;
  model_id?: string;
  status?: SerialStatus;
  ticket_id?: string;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<{ data: SerialItem[]; total: number }> {
  const supabase = createServiceClient();

  let query = supabase
    .from('main_stock_serial_items')
    .select(SERIAL_LIST_SELECT, { count: 'exact' });

  if (filters?.location_id) {
    query = query.eq('location_id', filters.location_id);
  }
  if (filters?.model_id) {
    query = query.eq('model_id', filters.model_id);
  }
  if (filters?.status) {
    query = query.eq('status', filters.status);
  }
  if (filters?.ticket_id) {
    query = query.eq('ticket_id', filters.ticket_id);
  }
  if (filters?.search) {
    query = query.ilike('serial_no', `%${filters.search}%`);
  }

  query = query.order('created_at', { ascending: false });

  if (filters?.limit) {
    query = query.limit(filters.limit);
  }
  if (filters?.offset) {
    query = query.range(filters.offset, filters.offset + (filters.limit || 20) - 1);
  }

  const { data, error, count } = await query;

  if (error) {
    throw new DatabaseError(`Failed to list serial items: ${error.message}`);
  }

  return { data: data as SerialItem[], total: count || 0 };
}

/**
 * Get serial item by ID
 */
export async function getSerialItemById(id: string): Promise<SerialItem> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('main_stock_serial_items')
    .select(SERIAL_SELECT)
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      throw new NotFoundError('ไม่พบรายการสินค้า');
    }
    throw new DatabaseError(`Failed to get serial item: ${error.message}`);
  }

  return data as SerialItem;
}

/**
 * Get serial item by serial number
 */
export async function getSerialItemBySerialNo(serialNo: string): Promise<SerialItem> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('main_stock_serial_items')
    .select(SERIAL_SELECT)
    .eq('serial_no', serialNo)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      throw new NotFoundError(`ไม่พบสินค้าหมายเลข: ${serialNo}`);
    }
    throw new DatabaseError(`Failed to get serial item: ${error.message}`);
  }

  return data as SerialItem;
}

/**
 * Search serial items by serial number (partial match)
 */
export async function searchSerialItems(
  query: string,
  limit: number = 20
): Promise<SerialItem[]> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('main_stock_serial_items')
    .select(SERIAL_LIST_SELECT)
    .ilike('serial_no', `%${query}%`)
    .limit(limit);

  if (error) {
    throw new DatabaseError(`Failed to search serial items: ${error.message}`);
  }

  return data as SerialItem[];
}

/**
 * Receive new serialized items into inventory
 */
export async function receiveSerialItems(input: {
  items: Array<{
    model_id: string;
    serial_no: string;
    notes?: string;
  }>;
  location_id: string;
  received_by: string;
}): Promise<{ received: SerialItem[]; failed: Array<{ serial_no: string; error: string }> }> {
  const supabase = createServiceClient();
  const received: SerialItem[] = [];
  const failed: Array<{ serial_no: string; error: string }> = [];

  // Collect unique model IDs and validate they require serial tracking
  const modelIds = [...new Set(input.items.map(i => i.model_id))];
  const { data: models, error: modelError } = await supabase
    .from('main_models')
    .select('id, model, has_serial')
    .in('id', modelIds);

  if (modelError) {
    throw new DatabaseError(`Failed to validate models: ${modelError.message}`);
  }

  const modelMap = new Map(models?.map(m => [m.id, m]) || []);

  // Validate all models require serial tracking
  for (const modelId of modelIds) {
    const model = modelMap.get(modelId);
    if (!model) {
      throw new ValidationError(`ไม่พบสินค้ารหัส ${modelId}`);
    }
    if (!model.has_serial) {
      throw new ValidationError(`สินค้า "${model.model}" ไม่ต้องการซีเรียล กรุณาใช้หน้ารับสต็อกแบบจำนวน`);
    }
  }

  for (const item of input.items) {
    // Check if serial already exists
    const { data: existing } = await supabase
      .from('main_stock_serial_items')
      .select('id')
      .eq('serial_no', item.serial_no)
      .eq('model_id', item.model_id)
      .single();

    if (existing) {
      failed.push({ serial_no: item.serial_no, error: 'หมายเลขซีเรียลนี้มีอยู่แล้ว' });
      continue;
    }

    // Create serial item
    const { data: newItem, error: insertError } = await supabase
      .from('main_stock_serial_items')
      .insert({
        model_id: item.model_id,
        serial_no: item.serial_no,
        location_id: input.location_id,
        status: 'in_stock',
        received_at: new Date().toISOString(),
        received_by: input.received_by,
        notes: item.notes || null,
      })
      .select(SERIAL_SELECT)
      .single();

    if (insertError) {
      failed.push({ serial_no: item.serial_no, error: insertError.message });
      continue;
    }

    // Record movement
    await supabase.from('child_stock_serial_movements').insert({
      serial_item_id: newItem.id,
      movement_type: 'receive',
      to_location_id: input.location_id,
      to_status: 'in_stock',
      performed_by: input.received_by,
      notes: item.notes || null,
    });

    received.push(newItem as SerialItem);
  }

  return { received, failed };
}

/**
 * Transfer serial item to another location
 */
export async function transferSerialItem(input: {
  serial_item_id: string;
  to_location_id: string;
  performed_by: string;
  notes?: string;
}): Promise<SerialItem> {
  const supabase = createServiceClient();

  // Get current item
  const item = await getSerialItemById(input.serial_item_id);

  if (item.status !== 'in_stock' && item.status !== 'returned') {
    throw new ValidationError(`ไม่สามารถโอนย้ายสินค้าที่มีสถานะ "${item.status}" ได้`);
  }

  // Update location
  const { data: updated, error } = await supabase
    .from('main_stock_serial_items')
    .update({
      location_id: input.to_location_id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.serial_item_id)
    .select(SERIAL_SELECT)
    .single();

  if (error) {
    throw new DatabaseError(`Failed to transfer: ${error.message}`);
  }

  // Record movement
  await supabase.from('child_stock_serial_movements').insert({
    serial_item_id: input.serial_item_id,
    movement_type: 'transfer',
    from_location_id: item.location_id,
    to_location_id: input.to_location_id,
    from_status: item.status,
    to_status: item.status,
    performed_by: input.performed_by,
    notes: input.notes || null,
  });

  return updated as SerialItem;
}

/**
 * Deploy serial item to ticket/site
 */
export async function deploySerialItem(input: {
  serial_item_id: string;
  ticket_id: string;
  site_id?: string;
  performed_by: string;
  notes?: string;
}): Promise<SerialItem> {
  const supabase = createServiceClient();

  // Get current item
  const item = await getSerialItemById(input.serial_item_id);

  if (item.status !== 'in_stock' && item.status !== 'reserved') {
    throw new ValidationError(`ไม่สามารถติดตั้งสินค้าที่มีสถานะ "${item.status}" ได้`);
  }

  // Update item
  const { data: updated, error } = await supabase
    .from('main_stock_serial_items')
    .update({
      status: 'deployed',
      location_id: null,
      ticket_id: input.ticket_id,
      site_id: input.site_id || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.serial_item_id)
    .select(SERIAL_SELECT)
    .single();

  if (error) {
    throw new DatabaseError(`Failed to deploy: ${error.message}`);
  }

  // Record movement
  await supabase.from('child_stock_serial_movements').insert({
    serial_item_id: input.serial_item_id,
    movement_type: 'deploy',
    from_location_id: item.location_id,
    from_status: item.status,
    to_status: 'deployed',
    ticket_id: input.ticket_id,
    performed_by: input.performed_by,
    notes: input.notes || null,
  });

  return updated as SerialItem;
}

/**
 * Return serial item from deployment
 */
export async function returnSerialItem(input: {
  serial_item_id: string;
  to_location_id: string;
  performed_by: string;
  notes?: string;
}): Promise<SerialItem> {
  const supabase = createServiceClient();

  // Get current item
  const item = await getSerialItemById(input.serial_item_id);

  if (item.status !== 'deployed') {
    throw new ValidationError('สินค้านี้ไม่ได้อยู่ในสถานะติดตั้ง');
  }

  // Update item
  const { data: updated, error } = await supabase
    .from('main_stock_serial_items')
    .update({
      status: 'returned',
      location_id: input.to_location_id,
      ticket_id: null,
      site_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.serial_item_id)
    .select(SERIAL_SELECT)
    .single();

  if (error) {
    throw new DatabaseError(`Failed to return: ${error.message}`);
  }

  // Record movement
  await supabase.from('child_stock_serial_movements').insert({
    serial_item_id: input.serial_item_id,
    movement_type: 'return',
    to_location_id: input.to_location_id,
    from_status: 'deployed',
    to_status: 'returned',
    ticket_id: item.ticket_id,
    performed_by: input.performed_by,
    notes: input.notes || null,
  });

  return updated as SerialItem;
}

/**
 * Mark serial item as defective
 */
export async function markDefective(input: {
  serial_item_id: string;
  performed_by: string;
  notes?: string;
}): Promise<SerialItem> {
  const supabase = createServiceClient();

  // Get current item
  const item = await getSerialItemById(input.serial_item_id);

  // Update item
  const { data: updated, error } = await supabase
    .from('main_stock_serial_items')
    .update({
      status: 'defective',
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.serial_item_id)
    .select(SERIAL_SELECT)
    .single();

  if (error) {
    throw new DatabaseError(`Failed to mark defective: ${error.message}`);
  }

  // Record movement
  await supabase.from('child_stock_serial_movements').insert({
    serial_item_id: input.serial_item_id,
    movement_type: 'defective',
    from_location_id: item.location_id,
    to_location_id: item.location_id,
    from_status: item.status,
    to_status: 'defective',
    performed_by: input.performed_by,
    notes: input.notes || null,
  });

  return updated as SerialItem;
}

/**
 * Update serial item status (generic)
 */
export async function updateSerialStatus(input: {
  serial_item_id: string;
  status: SerialStatus;
  location_id?: string;
  performed_by: string;
  notes?: string;
}): Promise<SerialItem> {
  const supabase = createServiceClient();

  // Get current item
  const item = await getSerialItemById(input.serial_item_id);

  const updateData: Record<string, unknown> = {
    status: input.status,
    updated_at: new Date().toISOString(),
  };

  if (input.location_id !== undefined) {
    updateData.location_id = input.location_id;
  }

  // Clear ticket/site if returning to stock
  if (input.status === 'in_stock' || input.status === 'returned') {
    updateData.ticket_id = null;
    updateData.site_id = null;
  }

  // Update item
  const { data: updated, error } = await supabase
    .from('main_stock_serial_items')
    .update(updateData)
    .eq('id', input.serial_item_id)
    .select(SERIAL_SELECT)
    .single();

  if (error) {
    throw new DatabaseError(`Failed to update status: ${error.message}`);
  }

  // Record movement
  await supabase.from('child_stock_serial_movements').insert({
    serial_item_id: input.serial_item_id,
    movement_type: 'adjust',
    from_location_id: item.location_id,
    to_location_id: input.location_id || item.location_id,
    from_status: item.status,
    to_status: input.status,
    performed_by: input.performed_by,
    notes: input.notes || null,
  });

  return updated as SerialItem;
}

/**
 * Get movement history for a serial item
 */
export async function getSerialMovements(
  serialItemId: string,
  limit: number = 50
): Promise<SerialMovement[]> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('child_stock_serial_movements')
    .select(MOVEMENT_SELECT)
    .eq('serial_item_id', serialItemId)
    .order('performed_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new DatabaseError(`Failed to get movements: ${error.message}`);
  }

  return data as SerialMovement[];
}
