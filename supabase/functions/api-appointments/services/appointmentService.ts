/**
 * Appointment service - Business logic for appointment operations
 */

import { createServiceClient } from '../_shared/supabase.ts';
import { NotFoundError, DatabaseError } from '../_shared/error.ts';
import { calculatePagination } from '../_shared/response.ts';
import type { PaginationInfo } from '../_shared/response.ts';

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
    let countQuery = supabase.from('appointments').select('*', { count: 'exact', head: true });
    if (ticket_id) countQuery = countQuery.eq('ticket_id', ticket_id);

    const { count, error: countError } = await countQuery;
    if (countError) throw new DatabaseError(countError.message);

    const total = count ?? 0;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    // Data query
    let dataQuery = supabase
      .from('appointments')
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
      .from('appointments')
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
      .from('appointments')
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
      .from('appointments')
      .insert([appointmentData])
      .select()
      .single();

    if (appointmentError) throw new DatabaseError(appointmentError.message);
    if (!appointment) throw new DatabaseError('Failed to create appointment');

    // Update ticket's appointment_id if ticket_id is provided
    if (appointment.ticket_id) {
      const { error: ticketError } = await supabase
        .from('tickets')
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
      .from('appointments')
      .update(appointmentData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new DatabaseError(error.message);
    if (!data) throw new NotFoundError('ไม่พบข้อมูลการนัดหมาย');

    return data;
  }

  static async delete(id: string): Promise<void> {
    const supabase = createServiceClient();
    
    // Get appointment to find associated ticket
    const { data: appointment } = await supabase
      .from('appointments')
      .select('ticket_id')
      .eq('id', id)
      .single();

    // Delete appointment
    const { error: deleteError } = await supabase
      .from('appointments')
      .delete()
      .eq('id', id);

    if (deleteError) throw new DatabaseError(deleteError.message);

    // Clear ticket's appointment_id if it was set
    if (appointment?.ticket_id) {
      const { error: ticketError } = await supabase
        .from('tickets')
        .update({ appointment_id: null })
        .eq('id', appointment.ticket_id)
        .eq('appointment_id', id);

      if (ticketError) {
        // Log error but don't fail - appointment was deleted successfully
        console.error('Failed to clear ticket appointment_id:', ticketError);
      }
    }
  }
}

