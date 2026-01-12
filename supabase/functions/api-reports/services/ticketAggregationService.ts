/**
 * Ticket Aggregation Service
 * Provides ticket counting and grouping functions for reports
 */

import { createServiceClient } from '../../_shared/supabase.ts';
import { DatabaseError } from '../../_shared/error.ts';

export interface StatusAggregation {
  status_id: string;
  status_code: string;
  status_name: string;
  count: number;
}

export interface WorkTypeAggregation {
  work_type_id: string;
  work_type_code: string;
  work_type_name: string;
  count: number;
}

export interface DayTrend {
  date: string;
  count: number;
}

export interface TicketData {
  id: string;
  status_id: string | null;
  work_type_id: string | null;
  site_id: string | null;
  province_code: number | null;
  appointment_type: string | null;
  appointment_time_start: string | null;
  is_approved: boolean;
}

export class TicketAggregationService {
  /**
   * Get all tickets with appointments on a specific date
   */
  static async getTicketsByDate(date: string): Promise<TicketData[]> {
    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from('main_tickets')
      .select(`
        id,
        status_id,
        work_type_id,
        site_id,
        site:main_sites(province_code),
        appointment:main_appointments!inner(
          appointment_type,
          appointment_time_start,
          is_approved
        )
      `)
      .eq('appointment.appointment_date', date);

    if (error) {
      console.error('[TicketAggregationService] Error fetching tickets:', error.message);
      throw new DatabaseError('ไม่สามารถดึงข้อมูลตั๋วงานได้');
    }

    // Flatten the data structure
    return (data || []).map((t: any) => ({
      id: t.id,
      status_id: t.status_id,
      work_type_id: t.work_type_id,
      site_id: t.site_id,
      province_code: t.site?.province_code || null,
      appointment_type: t.appointment?.appointment_type || null,
      appointment_time_start: t.appointment?.appointment_time_start || null,
      is_approved: t.appointment?.is_approved || false,
    }));
  }

  /**
   * Get status aggregation for tickets on a date
   */
  static async getStatusAggregation(date: string): Promise<StatusAggregation[]> {
    const supabase = createServiceClient();

    // Get all statuses
    const { data: statuses, error: statusError } = await supabase
      .from('ref_ticket_statuses')
      .select('id, code, name')
      .order('code');

    if (statusError) {
      console.error('[TicketAggregationService] Error fetching statuses:', statusError.message);
      throw new DatabaseError('ไม่สามารถดึงข้อมูลสถานะได้');
    }

    // Get tickets for the date
    const tickets = await this.getTicketsByDate(date);

    // Count by status
    const countMap = new Map<string, number>();
    for (const ticket of tickets) {
      if (ticket.status_id) {
        countMap.set(ticket.status_id, (countMap.get(ticket.status_id) || 0) + 1);
      }
    }

    return (statuses || []).map((s: any) => ({
      status_id: s.id,
      status_code: s.code,
      status_name: s.name,
      count: countMap.get(s.id) || 0,
    }));
  }

  /**
   * Get work type aggregation for tickets on a date
   */
  static async getWorkTypeAggregation(date: string): Promise<WorkTypeAggregation[]> {
    const supabase = createServiceClient();

    // Get all work types
    const { data: workTypes, error: workTypeError } = await supabase
      .from('ref_ticket_work_types')
      .select('id, code, name')
      .order('code');

    if (workTypeError) {
      console.error('[TicketAggregationService] Error fetching work types:', workTypeError.message);
      throw new DatabaseError('ไม่สามารถดึงข้อมูลประเภทงานได้');
    }

    // Get tickets for the date
    const tickets = await this.getTicketsByDate(date);

    // Count by work type
    const countMap = new Map<string, number>();
    for (const ticket of tickets) {
      if (ticket.work_type_id) {
        countMap.set(ticket.work_type_id, (countMap.get(ticket.work_type_id) || 0) + 1);
      }
    }

    return (workTypes || []).map((w: any) => ({
      work_type_id: w.id,
      work_type_code: w.code,
      work_type_name: w.name,
      count: countMap.get(w.id) || 0,
    }));
  }

  /**
   * Get ticket count trend for the last 7 days ending on the given date
   */
  static async getWeekTrend(endDate: string): Promise<DayTrend[]> {
    const supabase = createServiceClient();

    // Calculate start date (6 days before end date)
    const end = new Date(endDate);
    const start = new Date(end);
    start.setDate(start.getDate() - 6);

    const startDateStr = start.toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('main_appointments')
      .select('appointment_date, main_tickets!inner(id)')
      .gte('appointment_date', startDateStr)
      .lte('appointment_date', endDate);

    if (error) {
      console.error('[TicketAggregationService] Error fetching week trend:', error.message);
      throw new DatabaseError('ไม่สามารถดึงข้อมูลแนวโน้มได้');
    }

    // Group by date
    const countMap = new Map<string, number>();
    for (const row of data || []) {
      const dateStr = row.appointment_date;
      countMap.set(dateStr, (countMap.get(dateStr) || 0) + 1);
    }

    // Generate all 7 days (fill gaps with 0)
    const result: DayTrend[] = [];
    const current = new Date(start);
    while (current <= end) {
      const dateStr = current.toISOString().split('T')[0];
      result.push({
        date: dateStr,
        count: countMap.get(dateStr) || 0,
      });
      current.setDate(current.getDate() + 1);
    }

    return result;
  }

  /**
   * Count tickets created on a specific date
   */
  static async getTicketsCreatedOnDate(date: string): Promise<number> {
    const supabase = createServiceClient();

    const startOfDay = `${date}T00:00:00.000Z`;
    const endOfDay = `${date}T23:59:59.999Z`;

    const { count, error } = await supabase
      .from('main_tickets')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', startOfDay)
      .lte('created_at', endOfDay);

    if (error) {
      console.error('[TicketAggregationService] Error counting created tickets:', error.message);
      throw new DatabaseError('ไม่สามารถนับตั๋วงานที่สร้างได้');
    }

    return count || 0;
  }

  /**
   * Count tickets completed on a specific date
   * A ticket is "completed" if its status code is 'completed' or similar
   */
  static async getTicketsCompletedOnDate(date: string): Promise<number> {
    const supabase = createServiceClient();

    // Get completed status IDs
    const { data: completedStatuses, error: statusError } = await supabase
      .from('ref_ticket_statuses')
      .select('id')
      .in('code', ['completed', 'closed', 'done']);

    if (statusError) {
      console.error('[TicketAggregationService] Error fetching completed statuses:', statusError.message);
      return 0;
    }

    const completedStatusIds = (completedStatuses || []).map((s: any) => s.id);
    if (completedStatusIds.length === 0) {
      return 0;
    }

    // Count tickets with appointment on this date that are completed
    const { data, error } = await supabase
      .from('main_tickets')
      .select(`
        id,
        appointment:main_appointments!inner(appointment_date)
      `)
      .eq('appointment.appointment_date', date)
      .in('status_id', completedStatusIds);

    if (error) {
      console.error('[TicketAggregationService] Error counting completed tickets:', error.message);
      throw new DatabaseError('ไม่สามารถนับตั๋วงานที่เสร็จสิ้นได้');
    }

    return data?.length || 0;
  }
}
