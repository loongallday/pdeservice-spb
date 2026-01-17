/**
 * LINE Account Service - Manage LINE user ID to employee mappings
 */

import { createServiceClient } from '../../_shared/supabase.ts';
import { NotFoundError, DatabaseError, ValidationError } from '../../_shared/error.ts';
import type { LineAccount, CreateLineAccountInput } from '../types.ts';

export class LineAccountService {
  /**
   * Get employee by LINE user ID
   */
  static async getEmployeeByLineUserId(lineUserId: string): Promise<{
    employee_id: string;
    display_name: string | null;
  }> {
    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from('child_employee_line_accounts')
      .select('employee_id, display_name')
      .eq('line_user_id', lineUserId)
      .single();

    if (error || !data) {
      throw new NotFoundError('ไม่พบการเชื่อมต่อบัญชี LINE');
    }

    return data;
  }

  /**
   * List all LINE account mappings
   */
  static async list(options: {
    page?: number;
    limit?: number;
  } = {}): Promise<{
    data: LineAccount[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const { page = 1, limit = 50 } = options;
    const supabase = createServiceClient();

    // Count
    const { count } = await supabase
      .from('child_employee_line_accounts')
      .select('*', { count: 'exact', head: true });

    const total = count || 0;
    const offset = (page - 1) * limit;

    // Fetch with employee info
    const { data, error } = await supabase
      .from('child_employee_line_accounts')
      .select(`
        id,
        employee_id,
        line_user_id,
        display_name,
        profile_picture_url,
        linked_at,
        created_at,
        updated_at,
        employee:main_employees(
          id,
          name,
          code,
          nickname,
          profile_image_url
        )
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new DatabaseError(`ไม่สามารถดึงข้อมูลบัญชี LINE ได้: ${error.message}`);
    }

    return {
      data: (data || []) as LineAccount[],
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Create a LINE account mapping
   */
  static async create(input: CreateLineAccountInput): Promise<LineAccount> {
    const supabase = createServiceClient();

    // Validate required fields
    if (!input.employee_id) {
      throw new ValidationError('กรุณาระบุ employee_id');
    }
    if (!input.line_user_id) {
      throw new ValidationError('กรุณาระบุ line_user_id');
    }

    // Verify employee exists
    const { data: employee, error: empError } = await supabase
      .from('main_employees')
      .select('id')
      .eq('id', input.employee_id)
      .single();

    if (empError || !employee) {
      throw new NotFoundError('ไม่พบพนักงานที่ระบุ');
    }

    // Check if mapping already exists (either employee or LINE ID)
    const { data: existing } = await supabase
      .from('child_employee_line_accounts')
      .select('id, employee_id, line_user_id')
      .or(`employee_id.eq.${input.employee_id},line_user_id.eq.${input.line_user_id}`)
      .limit(1);

    if (existing && existing.length > 0) {
      if (existing[0].employee_id === input.employee_id) {
        throw new ValidationError('พนักงานนี้มีบัญชี LINE เชื่อมต่ออยู่แล้ว');
      }
      if (existing[0].line_user_id === input.line_user_id) {
        throw new ValidationError('บัญชี LINE นี้เชื่อมต่อกับพนักงานอื่นอยู่แล้ว');
      }
    }

    // Insert
    const { data, error } = await supabase
      .from('child_employee_line_accounts')
      .insert({
        employee_id: input.employee_id,
        line_user_id: input.line_user_id,
        display_name: input.display_name || null,
        profile_picture_url: input.profile_picture_url || null,
      })
      .select(`
        id,
        employee_id,
        line_user_id,
        display_name,
        profile_picture_url,
        linked_at,
        created_at,
        updated_at,
        employee:main_employees(
          id,
          name,
          code,
          nickname,
          profile_image_url
        )
      `)
      .single();

    if (error) {
      throw new DatabaseError(`ไม่สามารถสร้างการเชื่อมต่อบัญชี LINE ได้: ${error.message}`);
    }

    return data as LineAccount;
  }

  /**
   * Update LINE account info (display name, profile picture)
   */
  static async update(
    id: string,
    input: { display_name?: string; profile_picture_url?: string }
  ): Promise<LineAccount> {
    const supabase = createServiceClient();

    const updateData: Record<string, unknown> = {};
    if (input.display_name !== undefined) updateData.display_name = input.display_name;
    if (input.profile_picture_url !== undefined) updateData.profile_picture_url = input.profile_picture_url;

    if (Object.keys(updateData).length === 0) {
      throw new ValidationError('กรุณาระบุข้อมูลที่ต้องการอัปเดต');
    }

    const { data, error } = await supabase
      .from('child_employee_line_accounts')
      .update(updateData)
      .eq('id', id)
      .select(`
        id,
        employee_id,
        line_user_id,
        display_name,
        profile_picture_url,
        linked_at,
        created_at,
        updated_at,
        employee:main_employees(
          id,
          name,
          code,
          nickname,
          profile_image_url
        )
      `)
      .single();

    if (error) {
      throw new DatabaseError(`ไม่สามารถอัปเดตบัญชี LINE ได้: ${error.message}`);
    }

    if (!data) {
      throw new NotFoundError('ไม่พบการเชื่อมต่อบัญชี LINE');
    }

    return data as LineAccount;
  }

  /**
   * Delete a LINE account mapping
   */
  static async delete(id: string): Promise<void> {
    const supabase = createServiceClient();

    // Verify exists
    const { data: existing, error: fetchError } = await supabase
      .from('child_employee_line_accounts')
      .select('id')
      .eq('id', id)
      .single();

    if (fetchError || !existing) {
      throw new NotFoundError('ไม่พบการเชื่อมต่อบัญชี LINE');
    }

    const { error } = await supabase
      .from('child_employee_line_accounts')
      .delete()
      .eq('id', id);

    if (error) {
      throw new DatabaseError(`ไม่สามารถลบการเชื่อมต่อบัญชี LINE ได้: ${error.message}`);
    }
  }
}
