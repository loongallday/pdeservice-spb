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
      .from('ref_ticket_work_types')
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
      .from('ref_ticket_statuses')
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
      .from('ref_leave_types')
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

  /**
   * Get all active roles
   */
  static async getRoles(): Promise<Record<string, unknown>[]> {
    const supabase = createServiceClient();
    
    const { data, error } = await supabase
      .from('main_org_roles')
      .select('*')
      .eq('is_active', true)
      .order('name_th');
    
    if (error) throw new DatabaseError(error.message);
    
    return data || [];
  }

  /**
   * Get all active departments
   */
  static async getDepartments(): Promise<Record<string, unknown>[]> {
    const supabase = createServiceClient();
    
    const { data, error } = await supabase
      .from('main_org_departments')
      .select('*')
      .eq('is_active', true)
      .order('name_th');
    
    if (error) throw new DatabaseError(error.message);
    
    return data || [];
  }

  /**
   * Get all active work givers
   */
  static async getWorkGivers(): Promise<Record<string, unknown>[]> {
    const supabase = createServiceClient();
    
    const { data, error } = await supabase
      .from('ref_work_givers')
      .select('*')
      .eq('is_active', true)
      .order('name');
    
    if (error) throw new DatabaseError(error.message);
    
    return data || [];
  }

  /**
   * Get all constants (roles, departments, work_types, ticket_statuses, leave_types, work_givers)
   */
  static async getAllConstants(): Promise<Record<string, unknown>> {
    const [roles, departments, workTypes, ticketStatuses, leaveTypes, workGivers] = await Promise.all([
      this.getRoles(),
      this.getDepartments(),
      this.getWorkTypes(),
      this.getTicketStatuses(),
      this.getLeaveTypes(),
      this.getWorkGivers(),
    ]);

    return {
      roles,
      departments,
      work_types: workTypes,
      ticket_statuses: ticketStatuses,
      leave_types: leaveTypes,
      work_givers: workGivers,
    };
  }

  /**
   * Get work givers with filtering (compatibility method)
   * Note: This method is added for API consistency even though get is only level-based
   */
  static async getWorkGiversByLevel(minLevel: number): Promise<Record<string, unknown>[]> {
    // Work givers don't have level-based restrictions in current schema
    // Return all active work givers regardless of level
    return this.getWorkGivers();
  }
}

