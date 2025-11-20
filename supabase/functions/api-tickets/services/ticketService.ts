/**
 * Ticket service - Business logic for ticket operations
 */

import { createServiceClient } from '../_shared/supabase.ts';
import { NotFoundError, DatabaseError, ValidationError } from '../_shared/error.ts';
import { calculatePagination } from '../_shared/response.ts';
import type { PaginationInfo } from '../_shared/response.ts';

export interface TicketQueryParams {
  page: number;
  limit: number;
  status_id?: string;
  work_type_id?: string;
  employee_id?: string;
  site_id?: string;
  start_date?: string;
  end_date?: string;
  exclude_backlog?: boolean; // Exclude tickets with appointment_type = 'backlog'
  only_backlog?: boolean; // Only return tickets with appointment_id = NULL (backlog tickets)
}

export class TicketService {
  /**
   * Get appointment IDs in the specified date range and/or excluding backlog
   */
  private static async getAppointmentIdsInRange(startDate?: string, endDate?: string, excludeBacklog?: boolean): Promise<string[]> {
    if (!startDate && !endDate && !excludeBacklog) {
      return []; // No filter, return empty to indicate no filtering needed
    }
    
    const supabaseForAppointments = createServiceClient();
    let appointmentQuery = supabaseForAppointments
      .from('appointments')
      .select('id, appointment_date, appointment_type');
    
    if (startDate && endDate && startDate === endDate) {
      // Exact date match - use eq for single day
      appointmentQuery = appointmentQuery.eq('appointment_date', startDate);
    } else {
      // Date range - use gte and lte
      if (startDate) {
        // appointment_date is a DATE type, so use date-only string (YYYY-MM-DD)
        // gte on a DATE type will include the start date
        appointmentQuery = appointmentQuery.gte('appointment_date', startDate);
      }
      if (endDate) {
        // appointment_date is a DATE type, so use date-only string (YYYY-MM-DD)
        // lte on a DATE type will include the end date
        appointmentQuery = appointmentQuery.lte('appointment_date', endDate);
      }
    }
    // Note: excludeBacklog is handled at the ticket level, not appointment level
    // Backlog tickets have appointment_id IS NULL, not appointments with type 'backlog'
    // So we don't filter appointments by type here
    
    const { data: appointments, error } = await appointmentQuery;
    
    if (error) {
      throw new Error(`Failed to fetch appointments: ${error.message}`);
    }
    
    return appointments?.map(a => a.id) || [];
  }

