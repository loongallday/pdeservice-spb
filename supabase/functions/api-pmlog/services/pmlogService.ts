/**
 * PM Log service - Business logic for PM log operations
 */

import { createServiceClient } from '../_shared/supabase.ts';
import { NotFoundError, DatabaseError, ValidationError } from '../_shared/error.ts';
import { calculatePagination } from '../_shared/response.ts';
import { sanitizeData } from '../_shared/sanitize.ts';
import type { PaginationInfo } from '../_shared/response.ts';

export interface PMLogQueryParams {
  page: number;
  limit: number;
  merchandiseId?: string;
}

export class PMLogService {
  /**
   * Sanitize PM log data based on actual schema
   */
  private static sanitizePMLogData(data: Record<string, unknown>): Record<string, unknown> {
    const validFields = [
      'merchandise_id',
      'description',
      'performed_at',
      'performed_by',
    ];
    return sanitizeData(data, validFields);
  }

  /**
   * Get all PM logs with pagination
   */
  static async getAll(params: PMLogQueryParams): Promise<{
    data: Record<string, unknown>[];
    pagination: PaginationInfo;
  }> {
    const supabase = createServiceClient();
    const { page, limit, merchandiseId } = params;

    // Build query
    let countQuery = supabase
      .from('pmlog')
      .select('*', { count: 'exact', head: true });

    let dataQuery = supabase
      .from('pmlog')
      .select(`
        *,
        merchandise:merchandise!pmlog_merchandise_id_fkey (
          id,
          serial_no
        ),
        performer:employees!pmlog_performed_by_fkey (
          id,
          name,
          nickname
        )
      `);

    // Apply filters
    if (merchandiseId) {
      countQuery = countQuery.eq('merchandise_id', merchandiseId);
      dataQuery = dataQuery.eq('merchandise_id', merchandiseId);
    }

    // Get total count
    const { count, error: countError } = await countQuery;

    if (countError) {
      console.error('[PMLogService] Count error:', countError);
      throw new DatabaseError(countError.message);
    }

    const total = count || 0;

    // Get paginated data
    const offset = (page - 1) * limit;
    const { data, error } = await dataQuery
      .range(offset, offset + limit - 1)
      .order('performed_at', { ascending: false });

    if (error) {
      console.error('[PMLogService] Query error:', error);
      throw new DatabaseError(error.message);
    }

    const pagination = calculatePagination(page, limit, total);

    return { data, pagination };
  }

  /**
   * Get single PM log by ID
   */
  static async getById(id: string): Promise<Record<string, unknown>> {
    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from('pmlog')
      .select(`
        *,
        merchandise:merchandise!pmlog_merchandise_id_fkey (
          id,
          serial_no
        ),
        performer:employees!pmlog_performed_by_fkey (
          id,
          name,
          nickname
        )
      `)
      .eq('id', id)
      .single();

    if (error) {
      console.error('[PMLogService] GetById error:', error);
      throw new DatabaseError(error.message);
    }

    if (!data) {
      throw new NotFoundError('ไม่พบข้อมูล');
    }

    return data;
  }

  /**
   * Get PM logs by merchandise
   */
  static async getByMerchandise(merchandiseId: string, params: { page: number; limit: number }): Promise<{
    data: Record<string, unknown>[];
    pagination: PaginationInfo;
  }> {
    return this.getAll({ ...params, merchandiseId });
  }

  /**
   * Create new PM log
   */
  static async create(pmlogData: Record<string, unknown>): Promise<Record<string, unknown>> {
    const supabase = createServiceClient();
    const sanitized = this.sanitizePMLogData(pmlogData);

    // Validate required fields
    if (!sanitized.merchandise_id) {
      throw new ValidationError('กรุณาระบุ merchandise');
    }

    // Check if merchandise exists
    const { data: merchandise, error: merchError } = await supabase
      .from('merchandise')
      .select('id')
      .eq('id', sanitized.merchandise_id)
      .single();

    if (merchError || !merchandise) {
      throw new NotFoundError('ไม่พบ merchandise ที่ระบุ');
    }

    // Set default performed_at if not provided
    if (!sanitized.performed_at) {
      sanitized.performed_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('pmlog')
      .insert(sanitized)
      .select(`
        *,
        merchandise:merchandise!pmlog_merchandise_id_fkey (
          id,
          serial_no
        ),
        performer:employees!pmlog_performed_by_fkey (
          id,
          name,
          nickname
        )
      `)
      .single();

    if (error) {
      console.error('[PMLogService] Create error:', error);
      throw new DatabaseError(error.message || 'ไม่สามารถสร้างข้อมูลได้');
    }

    return data;
  }

  /**
   * Update PM log
   */
  static async update(id: string, pmlogData: Record<string, unknown>): Promise<Record<string, unknown>> {
    const supabase = createServiceClient();
    const sanitized = this.sanitizePMLogData(pmlogData);

    // Check if exists first
    await this.getById(id);

    // If updating merchandise_id, check if merchandise exists
    if (sanitized.merchandise_id) {
      const { data: merchandise, error: merchError } = await supabase
        .from('merchandise')
        .select('id')
        .eq('id', sanitized.merchandise_id)
        .single();

      if (merchError || !merchandise) {
        throw new NotFoundError('ไม่พบ merchandise ที่ระบุ');
      }
    }

    const { data, error } = await supabase
      .from('pmlog')
      .update(sanitized)
      .eq('id', id)
      .select(`
        *,
        merchandise:merchandise!pmlog_merchandise_id_fkey (
          id,
          serial_no
        ),
        performer:employees!pmlog_performed_by_fkey (
          id,
          name,
          nickname
        )
      `)
      .single();

    if (error) {
      console.error('[PMLogService] Update error:', error);
      throw new DatabaseError(error.message || 'ไม่สามารถอัพเดทข้อมูลได้');
    }

    if (!data) {
      throw new NotFoundError('ไม่พบข้อมูล');
    }

    return data;
  }

  /**
   * Delete PM log
   */
  static async delete(id: string): Promise<void> {
    const supabase = createServiceClient();

    // Check if exists first
    await this.getById(id);

    const { error } = await supabase
      .from('pmlog')
      .delete()
      .eq('id', id);

    if (error) {
      throw new DatabaseError('ไม่สามารถลบข้อมูลได้');
    }
  }
}

