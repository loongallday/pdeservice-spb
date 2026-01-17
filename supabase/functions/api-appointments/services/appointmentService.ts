/**
 * @fileoverview Appointment service - Business logic for appointment operations
 *
 * Handles CRUD operations for main_appointments table.
 * Appointments are linked to tickets via main_tickets.appointment_id.
 *
 * @module api-appointments/services/appointmentService
 */

import { createServiceClient } from '../../_shared/supabase.ts';
import { NotFoundError, DatabaseError } from '../../_shared/error.ts';
import { calculatePagination } from '../../_shared/response.ts';
import type { PaginationInfo } from '../../_shared/response.ts';
import { logTicketAudit } from '../../api-tickets/services/ticketHelperService.ts';
import { NotificationService } from '../../api-tickets/services/notificationService.ts';
import type {
  Appointment,
  CreateAppointmentInput,
  UpdateAppointmentInput,
  ApproveAppointmentInput,
  ListAppointmentsParams,
  AppointmentType,
} from '../types.ts';

/**
 * Service class for appointment operations
 *
 * @example
 * // List appointments with pagination
 * const result = await AppointmentService.getAll({ page: 1, limit: 20 });
 *
 * @example
 * // Create appointment linked to ticket
 * const appointment = await AppointmentService.create({
 *   appointment_type: 'time_range',
 *   appointment_date: '2026-01-20',
 *   ticket_id: 'uuid-here'
 * });
 */
export class AppointmentService {
  /**
   * Retrieves all appointments with pagination
   *
   * @param params - Query parameters for filtering and pagination
   * @param params.page - Page number (default: 1)
   * @param params.limit - Items per page (default: 50)
   * @param params.ticket_id - Optional ticket ID to filter by
   * @returns Paginated list of appointments sorted by date descending
   * @throws {DatabaseError} If database query fails
   */
  static async getAll(
    params: ListAppointmentsParams
  ): Promise<{ data: Appointment[]; pagination: PaginationInfo }> {
    const supabase = createServiceClient();
    const { page = 1, limit = 50, ticket_id } = params;

    // Build count query
    let countQuery = supabase
      .from('main_appointments')
      .select('*', { count: 'exact', head: true });

    // If filtering by ticket_id, we need to find the appointment linked to that ticket
    if (ticket_id) {
      const { data: ticket } = await supabase
        .from('main_tickets')
        .select('appointment_id')
        .eq('id', ticket_id)
        .single();

      if (ticket?.appointment_id) {
        countQuery = countQuery.eq('id', ticket.appointment_id);
      } else {
        // No appointment linked to this ticket
        return {
          data: [],
          pagination: calculatePagination(page, limit, 0),
        };
      }
    }

    const { count, error: countError } = await countQuery;
    if (countError) throw new DatabaseError(countError.message);

    const total = count ?? 0;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    // Build data query
    let dataQuery = supabase
      .from('main_appointments')
      .select('*')
      .order('appointment_date', { ascending: false })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (ticket_id) {
      const { data: ticket } = await supabase
        .from('main_tickets')
        .select('appointment_id')
        .eq('id', ticket_id)
        .single();

      if (ticket?.appointment_id) {
        dataQuery = dataQuery.eq('id', ticket.appointment_id);
      }
    }

    const { data, error } = await dataQuery;
    if (error) throw new DatabaseError(error.message);

    return {
      data: (data as Appointment[]) || [],
      pagination: calculatePagination(page, limit, total),
    };
  }

  /**
   * Retrieves a single appointment by ID
   *
   * @param id - UUID of the appointment
   * @returns The appointment record
   * @throws {NotFoundError} If appointment doesn't exist
   * @throws {DatabaseError} If database query fails
   */
  static async getById(id: string): Promise<Appointment> {
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

    return data as Appointment;
  }

  /**
   * Retrieves the appointment linked to a ticket
   *
   * Looks up the ticket's appointment_id and fetches that appointment.
   * Returns null if the ticket has no linked appointment.
   *
   * @param ticketId - UUID of the ticket
   * @returns The linked appointment or null if none exists
   * @throws {DatabaseError} If database query fails
   */
  static async getByTicketId(ticketId: string): Promise<Appointment | null> {
    const supabase = createServiceClient();

    // Tickets have appointment_id, not the other way around
    // So we first get the ticket to find its appointment_id
    const { data: ticket, error: ticketError } = await supabase
      .from('main_tickets')
      .select('appointment_id')
      .eq('id', ticketId)
      .single();

    if (ticketError) {
      if (ticketError.code === 'PGRST116') return null;
      throw new DatabaseError(ticketError.message);
    }

    if (!ticket?.appointment_id) return null;

    // Now fetch the actual appointment
    const { data: appointment, error: appointmentError } = await supabase
      .from('main_appointments')
      .select('*')
      .eq('id', ticket.appointment_id)
      .single();

    if (appointmentError) {
      if (appointmentError.code === 'PGRST116') return null;
      throw new DatabaseError(appointmentError.message);
    }

    return appointment as Appointment;
  }

