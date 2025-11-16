/**
 * Role Service - Database operations for roles
 */

import { createServiceClient } from '../../_shared/supabase.ts';
import { DatabaseError, NotFoundError } from '../../_shared/error.ts';

export class RoleService {
  /**
   * Get all roles
   */
  static async getAll(): Promise<Record<string, unknown>[]> {
    const supabase = createServiceClient();
    
    const { data, error } = await supabase
      .from('roles')
      .select(`
        *,
        department:departments(*)
      `)
      .order('level');
    
    if (error) throw new DatabaseError(error.message);
    
    return data || [];
  }

  /**
   * Get single role by ID
   */
  static async getById(id: string): Promise<Record<string, unknown>> {
    const supabase = createServiceClient();
    
    const { data, error } = await supabase
      .from('roles')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        throw new NotFoundError('ไม่พบบทบาท');
      }
      throw new DatabaseError(error.message);
    }
    
    return data;
  }

  /**
   * Create new role
   */
  static async create(data: Record<string, unknown>): Promise<Record<string, unknown>> {
    const supabase = createServiceClient();
    
    const { data: role, error } = await supabase
      .from('roles')
      .insert([data])
      .select()
      .single();
    
    if (error) throw new DatabaseError(error.message);
    
    return role;
  }

  /**
   * Update existing role
   */
  static async update(id: string, data: Record<string, unknown>): Promise<Record<string, unknown>> {
    const supabase = createServiceClient();
    
    // Check if role exists first
    const { data: existingRole, error: checkError } = await supabase
      .from('roles')
      .select('id')
      .eq('id', id)
      .single();
    
    if (checkError) {
      if (checkError.code === 'PGRST116') {
        throw new NotFoundError('ไม่พบบทบาท');
      }
      throw new DatabaseError(checkError.message);
    }
    
    // If no fields to update, return existing role
    if (Object.keys(data).length === 0) {
      return await this.getById(id);
    }
    
    const { data: role, error } = await supabase
      .from('roles')
      .update(data)
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        throw new NotFoundError('ไม่พบบทบาท');
      }
      throw new DatabaseError(error.message);
    }
    
    if (!role) {
      throw new NotFoundError('ไม่พบบทบาท');
    }
    
    return role;
  }

  /**
   * Delete role
   */
  static async delete(id: string): Promise<void> {
    const supabase = createServiceClient();
    
    const { error } = await supabase
      .from('roles')
      .delete()
      .eq('id', id);
    
    if (error) throw new DatabaseError(error.message);
  }
}

