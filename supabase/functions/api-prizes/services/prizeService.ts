/**
 * Prize Service
 * Database operations for prizes and prize assignments
 */

import { createServiceClient } from '../_shared/supabase.ts';
import { NotFoundError, DatabaseError, ValidationError } from '../_shared/error.ts';
import { calculatePagination, PaginationInfo } from '../_shared/response.ts';
import { sanitizeData } from '../_shared/sanitize.ts';

// Prize type
export interface Prize {
  id: string;
  name: string;
  image_url: string | null;
  created_at: string;
}

// User Prize (assignment) type
export interface UserPrize {
  id: string;
  user_id: string;
  prize_id: string;
  created_at: string;
  updated_at: string;
  user_data?: {
    id: string;
    name: string;
    code: string | null;
    email: string | null;
  };
  prize_data?: Prize;
}

// Create prize input
export interface CreatePrizeInput {
  name: string;
  image_url?: string;
}

// Update prize input
export interface UpdatePrizeInput {
  name?: string;
  image_url?: string;
}

// Winners filter
export interface WinnersFilter {
  userId?: string;
  prizeId?: string;
}


// Valid fields for prize table
const PRIZE_VALID_FIELDS = ['name', 'image_url'];

/**
 * Sanitize prize data based on actual schema
 */
function sanitizePrizeData(data: unknown): Record<string, unknown> {
  // รองรับ input ที่เป็น object เท่านั้น
  if (typeof data !== 'object' || data === null) return {};
  return sanitizeData(data as Record<string, unknown>, PRIZE_VALID_FIELDS);
}

/**
 * Get all prizes with pagination
 */
export async function getAll(
  page: number,
  limit: number
): Promise<{ data: Prize[]; pagination: PaginationInfo }> {
  const supabase = createServiceClient();

  // Get total count
  const { count, error: countError } = await supabase
    .from('prizes')
    .select('*', { count: 'exact', head: true });

  if (countError) {
    throw new DatabaseError('ไม่สามารถดึงข้อมูลรางวัลได้');
  }

  const total = count || 0;

  // Get paginated data
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const { data, error } = await supabase
    .from('prizes')
    .select('*')
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) {
    throw new DatabaseError('ไม่สามารถดึงข้อมูลรางวัลได้');
  }

  const pagination = calculatePagination(page, limit, total);

  return { data: data as Prize[], pagination };
}

/**
 * Get prize by ID
 */
export async function getById(id: string): Promise<Prize> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('prizes')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) {
    throw new NotFoundError('ไม่พบรางวัลที่ระบุ');
  }

  return data as Prize;
}

/**
 * Create new prize
 */
export async function create(input: CreatePrizeInput): Promise<Prize> {
  const supabase = createServiceClient();

  // Sanitize input
  const sanitized = sanitizePrizeData(input);

  // Validate required fields
  if (!sanitized.name) {
    throw new ValidationError('ชื่อรางวัลจำเป็นต้องระบุ');
  }

  const { data, error } = await supabase
    .from('prizes')
    .insert(sanitized)
    .select()
    .single();

  if (error) {
    throw new DatabaseError('ไม่สามารถสร้างรางวัลได้');
  }

  return data as Prize;
}

/**
 * Update prize
 */
export async function update(id: string, input: UpdatePrizeInput): Promise<Prize> {
  const supabase = createServiceClient();

  // Check if prize exists
  await getById(id);

  // Sanitize input
  const sanitized = sanitizeData(input as Record<string, unknown>, PRIZE_VALID_FIELDS);

  // Check if there's anything to update
  if (Object.keys(sanitized).length === 0) {
    throw new ValidationError('ไม่มีข้อมูลที่ต้องการอัปเดต');
  }

  const { data, error } = await supabase
    .from('prizes')
    .update(sanitized)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new DatabaseError('ไม่สามารถอัปเดตรางวัลได้');
  }

  return data as Prize;
}

/**
 * Delete prize
 */