  /**
   * Get all tickets with pagination and filters
   */
  static async getAll(params: TicketQueryParams): Promise<{ data: Record<string, unknown>[]; pagination: PaginationInfo }> {
    const supabase = createServiceClient();
    const { page, limit, ...filters } = params;
    

    // Get appointment IDs if filtering by date range
    const hasDateFilter = filters.start_date || filters.end_date;
    const appointmentIdList = hasDateFilter 
      ? await this.getAppointmentIdsInRange(filters.start_date, filters.end_date, filters.exclude_backlog)
      : [];

    // Get backlog appointment IDs if excluding backlog
    let backlogAppointmentIds: string[] = [];
    if (filters.exclude_backlog && !hasDateFilter) {
      const supabaseForBacklog = createServiceClient();
      const { data: backlogAppts } = await supabaseForBacklog
        .from('appointments')
        .select('id')
        .eq('appointment_type', 'backlog');
      backlogAppointmentIds = backlogAppts?.map(a => a.id) || [];
    }

    // Get total count
    let countQuery = supabase
      .from('tickets')
      .select('*', { count: 'exact', head: true });

    // Apply filters to count query
    if (filters.status_id) {
      countQuery = countQuery.eq('status_id', filters.status_id);
    }
    if (filters.work_type_id) {
      countQuery = countQuery.eq('work_type_id', filters.work_type_id);
    }
    if (filters.site_id) {
      countQuery = countQuery.eq('site_id', filters.site_id);
    }
    
    // Filter by date range (requires appointment in date range)
    if (hasDateFilter) {
      if (appointmentIdList.length > 0) {
        // Include tickets with appointments in date range
        // If exclude_backlog is false, also include ALL backlog tickets (no date filter for backlog)
        if (filters.exclude_backlog === false) {
          // Include both: tickets with appointments in range AND all backlog tickets (appointment_id IS NULL)
          countQuery = countQuery.or(`appointment_id.in.(${appointmentIdList.join(',')}),appointment_id.is.null`);
        } else {
          // Only include tickets with appointments in range (exclude backlog)
          countQuery = countQuery.in('appointment_id', appointmentIdList);
        }
      } else {
        // No appointments in range
        if (filters.exclude_backlog === false) {
          // Include all backlog tickets (no date filter - backlog has no dates)
          countQuery = countQuery.is('appointment_id', null);
        } else {
          // No appointments in range and excluding backlog, return empty result
          countQuery = countQuery.eq('id', '00000000-0000-0000-0000-000000000000'); // Impossible ID
        }
      }
    }
    // Only return backlog tickets (tickets with appointment_id = NULL)
    else if (filters.only_backlog) {
      countQuery = countQuery.is('appointment_id', null);
    }
    // Exclude backlog tickets (exclude tickets with backlog appointments)
    else if (filters.exclude_backlog) {
      if (backlogAppointmentIds.length > 0) {
        // Exclude tickets with these backlog appointment IDs
        // Using or() with is to also include tickets without appointments (null appointment_id)
        countQuery = countQuery.or(`appointment_id.not.in.(${backlogAppointmentIds.join(',')}),appointment_id.is.null`);
      }
      // If no backlog appointments exist, all tickets are included
    }

    const { count, error: countError } = await countQuery;

    if (countError) throw new DatabaseError(countError.message);

    const total = count ?? 0;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    // Get paginated data
    let dataQuery = supabase
      .from('tickets')
      .select(`
        id,
        details,
        work_type_id,
        assigner_id,
        status_id,
        additional,
        created_at,
        updated_at,
        site_id,
        contact_id,
        work_result_id,
        appointment_id,
        work_type:work_types(*),
        assigner:employees!tickets_assigner_id_fkey(*),
        status:ticket_statuses(*),
        site:sites(
          *,
          company:companies(*)
        ),
        contact:contacts(*),
        appointment:appointments!tickets_appointment_id_fkey(*),
        employees:ticket_employees(
          employee:employees(*)
        )
      `)
      .order('created_at', { ascending: false })
      .range(from, to);

    // Apply filters to data query
    if (filters.status_id) {
      dataQuery = dataQuery.eq('status_id', filters.status_id);
    }
    if (filters.work_type_id) {
      dataQuery = dataQuery.eq('work_type_id', filters.work_type_id);
    }
    if (filters.site_id) {
      dataQuery = dataQuery.eq('site_id', filters.site_id);
    }
    
    // Filter by date range (requires appointment in date range)
    if (hasDateFilter) {
      if (appointmentIdList.length > 0) {
        // Include tickets with appointments in date range
        // If exclude_backlog is false, also include ALL backlog tickets (no date filter for backlog)
        if (filters.exclude_backlog === false) {
          // Include both: tickets with appointments in range AND all backlog tickets (appointment_id IS NULL)
          dataQuery = dataQuery.or(`appointment_id.in.(${appointmentIdList.join(',')}),appointment_id.is.null`);
        } else {
          // Only include tickets with appointments in range (exclude backlog)
          dataQuery = dataQuery.in('appointment_id', appointmentIdList);
        }
      } else {
        // No appointments in range
        if (filters.exclude_backlog === false) {
          // Include all backlog tickets (no date filter - backlog has no dates)
          dataQuery = dataQuery.is('appointment_id', null);
        } else {
          // No appointments in range and excluding backlog, return empty result
          dataQuery = dataQuery.eq('id', '00000000-0000-0000-0000-000000000000'); // Impossible ID
        }
      }
    }
    // Only return backlog tickets (tickets with appointment_id = NULL)
    else if (filters.only_backlog) {
      dataQuery = dataQuery.is('appointment_id', null);
    }
    // Exclude backlog tickets (exclude tickets with backlog appointments)
    else if (filters.exclude_backlog) {
      if (backlogAppointmentIds.length > 0) {
        // Exclude tickets with these backlog appointment IDs
        // Using or() with is to also include tickets without appointments (null appointment_id)
        dataQuery = dataQuery.or(`appointment_id.not.in.(${backlogAppointmentIds.join(',')}),appointment_id.is.null`);
      }
      // If no backlog appointments exist, all tickets are included
    }

    const { data, error } = await dataQuery;

    if (error) throw new DatabaseError(error.message);


    // Transform data to flatten employees array
    const transformedData = (data || []).map(ticket => ({
      ...ticket,
      time: ticket.created_at, // Map created_at to time for frontend compatibility
      employees: Array.isArray(ticket.employees)
        ? ticket.employees.map((te: Record<string, unknown>) => (te as { employee: Record<string, unknown> }).employee).filter(Boolean)
        : []
    }));

    return {
      data: transformedData,
      pagination: calculatePagination(page, limit, total),
    };
  }

