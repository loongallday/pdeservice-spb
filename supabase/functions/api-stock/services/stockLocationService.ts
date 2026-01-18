/**
 * Stock Location Service
 * Fast CRUD operations for stock locations
 */

import { createServiceClient } from '../../_shared/supabase.ts';
import { NotFoundError, DatabaseError, ValidationError } from '../../_shared/error.ts';
import type { StockLocation, CreateLocationInput, UpdateLocationInput } from '../types.ts';

// UUID regex pattern
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Resolve location type ID from UUID or code
 * Accepts either: "warehouse" or "7060c10e-bd0f-4f2e-b617-1d87732fadde"
 */
async function resolveLocationTypeId(typeIdOrCode: string): Promise<string> {
  // If it's already a valid UUID, return as-is
  if (UUID_REGEX.test(typeIdOrCode)) {
    return typeIdOrCode;
  }

  // Otherwise, look up by code
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('ref_stock_location_types')
    .select('id')
    .eq('code', typeIdOrCode.toLowerCase())
    .single();

  if (error || !data) {
    throw new ValidationError(`ไม่พบประเภทตำแหน่ง: ${typeIdOrCode}`);
  }

  return data.id;
}

const LOCATION_SELECT = `
  id, name, code, location_type_id, site_id, employee_id, address, is_active, created_at, updated_at,
  location_type:ref_stock_location_types(id, code, name_th),
  site:main_sites(id, name),
  employee:main_employees(id, name)
`;

const LOCATION_LIST_SELECT = `
  id, name, code, location_type_id, site_id, employee_id, is_active, created_at,
  location_type:ref_stock_location_types(id, code, name_th)
`;

export async function listLocations(filters?: {
  type_id?: string;
  site_id?: string;
  employee_id?: string;
  is_active?: boolean;
}): Promise<StockLocation[]> {
  const supabase = createServiceClient();

  let query = supabase
    .from('main_stock_locations')
    .select(LOCATION_LIST_SELECT)
    .order('name');

  if (filters?.type_id) {
    query = query.eq('location_type_id', filters.type_id);
  }
  if (filters?.site_id) {
    query = query.eq('site_id', filters.site_id);
  }
  if (filters?.employee_id) {
    query = query.eq('employee_id', filters.employee_id);
  }
  if (filters?.is_active !== undefined) {
    query = query.eq('is_active', filters.is_active);
  }

  const { data, error } = await query;

  if (error) {
    throw new DatabaseError(`Failed to list locations: ${error.message}`);
  }

  return data as StockLocation[];
}

export async function getLocationById(id: string): Promise<StockLocation> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('main_stock_locations')
    .select(LOCATION_SELECT)
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      throw new NotFoundError('ไม่พบตำแหน่งจัดเก็บ');
    }
    throw new DatabaseError(`Failed to get location: ${error.message}`);
  }

  return data as StockLocation;
}

export async function createLocation(input: CreateLocationInput): Promise<StockLocation> {
  const supabase = createServiceClient();

  // Resolve location_type_id (accepts UUID or code like "warehouse")
  const resolvedTypeId = await resolveLocationTypeId(input.location_type_id);

  const { data, error } = await supabase
    .from('main_stock_locations')
    .insert({
      name: input.name,
      code: input.code,
      location_type_id: resolvedTypeId,
      site_id: input.site_id || null,
      employee_id: input.employee_id || null,
      address: input.address || null,
      is_active: input.is_active ?? true,
    })
    .select(LOCATION_SELECT)
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new DatabaseError('รหัสตำแหน่งซ้ำกับที่มีอยู่แล้ว');
    }
    throw new DatabaseError(`Failed to create location: ${error.message}`);
  }

  return data as StockLocation;
}

export async function updateLocation(id: string, input: UpdateLocationInput): Promise<StockLocation> {
  const supabase = createServiceClient();

  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (input.name !== undefined) updateData.name = input.name;
  if (input.code !== undefined) updateData.code = input.code;
  if (input.location_type_id !== undefined) {
    // Resolve location_type_id (accepts UUID or code like "warehouse")
    updateData.location_type_id = await resolveLocationTypeId(input.location_type_id);
  }
  if (input.site_id !== undefined) updateData.site_id = input.site_id || null;
  if (input.employee_id !== undefined) updateData.employee_id = input.employee_id || null;
  if (input.address !== undefined) updateData.address = input.address || null;
  if (input.is_active !== undefined) updateData.is_active = input.is_active;

  // Update and return basic data (no joins)
  const { data, error: updateError } = await supabase
    .from('main_stock_locations')
    .update(updateData)
    .eq('id', id)
    .select('id, name, code, location_type_id, site_id, employee_id, address, is_active, created_at, updated_at')
    .single();

  if (updateError) {
    console.error('Update location error:', JSON.stringify(updateError));
    if (updateError.code === '23505') {
      throw new DatabaseError('รหัสตำแหน่งซ้ำกับที่มีอยู่แล้ว');
    }
    if (updateError.code === 'PGRST116') {
      throw new NotFoundError('ไม่พบตำแหน่งจัดเก็บ');
    }
    throw new DatabaseError(`Failed to update location: ${updateError.message}`);
  }

  return data as StockLocation;
}

export async function deleteLocation(id: string): Promise<void> {
  const supabase = createServiceClient();

  // Check if location has stock items
  const { count } = await supabase
    .from('main_stock_items')
    .select('id', { count: 'exact', head: true })
    .eq('location_id', id);

  if (count && count > 0) {
    throw new DatabaseError('ไม่สามารถลบตำแหน่งที่มีสินค้าคงคลังได้');
  }

  const { error } = await supabase
    .from('main_stock_locations')
    .delete()
    .eq('id', id);

  if (error) {
    throw new DatabaseError(`Failed to delete location: ${error.message}`);
  }
}
