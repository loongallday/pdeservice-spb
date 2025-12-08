/**
 * Employee-site training service - Business logic for training assignments
 */

import { createServiceClient } from '../_shared/supabase.ts';
import { NotFoundError, DatabaseError, ValidationError } from '../_shared/error.ts';
import { calculatePagination } from '../_shared/response.ts';
import { sanitizeData } from '../_shared/sanitize.ts';
import type { PaginationInfo } from '../_shared/response.ts';

export interface EmployeeSiteTrainingQueryParams {
  page: number;
  limit: number;
  employeeId?: string;
  siteId?: string;
}

export class EmployeeSiteTrainingService {
  /**
   * Allow only valid columns for insert/update
   */
  private static sanitizeTrainingData(data: Record<string, unknown>): Record<string, unknown> {
    const validFields = ['employee_id', 'site_id', 'trained_at'];
    return sanitizeData(data, validFields);
  }

  /**
   * Get all training records with pagination and optional filters
   */
  static async getAll(params: EmployeeSiteTrainingQueryParams): Promise<{
    data: Record<string, unknown>[];
    pagination: PaginationInfo;
  }> {
    const supabase = createServiceClient();
    const { page, limit, employeeId, siteId } = params;

    const offset = (page - 1) * limit;

    let query = supabase
      .from('employee_site_trainings')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (employeeId) {
      query = query.eq('employee_id', employeeId);
    }

    if (siteId) {
      query = query.eq('site_id', siteId);
    }

    const { data, error, count } = await query.range(offset, offset + limit - 1);

    if (error) {
      throw new DatabaseError('ไม่สามารถดึงข้อมูลได้');
    }

    const total = count ?? 0;
    const pagination = calculatePagination(page, limit, total);

    return { data: data ?? [], pagination };
  }

  /**
   * Get single training record by ID
   */
  static async getById(id: string): Promise<Record<string, unknown>> {
    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from('employee_site_trainings')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      throw new DatabaseError('ไม่สามารถดึงข้อมูลได้');
    }

    if (!data) {
      throw new NotFoundError('ไม่พบข้อมูล');
    }

    return data;
  }

  /**
   * Create new training record
   */
  static async create(trainingData: Record<string, unknown>): Promise<Record<string, unknown>> {
    const supabase = createServiceClient();
    const sanitized = this.sanitizeTrainingData(trainingData);

    const { data, error } = await supabase
      .from('employee_site_trainings')
      .insert(sanitized)
      .select()
      .single();

    if (error) {
      if (error.message?.includes('duplicate key')) {
        throw new ValidationError('พนักงานถูกบันทึกการอบรมกับไซต์นี้แล้ว');
      }
      throw new DatabaseError('ไม่สามารถสร้างข้อมูลได้');
    }

    return data;
  }

  /**
   * Update existing training record
   */
  static async update(id: string, trainingData: Record<string, unknown>): Promise<Record<string, unknown>> {
    const supabase = createServiceClient();
    const sanitized = this.sanitizeTrainingData(trainingData);

    if (Object.keys(sanitized).length === 0) {
      throw new ValidationError('ไม่มีข้อมูลที่ต้องการอัปเดต');
    }

    const { data, error } = await supabase
      .from('employee_site_trainings')
      .update(sanitized)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.message?.includes('duplicate key')) {
        throw new ValidationError('พนักงานถูกบันทึกการอบรมกับไซต์นี้แล้ว');
      }
      throw new DatabaseError('ไม่สามารถอัปเดตข้อมูลได้');
    }

    if (!data) {
      throw new NotFoundError('ไม่พบข้อมูล');
    }

    return data;
  }
}

