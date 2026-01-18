/**
 * Stock Item Service
 * Fast operations for stock items with optimized queries
 */

import { createServiceClient } from '../../_shared/supabase.ts';
import { NotFoundError, DatabaseError } from '../../_shared/error.ts';
import type { StockItem, LowStockItem } from '../types.ts';

const ITEM_SELECT = `
  id, location_id, model_id, quantity, minimum_quantity, reserved_quantity, created_at, updated_at,
  location:main_stock_locations(id, name, code),
  model:main_models(id, model, name, name_th, name_en, category, unit)
`;

const ITEM_LIST_SELECT = `
  id, location_id, model_id, quantity, minimum_quantity, reserved_quantity,
  model:main_models(id, model, name_th, unit)
`;

export async function listItems(filters?: {
  location_id?: string;
  model_id?: string;
  page?: number;
  limit?: number;
}): Promise<{ items: StockItem[]; total: number }> {
  const supabase = createServiceClient();
  const page = filters?.page || 1;
  const limit = filters?.limit || 20;
  const offset = (page - 1) * limit;

  let query = supabase
    .from('main_stock_items')
    .select(ITEM_LIST_SELECT, { count: 'exact' });

  if (filters?.location_id) {
    query = query.eq('location_id', filters.location_id);
  }
  if (filters?.model_id) {
    query = query.eq('model_id', filters.model_id);
  }

  const { data, count, error } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new DatabaseError(`Failed to list items: ${error.message}`);
  }

  // Add computed available_quantity
  const items = (data || []).map(item => ({
    ...item,
    available_quantity: item.quantity - item.reserved_quantity,
  })) as StockItem[];

  return { items, total: count || 0 };
}

export async function getItemById(id: string): Promise<StockItem> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('main_stock_items')
    .select(ITEM_SELECT)
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      throw new NotFoundError('ไม่พบรายการสต็อก');
    }
    throw new DatabaseError(`Failed to get item: ${error.message}`);
  }

  return {
    ...data,
    available_quantity: data.quantity - data.reserved_quantity,
  } as StockItem;
}

export async function getItemsByLocation(locationId: string): Promise<StockItem[]> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('main_stock_items')
    .select(ITEM_LIST_SELECT)
    .eq('location_id', locationId)
    .order('model(name_th)');

  if (error) {
    throw new DatabaseError(`Failed to get items by location: ${error.message}`);
  }

  return (data || []).map(item => ({
    ...item,
    available_quantity: item.quantity - item.reserved_quantity,
  })) as StockItem[];
}

export async function searchItems(query: string, limit = 20): Promise<StockItem[]> {
  const supabase = createServiceClient();

  // Search by model code or name
  const { data, error } = await supabase
    .from('main_stock_items')
    .select(`
      id, location_id, model_id, quantity, minimum_quantity, reserved_quantity,
      location:main_stock_locations(id, name, code),
      model:main_models!inner(id, model, name_th, unit)
    `)
    .or(`model.ilike.%${query}%,name_th.ilike.%${query}%`, { referencedTable: 'main_models' })
    .limit(limit);

  if (error) {
    throw new DatabaseError(`Failed to search items: ${error.message}`);
  }

  return (data || []).map(item => ({
    ...item,
    available_quantity: item.quantity - item.reserved_quantity,
  })) as StockItem[];
}

export async function getLowStockItems(): Promise<LowStockItem[]> {
  const supabase = createServiceClient();

  // Use the optimized DB function
  const { data, error } = await supabase.rpc('get_low_stock_items');

  if (error) {
    throw new DatabaseError(`Failed to get low stock items: ${error.message}`);
  }

  return data as LowStockItem[];
}

export async function getItemByLocationAndModel(
  locationId: string,
  modelId: string
): Promise<StockItem | null> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('main_stock_items')
    .select(ITEM_SELECT)
    .eq('location_id', locationId)
    .eq('model_id', modelId)
    .maybeSingle();

  if (error) {
    throw new DatabaseError(`Failed to get item: ${error.message}`);
  }

  if (!data) return null;

  return {
    ...data,
    available_quantity: data.quantity - data.reserved_quantity,
  } as StockItem;
}