  /**
   * Creates a new appointment
   *
   * If ticket_id is provided, also updates the ticket's appointment_id.
   * The ticket_id is NOT stored in the appointment - the relationship is
   * maintained via main_tickets.appointment_id.
   *
   * @param appointmentData - Data for the new appointment
   * @returns The created appointment
   * @throws {DatabaseError} If database insert fails
   */
  static async create(appointmentData: CreateAppointmentInput): Promise<Appointment> {
    const supabase = createServiceClient();

    // Extract ticket_id before inserting (it's not a column in main_appointments)
    const { ticket_id, ...insertData } = appointmentData;

    const { data: appointment, error: appointmentError } = await supabase
      .from('main_appointments')
      .insert([insertData])
      .select()
      .single();

    if (appointmentError) throw new DatabaseError(appointmentError.message);
    if (!appointment) throw new DatabaseError('Failed to create appointment');

    // Link appointment to ticket if ticket_id was provided
    if (ticket_id) {
      const { error: ticketError } = await supabase
        .from('main_tickets')
        .update({ appointment_id: appointment.id })
        .eq('id', ticket_id);

      if (ticketError) {
        // Log error but don't fail - appointment was created successfully
        console.error('[appointment] Failed to update ticket appointment_id:', ticketError);
      }
    }

    return appointment as Appointment;
  }

  /**
   * Updates an existing appointment
   *
   * If is_approved is being set to false (by a non-approver editing),
   * this will also remove any confirmed technicians from the ticket.
   *
   * @param id - UUID of the appointment to update
   * @param appointmentData - Fields to update
   * @returns The updated appointment
   * @throws {NotFoundError} If appointment doesn't exist
   * @throws {DatabaseError} If database update fails
   */
  static async update(
    id: string,
    appointmentData: UpdateAppointmentInput & { is_approved?: boolean }
  ): Promise<Appointment> {
    const supabase = createServiceClient();

    // Check if we're setting is_approved to false - need to remove confirmed technicians
    const isBeingUnapproved = appointmentData.is_approved === false;

    // Get current appointment data for audit logging if unapproving
    let ticketId: string | null = null;
    let oldAppointmentDate: string | null = null;

    if (isBeingUnapproved) {
      // Find the ticket that has this appointment
      const { data: ticket } = await supabase
        .from('main_tickets')
        .select('id, appointment_id')
        .eq('appointment_id', id)
        .single();

      if (ticket) {
        ticketId = ticket.id;

        const { data: currentAppointment } = await supabase
          .from('main_appointments')
          .select('appointment_date')
          .eq('id', id)
          .single();

        oldAppointmentDate = currentAppointment?.appointment_date ?? null;
      }
    }

    // Extract ticket_id if present (not a column in main_appointments)
    const { ticket_id: _ticketId, ...updateData } = appointmentData as UpdateAppointmentInput & {
      is_approved?: boolean;
      ticket_id?: string;
    };

    const { data, error } = await supabase
      .from('main_appointments')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new DatabaseError(error.message);
    if (!data) throw new NotFoundError('ไม่พบข้อมูลการนัดหมาย');

    // If appointment was unapproved, remove confirmed technicians
    if (isBeingUnapproved && ticketId) {
      const { error: deleteError } = await supabase
        .from('jct_ticket_employees_cf')
        .delete()
        .eq('ticket_id', ticketId);

      if (deleteError) {
        console.error('[appointment] Failed to remove confirmed technicians:', deleteError);
      } else {
        console.log(
          `[appointment] Removed confirmed technicians for ticket ${ticketId} due to unapproval`
        );

        // Log audit for removed confirmations
        await logTicketAudit({
          ticketId,
          action: 'technician_unconfirmed',
          changedBy: 'system',
          newValues: {
            reason: 'appointment_edited',
            appointment_id: id,
          },
          metadata: {
            old_appointment_date: oldAppointmentDate,
          },
        }).catch((err) => {
          console.error('[appointment] Failed to log audit for technician removal:', err);
        });
      }
    }

    return data as Appointment;
  }

