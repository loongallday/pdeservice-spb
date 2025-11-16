/**
 * Reference Data Service - Database operations for reference data
 */

import { createServiceClient } from '../../_shared/supabase.ts';
import { DatabaseError } from '../../_shared/error.ts';

export class ReferenceService {
  /**
   * Get all work types
   */
  static async getWorkTypes(): Promise<Record<string, unknown>[]> {
    const supabase = createServiceClient();
    
    const { data, error } = await supabase
      .from('work_types')
      .select('*')
      .order('name');
    
    if (error) throw new DatabaseError(error.message);
    
    return data || [];
  }

  /**
   * Get all ticket statuses
   */
  static async getTicketStatuses(): Promise<Record<string, unknown>[]> {
    const supabase = createServiceClient();
    
    const { data, error } = await supabase
      .from('ticket_statuses')
      .select('*')
      .order('name');
    
    if (error) throw new DatabaseError(error.message);
    
    return data || [];
  }

  /**
   * Get all active leave types
   */
  static async getLeaveTypes(): Promise<Record<string, unknown>[]> {
    const supabase = createServiceClient();
    
    // Log query details
    
    const { data, error } = await supabase
      .from('leave_types')
      .select('*')
      .eq('is_active', true)
      .order('name');
    
    // Log query results
    
    if (error) throw new DatabaseError(error.message);
    
    return data || [];
  }

  /**
   * Get all provinces
   * TODO: Implement when provinces table is created
   */
  static async getProvinces(): Promise<Record<string, unknown>[]> {
    // Return empty array until provinces table is created
    return [];
  }
}

