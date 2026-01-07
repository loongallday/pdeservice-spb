/**
 * Ticket Audit Service
 * Handles fetching natural language audit logs for tickets
 */

import { createServiceClient } from '../../_shared/supabase.ts';
import { NotFoundError } from '../../_shared/error.ts';

export interface TicketAuditLog {
  id: string;
  ticket_id: string;
  action: string;
  changed_by: string | null;
  changed_by_name: string | null;
  changed_by_nickname: string | null;
  summary: string;
  changed_fields: string[] | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  work_type_name: string | null;
  site_name: string | null;
  company_name: string | null;
}

export interface GetAuditLogsOptions {
  ticketId: string;
  page?: number;
  limit?: number;
}

export class TicketAuditService {
  /**
   * Get audit logs for a specific ticket
   */
  static async getByTicketId(options: GetAuditLogsOptions): Promise<{
    data: TicketAuditLog[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const { ticketId, page = 1, limit = 50 } = options;
    const supabase = createServiceClient();

    // First verify ticket exists
    const { data: ticket, error: ticketError } = await supabase
      .from('main_tickets')
      .select('id')
      .eq('id', ticketId)
      .single();

    if (ticketError || !ticket) {
      throw new NotFoundError('ไม่พบตั๋วงานที่ระบุ');
    }

    // Get total count
    const { count, error: countError } = await supabase
      .from('v_ticket_audit_readable')
      .select('*', { count: 'exact', head: true })
      .eq('ticket_id', ticketId);

    if (countError) {
      console.error('Error counting audit logs:', countError);
      throw new Error('ไม่สามารถดึงข้อมูล audit log ได้');
    }

    const total = count || 0;
    const offset = (page - 1) * limit;

    // Get audit logs from the readable view
    const { data, error } = await supabase
      .from('v_ticket_audit_readable')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching audit logs:', error);
      throw new Error('ไม่สามารถดึงข้อมูล audit log ได้');
    }

    return {
      data: data || [],
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get recent audit logs across all tickets (for admin dashboard)
   */
  static async getRecent(options: { page?: number; limit?: number } = {}): Promise<{
    data: TicketAuditLog[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const { page = 1, limit = 50 } = options;
    const supabase = createServiceClient();

    // Get total count
    const { count, error: countError } = await supabase
      .from('v_ticket_audit_readable')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('Error counting audit logs:', countError);
      throw new Error('ไม่สามารถดึงข้อมูล audit log ได้');
    }

    const total = count || 0;
    const offset = (page - 1) * limit;

    // Get recent audit logs
    const { data, error } = await supabase
      .from('v_ticket_audit_readable')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching audit logs:', error);
      throw new Error('ไม่สามารถดึงข้อมูล audit log ได้');
    }

    return {
      data: data || [],
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