  /**
   * Get single ticket by ID
   */
  static async getById(id: string): Promise<Record<string, unknown>> {
    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from('tickets')
      .select(`
        id,
        details,
        work_type_id,
        assigner_id,
        status_id,
        additional,
        created_at,
        updated_at,
        site_id,
        contact_id,
        work_result_id,
        appointment_id,
        work_type:work_types(*),
        assigner:employees!tickets_assigner_id_fkey(*),
        status:ticket_statuses(*),
        site:sites(
          *,
          company:companies(*)
        ),
        contact:contacts(*),
        appointment:appointments!tickets_appointment_id_fkey(*),
        employees:ticket_employees(
          employee:employees(*)
        )
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new NotFoundError('ไม่พบตั๋วงาน');
      }
      throw new DatabaseError(error.message);
    }

    if (!data) {
      throw new NotFoundError('ไม่พบตั๋วงาน');
    }

    // Transform data to flatten employees array
    return {
      ...data,
      time: data.created_at, // Map created_at to time for frontend compatibility
      employees: Array.isArray(data.employees)
        ? data.employees.map((te: Record<string, unknown>) => (te as { employee: Record<string, unknown> }).employee).filter(Boolean)
        : []
    };
  }

  /**
   * Get tickets by employee ID
   */
  static async getByEmployee(
    employeeId: string,
    params: TicketQueryParams
  ): Promise<{ data: Record<string, unknown>[]; pagination: PaginationInfo }> {
    const supabase = createServiceClient();
    const { page, limit } = params;

    // First get ticket IDs assigned to this employee
    const { data: ticketEmployees, error: teError } = await supabase
      .from('ticket_employees')
      .select('ticket_id')
      .eq('employee_id', employeeId);

    if (teError) throw new DatabaseError(teError.message);

    if (!ticketEmployees || ticketEmployees.length === 0) {
      return {
        data: [],
        pagination: calculatePagination(page, limit, 0),
      };
    }

    const ticketIds = ticketEmployees.map(te => te.ticket_id);
    const total = ticketIds.length;

    // Calculate pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    const paginatedIds = ticketIds.slice(from, to + 1);

    if (paginatedIds.length === 0) {
      return {
        data: [],
        pagination: calculatePagination(page, limit, total),
      };
    }

    // Get full ticket data
    const { data, error } = await supabase
      .from('tickets')
      .select(`
        id,
        details,
        work_type_id,
        assigner_id,
        status_id,
        additional,
        created_at,
        updated_at,
        site_id,
        contact_id,
        work_result_id,
        appointment_id,
        work_type:work_types(*),
        assigner:employees!tickets_assigner_id_fkey(*),
        status:ticket_statuses(*),
        site:sites(
          *,
          company:companies(*)
        ),
        contact:contacts(*),
        appointment:appointments!tickets_appointment_id_fkey(*),
        employees:ticket_employees(
          employee:employees(*)
        )
      `)
      .in('id', paginatedIds)
      .order('created_at', { ascending: false });

    if (error) throw new DatabaseError(error.message);

    // Transform data
    const transformedData = (data || []).map(ticket => ({
      ...ticket,
      employees: Array.isArray(ticket.employees) 
        ? ticket.employees.map((te: Record<string, unknown>) => (te as { employee: Record<string, unknown> }).employee).filter(Boolean) 
        : []
    }));

    return {
      data: transformedData,
      pagination: calculatePagination(page, limit, total),
    };
  }

  /**
   * Create new ticket
   */
  static async create(
    ticketData: Record<string, unknown>, 
    employeeIds: string[],
    appointmentData?: Record<string, unknown> | null
  ): Promise<Record<string, unknown>> {
    const supabase = createServiceClient();

    // Insert ticket
    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .insert([ticketData])
      .select()
      .single();

    if (ticketError) throw new DatabaseError(ticketError.message);
    if (!ticket) throw new DatabaseError('Failed to create ticket');

    // Create appointment if provided
    if (appointmentData) {
      const { data: appointment, error: appointmentError } = await supabase
        .from('appointments')
        .insert([{
          ...appointmentData,
          ticket_id: ticket.id,
        }])
        .select()
        .single();

      if (appointmentError) throw new DatabaseError(appointmentError.message);
      if (!appointment) throw new DatabaseError('Failed to create appointment');

      // Update ticket with appointment_id
      const { error: updateError } = await supabase
        .from('tickets')
        .update({ appointment_id: appointment.id })
        .eq('id', ticket.id);

      if (updateError) {
        console.error('Failed to update ticket appointment_id:', updateError);
        // Don't fail the whole operation, but log the error
      } else {
        // Update the ticket object with appointment_id for return value
        ticket.appointment_id = appointment.id;
      }
    }

    // Create ticket_employees relationships
    if (employeeIds.length > 0) {
      const { error: relationError } = await supabase
        .from('ticket_employees')
        .insert(
          employeeIds.map(employeeId => ({
            ticket_id: ticket.id,
            employee_id: employeeId
          }))
        );

      if (relationError) throw new DatabaseError(relationError.message);
    }

    return ticket;
  }

  /**
   * Update existing ticket
   */
  static async update(id: string, ticketData: Record<string, unknown>, employeeIds?: string[], merchandiseIds?: string[]): Promise<Record<string, unknown>> {
    const supabase = createServiceClient();

    // Filter out appointment fields that don't belong in tickets table
    const appointmentFields = [
      'customer_appointment_type',
      'customer_appointment_time_start',
      'customer_appointment_time_end',
      'appointment_type',
      'appointment_date',
      'appointment_time_start',
      'appointment_time_end',
    ];
    
    const cleanedTicketData = Object.fromEntries(
      Object.entries(ticketData).filter(([key]) => !appointmentFields.includes(key))
    );

    // Update ticket
    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .update(cleanedTicketData)
      .eq('id', id)
      .select()
      .single();

    if (ticketError) throw new DatabaseError(ticketError.message);

    // Update employee assignments if provided
    if (employeeIds !== undefined) {
      // Delete existing assignments
      const { error: deleteError } = await supabase
        .from('ticket_employees')
        .delete()
        .eq('ticket_id', id);

      if (deleteError) throw new DatabaseError(deleteError.message);

      // Insert new assignments
      if (employeeIds.length > 0) {
        const uniqueEmployeeIds = [...new Set(employeeIds)];
        
        const { error: relationError } = await supabase
          .from('ticket_employees')
          .insert(
            uniqueEmployeeIds.map(employeeId => ({
              ticket_id: id,
              employee_id: employeeId
            }))
          );

        if (relationError) throw new DatabaseError(relationError.message);
      }
    }

    // Update merchandise associations if provided
    if (merchandiseIds !== undefined) {
      // Delete existing merchandise associations
      const { error: deleteMerchError } = await supabase
        .from('ticket_merchandise')
        .delete()
        .eq('ticket_id', id);

      if (deleteMerchError) throw new DatabaseError(deleteMerchError.message);

      // Insert new associations with validation
      if (merchandiseIds.length > 0) {
        const uniqueMerchandiseIds = [...new Set(merchandiseIds)];

        // Validate all merchandise exist and are in the same site
        for (const merchandiseId of uniqueMerchandiseIds) {
          const { data: merchandise, error: merchError } = await supabase
            .from('merchandise')
            .select('id, site_id')
            .eq('id', merchandiseId)
            .single();

          if (merchError) throw new DatabaseError(`ไม่สามารถดึงข้อมูลอุปกรณ์ ${merchandiseId} ได้`);
          if (!merchandise) throw new NotFoundError(`ไม่พบอุปกรณ์ ${merchandiseId}`);

          // Validate site match if ticket has a site
          if (ticket.site_id && merchandise.site_id && ticket.site_id !== merchandise.site_id) {
            throw new ValidationError(`อุปกรณ์ ${merchandiseId} ต้องอยู่ในสถานที่เดียวกับตั๋วงาน`);
          }
        }

        // Insert all associations
        const { error: insertError } = await supabase
          .from('ticket_merchandise')
          .insert(
            uniqueMerchandiseIds.map(merchandiseId => ({
              ticket_id: id,
              merchandise_id: merchandiseId
            }))
          );

        if (insertError) {
          // Check for site mismatch error from trigger
          if (insertError.message.includes('same site')) {
            throw new ValidationError('อุปกรณ์ต้องอยู่ในสถานที่เดียวกับตั๋วงาน');
          }
          throw new DatabaseError(insertError.message);
        }
      }
    }

    return ticket;
  }

  /**
   * Delete ticket
   */
  static async delete(id: string): Promise<void> {
    const supabase = createServiceClient();

    const { error } = await supabase
      .from('tickets')
      .delete()
      .eq('id', id);

    if (error) throw new DatabaseError(error.message);
  }

  /**
   * Get merchandise linked to a ticket
   */
  static async getMerchandise(ticketId: string): Promise<Record<string, unknown>[]> {
    const supabase = createServiceClient();

    // First verify ticket exists
    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .select('id')
      .eq('id', ticketId)
      .single();

    if (ticketError) {
      throw new DatabaseError('ไม่สามารถดึงข้อมูลตั๋วงานได้');
    }

    if (!ticket) {
      throw new NotFoundError('ไม่พบตั๋วงาน');
    }

    // Get merchandise with full details
    const { data, error } = await supabase
      .from('ticket_merchandise')
      .select(`
        id,
        created_at,
        merchandise:merchandise_id (
          id,
          serial_no,
          model_id,
          site_id,
          pm_count,
          distributor_id,
          dealer_id,
          replaced_by_id,
          created_at,
          updated_at,
          model:models!merchandise_model_id_fkey (
            id,
            model,
            name,
            website_url
          ),
          site:sites!merchandise_site_id_fkey (
            id,
            name
          )
        )
      `)
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new DatabaseError('ไม่สามารถดึงข้อมูลอุปกรณ์ได้');
    }

    return data || [];
  }

  /**
   * Add merchandise to ticket
   * Returns the association and a flag indicating if it was newly created
   */
  static async addMerchandise(ticketId: string, merchandiseId: string): Promise<{ data: Record<string, unknown>; created: boolean }> {
    const supabase = createServiceClient();

    // Verify ticket exists
    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .select('id, site_id')
      .eq('id', ticketId)
      .single();

    if (ticketError) {
      throw new DatabaseError('ไม่สามารถดึงข้อมูลตั๋วงานได้');
    }

    if (!ticket) {
      throw new NotFoundError('ไม่พบตั๋วงาน');
    }

    // Verify merchandise exists
    const { data: merchandise, error: merchandiseError } = await supabase
      .from('merchandise')
      .select('id, site_id')
      .eq('id', merchandiseId)
      .single();

    if (merchandiseError) {
      throw new DatabaseError('ไม่สามารถดึงข้อมูลอุปกรณ์ได้');
    }

    if (!merchandise) {
      throw new NotFoundError('ไม่พบอุปกรณ์');
    }

    // Validate site match (database trigger will also enforce this, but we check here for better error messages)
    if (ticket.site_id && merchandise.site_id && ticket.site_id !== merchandise.site_id) {
      throw new ValidationError('อุปกรณ์ต้องอยู่ในสถานที่เดียวกับตั๋วงาน');
    }

    // Check if already linked - if so, return existing association (idempotent)
    const { data: existing, error: checkError } = await supabase
      .from('ticket_merchandise')
      .select(`
        id,
        created_at,
        merchandise:merchandise_id (
          id,
          serial_no,
          model_id,
          site_id,
          pm_count,
          distributor_id,
          dealer_id,
          replaced_by_id,
          created_at,
          updated_at,
          model:models!merchandise_model_id_fkey (
            id,
            model,
            name,
            website_url
          ),
          site:sites!merchandise_site_id_fkey (
            id,
            name
          )
        )
      `)
      .eq('ticket_id', ticketId)
      .eq('merchandise_id', merchandiseId)
      .single();

    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows returned
      throw new DatabaseError('ไม่สามารถตรวจสอบข้อมูลได้');
    }

    // If already linked, return existing association (idempotent operation)
    if (existing) {
      return { data: existing, created: false };
    }

    // Insert new association
    const { data, error } = await supabase
      .from('ticket_merchandise')
      .insert({
        ticket_id: ticketId,
        merchandise_id: merchandiseId,
      })
      .select(`
        id,
        created_at,
        merchandise:merchandise_id (
          id,
          serial_no,
          model_id,
          site_id,
          pm_count,
          distributor_id,
          dealer_id,
          replaced_by_id,
          created_at,
          updated_at,
          model:models!merchandise_model_id_fkey (
            id,
            model,
            name,
            website_url
          ),
          site:sites!merchandise_site_id_fkey (
            id,
            name
          )
        )
      `)
      .single();

    if (error) {
      // Check for site mismatch error from trigger
      if (error.message.includes('same site')) {
        throw new ValidationError('อุปกรณ์ต้องอยู่ในสถานที่เดียวกับตั๋วงาน');
      }
      throw new DatabaseError('ไม่สามารถเชื่อมโยงอุปกรณ์ได้');
    }

    return { data, created: true };
  }

  /**
   * Remove merchandise from ticket
   */
  static async removeMerchandise(ticketId: string, merchandiseId: string): Promise<void> {
    const supabase = createServiceClient();

    // Verify ticket exists
    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .select('id')
      .eq('id', ticketId)
      .single();

    if (ticketError) {
      throw new DatabaseError('ไม่สามารถดึงข้อมูลตั๋วงานได้');
    }

    if (!ticket) {
      throw new NotFoundError('ไม่พบตั๋วงาน');
    }

    // Delete association
    const { error } = await supabase
      .from('ticket_merchandise')
      .delete()
      .eq('ticket_id', ticketId)
      .eq('merchandise_id', merchandiseId);

    if (error) {
      throw new DatabaseError('ไม่สามารถลบการเชื่อมโยงได้');
    }
  }

  /**
   * Search tickets by ticket number or description
   */
  static async search(query: string): Promise<Record<string, unknown>[]> {
    const supabase = createServiceClient();

    if (!query || query.length < 1) {
      return [];
    }

    const { data, error } = await supabase
      .from('tickets')
      .select('*')
      .or(`ticket_number.ilike.%${query}%,description.ilike.%${query}%`)
      .limit(20)
      .order('created_at', { ascending: false });

    if (error) throw new DatabaseError(error.message);

    return data || [];
  }
}

