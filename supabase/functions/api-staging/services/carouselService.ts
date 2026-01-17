/**
 * Carousel Service - Get tickets for LINE carousel display
 */

import { createServiceClient } from '../../_shared/supabase.ts';
import { NotFoundError, DatabaseError } from '../../_shared/error.ts';
import { LineAccountService } from './lineAccountService.ts';
import type { CarouselTicket } from '../types.ts';

export class CarouselService {
  /**
   * Get tickets assigned to a technician for LINE carousel
   * Returns recent active tickets (not closed/cancelled)
   */
  static async getTicketsForEmployee(
    lineUserId: string,
    options: { limit?: number } = {}
  ): Promise<CarouselTicket[]> {
    const { limit = 10 } = options;
    const supabase = createServiceClient();

    // Get employee from LINE user ID
    const lineAccount = await LineAccountService.getEmployeeByLineUserId(lineUserId);
    const employeeId = lineAccount.employee_id;

    // Get tickets assigned to this employee that are in progress
    const { data, error } = await supabase
      .from('main_tickets')
      .select(`
        id,
        ticket_code,
        site:main_sites(
          name
        ),
        work_type:ref_ticket_work_types(
          name
        ),
        status:ref_ticket_statuses(
          name
        ),
        appointments:main_appointments(
          appointment_date
        )
      `)
      .eq('jct_ticket_employees.employee_id', employeeId)
      .not('status_code', 'in', '("closed","cancelled","completed")')
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (error) {
      // Try alternative query using RPC or join
      return await this.getTicketsViaJunction(employeeId, limit);
    }

    return this.formatCarouselTickets(data || []);
  }

  /**
   * Alternative: Get tickets via junction table query
   */
  private static async getTicketsViaJunction(
    employeeId: string,
    limit: number
  ): Promise<CarouselTicket[]> {
    const supabase = createServiceClient();

    // Get ticket IDs assigned to employee
    const { data: assignments, error: assignError } = await supabase
      .from('jct_ticket_employees')
      .select('ticket_id')
      .eq('employee_id', employeeId)
      .limit(limit * 2); // Get more to account for filtering

    if (assignError || !assignments || assignments.length === 0) {
      return [];
    }

    const ticketIds = assignments.map(a => a.ticket_id);

    // Get ticket details
    const { data: tickets, error: ticketError } = await supabase
      .from('main_tickets')
      .select(`
        id,
        ticket_code,
        status_code,
        site:main_sites(
          name
        ),
        work_type:ref_ticket_work_types(
          name
        ),
        status:ref_ticket_statuses(
          name
        )
      `)
      .in('id', ticketIds)
      .not('status_code', 'in', '("closed","cancelled","completed")')
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (ticketError) {
      throw new DatabaseError(`ไม่สามารถดึงข้อมูลตั๋วงานได้: ${ticketError.message}`);
    }

    // Get appointments for these tickets
    const resultTicketIds = (tickets || []).map(t => t.id);
    const { data: appointments } = await supabase
      .from('main_appointments')
      .select('ticket_id, appointment_date')
      .in('ticket_id', resultTicketIds)
      .gte('appointment_date', new Date().toISOString().split('T')[0])
      .order('appointment_date', { ascending: true });

    // Create appointment map
    const appointmentMap = new Map<string, string>();
    for (const apt of appointments || []) {
      if (!appointmentMap.has(apt.ticket_id)) {
        appointmentMap.set(apt.ticket_id, apt.appointment_date);
      }
    }

    return this.formatCarouselTickets(tickets || [], appointmentMap);
  }

  /**
   * Format tickets for carousel response
   */
  private static formatCarouselTickets(
    tickets: Array<Record<string, unknown>>,
    appointmentMap?: Map<string, string>
  ): CarouselTicket[] {
    return tickets.map(ticket => {
      const site = ticket.site as { name: string } | null;
      const workType = ticket.work_type as { name: string } | null;
      const status = ticket.status as { name: string } | null;
      const appointments = ticket.appointments as Array<{ appointment_date: string }> | undefined;

      // Get appointment date from embedded data or map
      let appointmentDate: string | undefined;
      if (appointments && appointments.length > 0) {
        appointmentDate = appointments[0].appointment_date;
      } else if (appointmentMap && ticket.id) {
        appointmentDate = appointmentMap.get(ticket.id as string);
      }

      return {
        id: ticket.id as string,
        ticket_code: ticket.ticket_code as string,
        site_name: site?.name || '-',
        work_type_name: workType?.name || '-',
        status_name: status?.name || '-',
        appointment_date: appointmentDate,
      };
    });
  }

  /**
   * Get a single ticket by code (for verification)
   */
  static async getTicketByCode(code: string): Promise<CarouselTicket | null> {
    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from('main_tickets')
      .select(`
        id,
        ticket_code,
        site:main_sites(
          name
        ),
        work_type:ref_ticket_work_types(
          name
        ),
        status:ref_ticket_statuses(
          name
        )
      `)
      .eq('ticket_code', code)
      .single();

    if (error || !data) {
      return null;
    }

    return this.formatCarouselTickets([data])[0];
  }
}