export async function deletePrize(id: string): Promise<void> {
  const supabase = createServiceClient();

  // Check if prize exists
  await getById(id);

  // Check if prize has been assigned to any users
  const { data: assignments } = await supabase
    .from('user_prizes')
    .select('id')
    .eq('prize_id', id)
    .limit(1);

  if (assignments && assignments.length > 0) {
    throw new ValidationError('ไม่สามารถลบรางวัลที่มีการมอบให้ผู้ใช้แล้ว');
  }

  const { error } = await supabase
    .from('prizes')
    .delete()
    .eq('id', id);

  if (error) {
    throw new DatabaseError('ไม่สามารถลบรางวัลได้');
  }
}

/**
 * Get all winners (prize assignments) with pagination and filters
 */
export async function getWinners(
  page: number,
  limit: number,
  filters: WinnersFilter = {}
): Promise<{ data: UserPrize[]; pagination: PaginationInfo }> {
  const supabase = createServiceClient();

  // Build query
  let countQuery = supabase
    .from('user_prizes')
    .select('*', { count: 'exact', head: true });

  let dataQuery = supabase
    .from('user_prizes')
    .select(`
      *,
      user_data:employees!user_id(id, name, code, email),
      prize_data:prizes!prize_id(id, name, image_url, created_at)
    `);

  // Apply filters
  if (filters.userId) {
    countQuery = countQuery.eq('user_id', filters.userId);
    dataQuery = dataQuery.eq('user_id', filters.userId);
  }

  if (filters.prizeId) {
    countQuery = countQuery.eq('prize_id', filters.prizeId);
    dataQuery = dataQuery.eq('prize_id', filters.prizeId);
  }

  // Get total count
  const { count, error: countError } = await countQuery;

  if (countError) {
    throw new DatabaseError('ไม่สามารถดึงข้อมูลผู้ได้รับรางวัลได้');
  }

  const total = count || 0;

  // Get paginated data
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const { data, error } = await dataQuery
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) {
    throw new DatabaseError('ไม่สามารถดึงข้อมูลผู้ได้รับรางวัลได้');
  }

  const pagination = calculatePagination(page, limit, total);

  return { data: data as UserPrize[], pagination };
}

/**
 * Assign prize to user
 */
export async function assignPrize(prizeId: string, userId: string): Promise<UserPrize> {
  const supabase = createServiceClient();

  // Check if prize exists
  await getById(prizeId);

  // Check if user exists
  const { data: user, error: userError } = await supabase
    .from('employees')
    .select('id')
    .eq('id', userId)
    .single();

  if (userError || !user) {
    throw new NotFoundError('ไม่พบพนักงานที่ระบุ');
  }

  // Check if user already has this prize
  const { data: existing } = await supabase
    .from('user_prizes')
    .select('id')
    .eq('user_id', userId)
    .eq('prize_id', prizeId)
    .single();

  if (existing) {
    throw new ValidationError('พนักงานคนนี้ได้รับรางวัลนี้แล้ว');
  }

  // Create assignment
  const { data, error } = await supabase
    .from('user_prizes')
    .insert({ user_id: userId, prize_id: prizeId })
    .select(`
      *,
      user_data:employees!user_id(id, name, code, email),
      prize_data:prizes!prize_id(id, name, image_url, created_at)
    `)
    .single();

  if (error) {
    throw new DatabaseError('ไม่สามารถมอบรางวัลได้');
  }

  return data as UserPrize;
}

/**
 * Unassign prize from user
 */
export async function unassignPrize(prizeId: string, userId: string): Promise<void> {
  const supabase = createServiceClient();

  // Find the assignment
  const { data: assignment, error: findError } = await supabase
    .from('user_prizes')
    .select('id')
    .eq('user_id', userId)
    .eq('prize_id', prizeId)
    .single();

  if (findError || !assignment) {
    throw new NotFoundError('ไม่พบการมอบรางวัลที่ระบุ');
  }

  // Delete assignment
  const { error } = await supabase
    .from('user_prizes')
    .delete()
    .eq('id', assignment.id);

  if (error) {
    throw new DatabaseError('ไม่สามารถยกเลิกการมอบรางวัลได้');
  }
}