  /**
   * Approves or unapproves an appointment with optional updates
   *
   * Sets is_approved based on input (defaults to true if not provided).
   * Also updates any provided appointment fields (date, time, type).
   * Creates notifications for confirmed technicians.
   *
   * @param id - UUID of the appointment to approve
   * @param appointmentData - Approval status and optional field updates
   * @param approvedBy - Employee ID of the approver (for audit logging)
   * @returns The updated appointment
   * @throws {NotFoundError} If appointment doesn't exist
   * @throws {DatabaseError} If database update fails
   */
  static async approve(
    id: string,
    appointmentData: Partial<ApproveAppointmentInput>,
    approvedBy?: string
  ): Promise<Appointment> {
    const supabase = createServiceClient();

    // Get current appointment state and linked ticket for audit logging
    const [appointmentResult, ticketResult] = await Promise.all([
      supabase.from('main_appointments').select('*').eq('id', id).single(),
      supabase.from('main_tickets').select('id').eq('appointment_id', id).maybeSingle(),
    ]);

    const oldAppointment = appointmentResult.data as Appointment | null;
    const ticketId = ticketResult.data?.id || null;
    const wasApproved = oldAppointment?.is_approved;

    // Build update data - use provided is_approved or default to true
    const updateData: Partial<Appointment> = {
      is_approved: appointmentData.is_approved !== undefined ? appointmentData.is_approved : true,
    };

    // Add optional field updates
    if (appointmentData.appointment_date !== undefined) {
      updateData.appointment_date = appointmentData.appointment_date;
    }
    if (appointmentData.appointment_time_start !== undefined) {
      updateData.appointment_time_start = appointmentData.appointment_time_start;
    }
    if (appointmentData.appointment_time_end !== undefined) {
      updateData.appointment_time_end = appointmentData.appointment_time_end;
    }
    if (appointmentData.appointment_type !== undefined) {
      updateData.appointment_type = appointmentData.appointment_type;
    }

    const { data, error } = await supabase
      .from('main_appointments')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new DatabaseError(error.message);
    if (!data) throw new NotFoundError('ไม่พบข้อมูลการนัดหมาย');

    const updatedAppointment = data as Appointment;

    // Log audit and send notifications if we have ticket and approver info
    if (ticketId && approvedBy) {
      const isApproved = updatedAppointment.is_approved;
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
          appointment_date: updatedAppointment.appointment_date,
          appointment_time_start: updatedAppointment.appointment_time_start,
          appointment_time_end: updatedAppointment.appointment_time_end,
          appointment_type: updatedAppointment.appointment_type,
        },
        metadata: {
          appointment_id: id,
        },
      });

      // Create notifications for confirmed technicians (async, don't wait)
      NotificationService.createApprovalNotifications(ticketId, isApproved, approvedBy).catch(
        (err) => {
          console.error('[appointment] Failed to create approval notifications:', err);
        }
      );
    }

    return updatedAppointment;
  }

  /**
   * Deletes an appointment
   *
   * Also clears the appointment_id from any linked ticket.
   *
   * @param id - UUID of the appointment to delete
   * @throws {DatabaseError} If database delete fails
   */
  static async delete(id: string): Promise<void> {
    const supabase = createServiceClient();

    // Find ticket linked to this appointment (to clear the reference)
    const { data: ticket } = await supabase
      .from('main_tickets')
      .select('id')
      .eq('appointment_id', id)
      .maybeSingle();

    // Delete appointment
    const { error: deleteError } = await supabase
      .from('main_appointments')
      .delete()
      .eq('id', id);

    if (deleteError) throw new DatabaseError(deleteError.message);

    // Clear ticket's appointment_id if it was linked
    if (ticket?.id) {
      const { error: ticketError } = await supabase
        .from('main_tickets')
        .update({ appointment_id: null })
        .eq('id', ticket.id);

      if (ticketError) {
        // Log error but don't fail - appointment was deleted successfully
        console.error('[appointment] Failed to clear ticket appointment_id:', ticketError);
      }
    }
  }

  /**
   * Searches appointments by appointment type
   *
   * @param query - Search query string
   * @returns Array of matching appointments (max 20)
   * @throws {DatabaseError} If database query fails
   */
  static async search(query: string): Promise<Appointment[]> {
    const supabase = createServiceClient();

    if (!query || query.length < 1) {
      return [];
    }

    // Search by appointment_type (notes column doesn't exist)
    const { data, error } = await supabase
      .from('main_appointments')
      .select('*')
      .ilike('appointment_type', `%${query}%`)
      .limit(20)
      .order('appointment_date', { ascending: false });

    if (error) throw new DatabaseError(error.message);

    return (data as Appointment[]) || [];
  }
}

// Re-export for backward compatibility
export type { ListAppointmentsParams as AppointmentQueryParams } from '../types.ts';
