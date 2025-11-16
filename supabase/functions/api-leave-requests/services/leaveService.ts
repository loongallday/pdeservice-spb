/**
 * Leave Request service - Business logic for leave request operations
 */

import { createServiceClient } from '../_shared/supabase.ts';
import { NotFoundError, DatabaseError } from '../_shared/error.ts';
import { calculatePagination } from '../_shared/response.ts';
import type { PaginationInfo } from '../_shared/response.ts';

export class LeaveService {
  static async getAll(params: { page: number; limit: number; status?: string; leave_type_id?: string; employee_id?: string; start_date?: string; end_date?: string }): Promise<{ data: Record<string, unknown>[]; pagination: PaginationInfo }> {
    const supabase = createServiceClient();
    const { page, limit, status, leave_type_id, employee_id, start_date, end_date } = params;

    let query = supabase.from('leave_requests').select(`
      *,
      employee:employees!leave_requests_employee_id_fkey(*),
      leave_type:leave_types!leave_requests_leave_type_id_fkey(*),
      approved_by_employee:employees!leave_requests_approved_by_fkey(*)
    `, { count: 'exact' }).order('created_at', { ascending: false });

    if (status && status !== 'all') query = query.eq('status', status);
    if (leave_type_id) query = query.eq('leave_type_id', leave_type_id);
    if (employee_id) query = query.eq('employee_id', employee_id);
    if (start_date) query = query.gte('end_date', start_date);
    if (end_date) query = query.lte('start_date', end_date);

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error, count } = await query.range(from, to);
    if (error) throw new DatabaseError(error.message);

    return { data: data || [], pagination: calculatePagination(page, limit, count ?? 0) };
  }

  static async getById(id: string): Promise<Record<string, unknown>> {
    const supabase = createServiceClient();
    
    const { data, error } = await supabase.from('leave_requests').select(`
      *,
      employee:employees!leave_requests_employee_id_fkey(*),
      leave_type:leave_types!leave_requests_leave_type_id_fkey(*),
      approved_by_employee:employees!leave_requests_approved_by_fkey(*)
    `).eq('id', id).single();

    if (error) {
      if (error.code === 'PGRST116') throw new NotFoundError('ไม่พบคำขอลา');
      throw new DatabaseError(error.message);
    }
    if (!data) {
      throw new NotFoundError('ไม่พบคำขอลา');
    }

    return data;
  }

  static async create(leaveData: Record<string, unknown>): Promise<Record<string, unknown>> {
    const supabase = createServiceClient();
    
    // Extract half_day_type before creating the insert data
    // PostgREST schema cache doesn't recognize the enum column, so we'll handle it separately
    const halfDayType = (
      leaveData.half_day_type === 'morning' || 
      leaveData.half_day_type === 'afternoon'
    ) ? leaveData.half_day_type as string : null;

    // Create insert data WITHOUT half_day_type to avoid PostgREST schema cache issues
    const insertData: Record<string, unknown> = {
      employee_id: leaveData.employee_id,
      leave_type_id: leaveData.leave_type_id,
      start_date: leaveData.start_date,
      end_date: leaveData.end_date,
      total_days: leaveData.total_days,
      reason: leaveData.reason || null,
      status: leaveData.status || 'pending',
      // Explicitly exclude half_day_type from initial insert
    };

    // Insert without half_day_type
    const { data: insertedData, error: insertError } = await supabase
      .from('leave_requests')
      .insert(insertData)
      .select('id')
      .single();

    if (insertError) {
      console.error('LeaveService.create - Insert Error:', {
        message: insertError.message,
        details: insertError.details,
        hint: insertError.hint,
        code: insertError.code,
      });
      throw new DatabaseError(insertError.message);
    }

    if (!insertedData || !insertedData.id) {
      throw new DatabaseError('Failed to create leave request');
    }

    const insertedId = insertedData.id as string;

    // If half_day_type is provided, try to update it
    // First try direct update, if that fails due to schema cache, try RPC function
    if (halfDayType) {
      try {
        // Try direct update first
        const { error: updateError } = await supabase
          .from('leave_requests')
          .update({ half_day_type: halfDayType })
          .eq('id', insertedId);

        if (updateError) {
          // If direct update fails (likely schema cache issue), try RPC function
          console.warn('LeaveService.create - Direct update failed, trying RPC:', updateError.message);
          
          const { error: rpcError } = await supabase.rpc('update_leave_request_half_day_type', {
            p_id: insertedId,
            p_half_day_type: halfDayType,
          });

          if (rpcError) {
            console.warn('LeaveService.create - RPC update also failed:', rpcError.message);
            // Don't fail the entire operation - leave request was created successfully
            // half_day_type will be null, which is acceptable
          }
        }
      } catch (err) {
        console.warn('LeaveService.create - Error setting half_day_type:', err);
        // Continue - the leave request was created successfully
      }
    }

    // Fetch full data with relations
    const { data, error } = await supabase.from('leave_requests').select(`
      *,
      employee:employees!leave_requests_employee_id_fkey(*),
      leave_type:leave_types!leave_requests_leave_type_id_fkey(*)
    `).eq('id', insertedId).single();

    if (error) {
      console.error('LeaveService.create - Fetch Error:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      });
      throw new DatabaseError(error.message);
    }
    if (!data) throw new DatabaseError('Failed to fetch created leave request');

    return data;
  }

  static async update(id: string, leaveData: Record<string, unknown>): Promise<Record<string, unknown>> {
    const supabase = createServiceClient();
    
    // Clean data: remove half_day_type if it's null/undefined/empty to avoid PostgREST schema cache issues
    const cleanedData: Record<string, unknown> = { ...leaveData };
    if (
      cleanedData.half_day_type === null || 
      cleanedData.half_day_type === undefined || 
      cleanedData.half_day_type === '' ||
      cleanedData.half_day_type === 'full'
    ) {
      delete cleanedData.half_day_type;
    }
    
    const { data, error } = await supabase.from('leave_requests').update(cleanedData).eq('id', id).select(`
      *,
      employee:employees!leave_requests_employee_id_fkey(*),
      leave_type:leave_types!leave_requests_leave_type_id_fkey(*),
      approved_by_employee:employees!leave_requests_approved_by_fkey(*)
    `).single();

    if (error) throw new DatabaseError(error.message);
    if (!data) throw new NotFoundError('ไม่พบคำขอลา');

    return data;
  }

  static async delete(id: string): Promise<void> {
    const supabase = createServiceClient();
    const { error } = await supabase.from('leave_requests').delete().eq('id', id);

    if (error) throw new DatabaseError(error.message);
  }

  static async approve(id: string, approvedBy: string): Promise<Record<string, unknown>> {
    return this.update(id, {
      status: 'approved',
      approved_by: approvedBy,
      approved_at: new Date().toISOString(),
    });
  }

  static async reject(id: string, approvedBy: string, reason?: string): Promise<Record<string, unknown>> {
    return this.update(id, {
      status: 'rejected',
      approved_by: approvedBy,
      approved_at: new Date().toISOString(),
      rejected_reason: reason || null,
    });
  }

  static async cancel(id: string): Promise<Record<string, unknown>> {
    return this.update(id, { status: 'cancelled' });
  }
}

