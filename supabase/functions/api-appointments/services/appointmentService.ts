/**
 * Appointment service - Business logic for appointment operations
 */

import { createServiceClient } from '../../_shared/supabase.ts';
import { NotFoundError, DatabaseError } from '../../_shared/error.ts';
import { calculatePagination } from '../../_shared/response.ts';
import type { PaginationInfo } from '../../_shared/response.ts';
import { logTicketAudit } from '../../api-tickets/services/ticketHelperService.ts';
import { NotificationService } from '../../api-tickets/services/notificationService.ts';

export interface AppointmentQueryParams {
  page?: number;
  limit?: number;
  ticket_id?: string;
}

export class AppointmentService {
  static async getAll(params: AppointmentQueryParams): Promise<{ data: Record<string, unknown>[]; pagination: PaginationInfo }> {
    const supabase = createServiceClient();
    const { page = 1, limit = 50, ticket_id } = params;

    // Count query
    let countQuery = supabase.from('main_appointments').select('*', { count: 'exact', head: true });
    if (ticket_id) countQuery = countQuery.eq('ticket_id', ticket_id);

    const { count, error: countError } = await countQuery;
    if (countError) throw new DatabaseError(countError.message);

    const total = count ?? 0;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    // Data query
    let dataQuery = supabase
      .from('main_appointments')
      .select('*')
      .order('appointment_date', { ascending: false })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (ticket_id) {
      dataQuery = dataQuery.eq('ticket_id', ticket_id);
    }

    const { data, error } = await dataQuery;
    if (error) throw new DatabaseError(error.message);

    return {
      data: data || [],
      pagination: calculatePagination(page, limit, total),
    };
  }

  static async getById(id: string): Promise<Record<string, unknown>> {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('main_appointments')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') throw new NotFoundError('ไม่พบข้อมูลการนัดหมาย');
      throw new DatabaseError(error.message);
    }
    if (!data) throw new NotFoundError('ไม่พบข้อมูลการนัดหมาย');

    return data;
  }

  static async getByTicketId(ticketId: string): Promise<Record<string, unknown> | null> {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('main_appointments')
      .select('*')
      .eq('ticket_id', ticketId)
      .maybeSingle();

    if (error) throw new DatabaseError(error.message);
    return data;
  }

  static async create(appointmentData: Record<string, unknown>): Promise<Record<string, unknown>> {
    const supabase = createServiceClient();
    
    // Update ticket's appointment_id after creating appointment
    const { data: appointment, error: appointmentError } = await supabase
      .from('main_appointments')
      .insert([appointmentData])
      .select()
      .single();

    if (appointmentError) throw new DatabaseError(appointmentError.message);
    if (!appointment) throw new DatabaseError('Failed to create appointment');

    // Update ticket's appointment_id if ticket_id is provided
    if (appointment.ticket_id) {
      const { error: ticketError } = await supabase
        .from('main_tickets')
        .update({ appointment_id: appointment.id })
        .eq('id', appointment.ticket_id);

      if (ticketError) {
        // Log error but don't fail - appointment was created successfully
        console.error('Failed to update ticket appointment_id:', ticketError);
      }
    }

    return appointment;
  }

  static async update(id: string, appointmentData: Record<string, unknown>): Promise<Record<string, unknown>> {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('main_appointments')
      .update(appointmentData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new DatabaseError(error.message);
    if (!data) throw new NotFoundError('ไม่พบข้อมูลการนัดหมาย');

    return data;
  }

  /**
   * Approve or un-approve appointment and optionally update appointment details
   * Sets is_approved based on appointmentData.is_approved (defaults to true if not provided)
   * Updates provided fields
   */
  static async approve(
    id: string,
    appointmentData: Record<string, unknown>,
    approvedBy?: string
  ): Promise<Record<string, unknown>> {
    const supabase = createServiceClient();

    // Get current appointment state for audit logging
    const [appointmentResult, ticketResult] = await Promise.all([
      supabase
        .from('main_appointments')
        .select('*')
        .eq('id', id)
        .single(),
      supabase
        .from('main_tickets')
        .select('id')
        .eq('appointment_id', id)
        .maybeSingle(),
    ]);

    const oldAppointment = appointmentResult.data;
    const ticketId = ticketResult.data?.id || null;
    const wasApproved = oldAppointment?.is_approved;

    // Set is_approved - use provided value or default to true
    const updateData = {
      ...appointmentData,
      is_approved: appointmentData.is_approved !== undefined ? appointmentData.is_approved : true,
    };

    const { data, error } = await supabase
      .from('main_appointments')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new DatabaseError(error.message);
    if (!data) throw new NotFoundError('ไม่พบข้อมูลการนัดหมาย');

    // Log audit if we have ticket and approver info
    if (ticketId && approvedBy) {
      const isApproved = data.is_approved as boolean;
      const action = isApproved ? 'approved' : 'unapproved';

      await logTicketAudit({
        ticketId,
        action,
        changedBy: approvedBy,
        oldValues: {
          is_approved: wasApproved,
          appointment_date: oldAppointment?.appointment_date,
          appointment_time_start: oldAppointment?.appointment_time_start,
          appointment_time_end: oldAppointment?.appointment_time_end,
          appointment_type: oldAppointment?.appointment_type,
        },
        newValues: {
          is_approved: isApproved,
          appointment_date: data.appointment_date,
          appointment_time_start: data.appointment_time_start,
          appointment_time_end: data.appointment_time_end,
          appointment_type: data.appointment_type,
        },
        metadata: {
          appointment_id: id,
        },
      });

      // Create notifications for confirmed technicians (async, don't wait)
      NotificationService.createApprovalNotifications(
        ticketId,
        isApproved,
        approvedBy
      ).catch(err => {
        console.error('[appointment] Failed to create approval notifications:', err);
      });
    }

    return data;
  }

  static async delete(id: string): Promise<void> {
    const supabase = createServiceClient();
    
    // Get appointment to find associated ticket
    const { data: appointment } = await supabase
      .from('main_appointments')
      .select('ticket_id')
      .eq('id', id)
      .single();

    // Delete appointment
    const { error: deleteError } = await supabase
      .from('main_appointments')
      .delete()
      .eq('id', id);

    if (deleteError) throw new DatabaseError(deleteError.message);

    // Clear ticket's appointment_id if it was set
    if (appointment?.ticket_id) {
      const { error: ticketError } = await supabase
        .from('main_tickets')
        .update({ appointment_id: null })
        .eq('id', appointment.ticket_id)
        .eq('appointment_id', id);

      if (ticketError) {
        // Log error but don't fail - appointment was deleted successfully
        console.error('Failed to clear ticket appointment_id:', ticketError);
      }
    }
  }

  /**
   * Search appointments by notes or appointment type
   */
  static async search(query: string): Promise<Record<string, unknown>[]> {
    const supabase = createServiceClient();

    if (!query || query.length < 1) {
      return [];
    }

    const { data, error } = await supabase
      .from('main_appointments')
      .select('*')
      .or(`notes.ilike.%${query}%,appointment_type.ilike.%${query}%`)
      .limit(20)
      .order('appointment_date', { ascending: false });

    if (error) throw new DatabaseError(error.message);

    return data || [];
  }
}

