/**
 * Technician Analytics Service
 * Provides technician performance metrics for reports
 */

import { createServiceClient } from '../../_shared/supabase.ts';
import { DatabaseError } from '../../_shared/error.ts';

export interface TopPerformer {
  employee_id: string;
  employee_name: string;
  employee_code: string;
  tickets_assigned: number;
  tickets_confirmed: number;
}

export interface TechnicianData {
  active_count: number;
  top_performers: TopPerformer[];
  team_count: number;
}

export class TechnicianAnalyticsService {
  /**
   * Get technician performance data for a date
   */
  static async getPerformance(date: string): Promise<TechnicianData> {
    const supabase = createServiceClient();

    // Get assigned technicians (from jct_ticket_employees)
    const { data: assignedData, error: assignedError } = await supabase
      .from('jct_ticket_employees')
      .select(`
        employee_id,
        ticket_id,
        employee:main_employees!jct_ticket_employees_employee_id_fkey(id, name, code)
      `)
      .eq('date', date);

    if (assignedError) {
      console.error('[TechnicianAnalyticsService] Error fetching assigned:', assignedError.message);
      throw new DatabaseError('ไม่สามารถดึงข้อมูลช่างที่ได้รับมอบหมายได้');
    }

    // Get confirmed technicians (from jct_ticket_employees_cf)
    const { data: confirmedData, error: confirmedError } = await supabase
      .from('jct_ticket_employees_cf')
      .select(`
        employee_id,
        ticket_id,
        employee:main_employees!jct_ticket_employees_cf_employee_id_fkey(id, name, code)
      `)
      .eq('date', date);

    if (confirmedError) {
      console.error('[TechnicianAnalyticsService] Error fetching confirmed:', confirmedError.message);
      throw new DatabaseError('ไม่สามารถดึงข้อมูลช่างที่ยืนยันแล้วได้');
    }

    // Count unique technicians (assigned)
    const uniqueAssigned = new Set<string>();
    const assignedCountMap = new Map<string, number>();
    const employeeInfoMap = new Map<string, { name: string; code: string }>();

    for (const row of assignedData || []) {
      if (row.employee_id) {
        uniqueAssigned.add(row.employee_id);
        assignedCountMap.set(
          row.employee_id,
          (assignedCountMap.get(row.employee_id) || 0) + 1
        );
        if (row.employee) {
          employeeInfoMap.set(row.employee_id, {
            name: (row.employee as any).name || '',
            code: (row.employee as any).code || '',
          });
        }
      }
    }

    // Count confirmed per technician
    const confirmedCountMap = new Map<string, number>();
    for (const row of confirmedData || []) {
      if (row.employee_id) {
        uniqueAssigned.add(row.employee_id); // Also add to unique set
        confirmedCountMap.set(
          row.employee_id,
          (confirmedCountMap.get(row.employee_id) || 0) + 1
        );
        if (row.employee && !employeeInfoMap.has(row.employee_id)) {
          employeeInfoMap.set(row.employee_id, {
            name: (row.employee as any).name || '',
            code: (row.employee as any).code || '',
          });
        }
      }
    }

    // Build top performers (sorted by assigned count)
    const performers: TopPerformer[] = [];
    for (const [employeeId, assignedCount] of assignedCountMap) {
      const info = employeeInfoMap.get(employeeId);
      performers.push({
        employee_id: employeeId,
        employee_name: info?.name || '',
        employee_code: info?.code || '',
        tickets_assigned: assignedCount,
        tickets_confirmed: confirmedCountMap.get(employeeId) || 0,
      });
    }

    // Sort by tickets_assigned descending, take top 10
    performers.sort((a, b) => b.tickets_assigned - a.tickets_assigned);
    const topPerformers = performers.slice(0, 10);

    // Count unique team combinations (from confirmed technicians)
    const teamCount = await this.getUniqueTeamCount(date);

    return {
      active_count: uniqueAssigned.size,
      top_performers: topPerformers,
      team_count: teamCount,
    };
  }

  /**
   * Count unique technician team combinations for a date
   */
  static async getUniqueTeamCount(date: string): Promise<number> {
    const supabase = createServiceClient();

    // Get confirmed technicians grouped by ticket
    const { data, error } = await supabase
      .from('jct_ticket_employees_cf')
      .select('ticket_id, employee_id')
      .eq('date', date);

    if (error) {
      console.error('[TechnicianAnalyticsService] Error fetching teams:', error.message);
      return 0;
    }

    // Group by ticket_id
    const ticketTeams = new Map<string, string[]>();
    for (const row of data || []) {
      if (!ticketTeams.has(row.ticket_id)) {
        ticketTeams.set(row.ticket_id, []);
      }
      ticketTeams.get(row.ticket_id)!.push(row.employee_id);
    }

    // Create unique team signatures (sorted employee IDs joined)
    const uniqueTeams = new Set<string>();
    for (const employeeIds of ticketTeams.values()) {
      const teamSignature = employeeIds.sort().join(',');
      uniqueTeams.add(teamSignature);
    }

    return uniqueTeams.size;
  }

  /**
   * Get count of active technicians for a date
   */
  static async getActiveTechnicianCount(date: string): Promise<number> {
    const supabase = createServiceClient();

    // Get unique technicians from assignments
    const { data, error } = await supabase
      .from('jct_ticket_employees')
      .select('employee_id')
      .eq('date', date);

    if (error) {
      console.error('[TechnicianAnalyticsService] Error counting active:', error.message);
      return 0;
    }

    const uniqueIds = new Set((data || []).map(r => r.employee_id));
    return uniqueIds.size;
  }
}
