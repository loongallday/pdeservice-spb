/**
 * Department Service - Database operations for departments
 */

import { createServiceClient } from '../../_shared/supabase.ts';
import { DatabaseError, NotFoundError } from '../../_shared/error.ts';
import { sanitizeData } from '../../_shared/sanitize.ts';

export class DepartmentService {
  /**
   * Sanitize department data based on actual schema
   */
  private static sanitizeDepartmentData(data: Record<string, unknown>): Record<string, unknown> {
    const validFields = [
      'code',
      'name_th',
      'name_en',
      'description',
      'is_active',
      'head_id',
    ];
    return sanitizeData(data, validFields);
  }
  /**
   * Get all departments
   */
  static async getAll(): Promise<Record<string, unknown>[]> {
    const supabase = createServiceClient();
    
    const { data, error } = await supabase
      .from('departments')
      .select('*')
      .order('code');
    
    if (error) throw new DatabaseError(error.message);
    
    return data || [];
  }

  /**
   * Get single department by ID
   */
  static async getById(id: string): Promise<Record<string, unknown>> {
    const supabase = createServiceClient();
    
    const { data, error } = await supabase
      .from('departments')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        throw new NotFoundError('ไม่พบแผนก');
      }
      throw new DatabaseError(error.message);
    }
    
    return data;
  }

  /**
   * Create new department
   */
  static async create(data: Record<string, unknown>): Promise<Record<string, unknown>> {
    const supabase = createServiceClient();
    const sanitized = this.sanitizeDepartmentData(data);
    
    const { data: department, error } = await supabase
      .from('departments')
      .insert([sanitized])
      .select()
      .single();
    
    if (error) throw new DatabaseError(error.message);
    
    return department;
  }

  /**
   * Update existing department
   */
  static async update(id: string, data: Record<string, unknown>): Promise<Record<string, unknown>> {
    const supabase = createServiceClient();
    const sanitized = this.sanitizeDepartmentData(data);
    
    const { data: department, error } = await supabase
      .from('departments')
      .update(sanitized)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw new DatabaseError(error.message);
    
    return department;
  }

  /**
   * Delete department
   */
  static async delete(id: string): Promise<void> {
    const supabase = createServiceClient();
    
    const { error } = await supabase
      .from('departments')
      .delete()
      .eq('id', id);
    
    if (error) throw new DatabaseError(error.message);
  }
}

