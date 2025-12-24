/**
 * Ticket search service - Business logic for searching tickets
 */

import { createServiceClient } from '../_shared/supabase.ts';
import { NotFoundError, DatabaseError, ValidationError } from '../_shared/error.ts';
import { calculatePagination } from '../_shared/response.ts';
import type { PaginationInfo } from '../_shared/response.ts';
import type { DateType } from './ticketTypes.ts';

/**
 * Get single ticket by ID with full details (site, appointment)
 */
export async function getById(id: string): Promise<Record<string, unknown>> {
  const supabase = createServiceClient();

  // Get ticket with all related data
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
      created_by,
      site_id,
      contact_id,
      appointment_id,
      work_type:work_types(*),
      assigner:employees!tickets_assigner_id_fkey(*),
      creator:employees!tickets_created_by_fkey(*),
      status:ticket_statuses(*),
      site:sites(
        *,
        company:companies(*)
      ),
      contact:contacts(*),
      appointment:appointments!tickets_appointment_id_fkey(*),
      appointment_by_ticket:appointments!appointments_ticket_id_fkey(*),
      employees:ticket_employees(
        employee:employees(*)
      ),
      merchandise:ticket_merchandise(
        merchandise:merchandise(
          *,
          model:models(*)
        )
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
  const creator = data.creator as { name?: string; code?: string } | null;
  const merchandise = Array.isArray(data.merchandise)
    ? data.merchandise.map((tm: Record<string, unknown>) => {
        const merch = (tm as { merchandise: Record<string, unknown> }).merchandise;
        return merch || null;
      }).filter(Boolean)
    : [];
  
  // Extract appointment data (try appointment_id first, then ticket_id)
  const appointmentById = data.appointment as { 
    id?: string;
    appointment_date?: string;
    appointment_time_start?: string;
    appointment_time_end?: string;
    appointment_type?: string;
    is_approved?: boolean;
  } | null;
  const appointmentByTicketId = data.appointment_by_ticket as { 
    id?: string;
    appointment_date?: string;
    appointment_time_start?: string;
    appointment_time_end?: string;
    appointment_type?: string;
    is_approved?: boolean;
  } | null;
  const appointment = appointmentById || appointmentByTicketId;
  
  return {
    ...data,
    time: data.created_at, // Map created_at to time for frontend compatibility
    employees: Array.isArray(data.employees)
      ? data.employees.map((te: Record<string, unknown>) => (te as { employee: Record<string, unknown> }).employee).filter(Boolean)
      : [],
    creator_name: creator?.name || null,
    creator_code: creator?.code || null,
    merchandise: merchandise,
    // Add appointment_is_approved as top-level field for consistency with search
    appointment_is_approved: appointment?.is_approved ?? null,
  };
}

/**
 * Search tickets with filters for all ticket fields (paginated)
 */
export async function search(params: {
  page: number;
  limit: number;
  id?: string;
  details?: string;
  work_type_id?: string;
  assigner_id?: string;
  status_id?: string;
  additional?: string;
  site_id?: string;
  contact_id?: string;
  appointment_id?: string;
  created_at?: string; // Date string (YYYY-MM-DD) or range
  updated_at?: string; // Date string (YYYY-MM-DD) or range
  start_date?: string; // Start date for appointment date filtering (YYYY-MM-DD)
  end_date?: string; // End date for appointment date filtering (YYYY-MM-DD)
  exclude_backlog?: boolean; // Exclude tickets with appointment_id = NULL
  appointment_is_approved?: boolean; // Filter by appointment approval status (true/false)
  department_id?: string | string[]; // Single department_id or array of department_ids
  employee_id?: string | string[]; // Single employee_id or array of employee_ids (filters tickets assigned to these employees)
  sort?: string; // Sort field: 'created_at', 'updated_at', 'appointment_date'
  order?: 'asc' | 'desc'; // Sort order: 'asc' or 'desc'
}): Promise<{ data: Record<string, unknown>[]; pagination: PaginationInfo }> {
  const supabase = createServiceClient();
  const { page, limit, sort, order, ...filters } = params;

  // Helper function to transform ticket data
  const transformTicket = (ticket: Record<string, unknown>) => {
    const workType = ticket.work_type as { name?: string; code?: string } | null;
    const assigner = ticket.assigner as { name?: string; code?: string } | null;
    const creator = ticket.creator as { name?: string; code?: string } | null;
    const status = ticket.status as { name?: string; code?: string } | null;
    const site = ticket.site as { 
      id?: string; 
      name?: string;
      province_code?: number | null;
      district_code?: number | null;
      subdistrict_code?: number | null;
      company?: Record<string, unknown> | null;
    } | null;
    const contact = ticket.contact as { person_name?: string } | null;
    // Try appointment via appointment_id first, then via ticket_id (fallback for old tickets)
    const appointmentById = ticket.appointment as { 
      id?: string;
      appointment_date?: string;
      appointment_time_start?: string;
      appointment_time_end?: string;
      appointment_type?: string;
      is_approved?: boolean;
    } | null;
    const appointmentByTicketId = ticket.appointment_by_ticket as { 
      id?: string;
      appointment_date?: string;
      appointment_time_start?: string;
      appointment_time_end?: string;
      appointment_type?: string;
      is_approved?: boolean;
    } | null;
    // Use appointment from appointment_id if available, otherwise use from ticket_id
    const appointment = appointmentById || appointmentByTicketId;
    const employees = Array.isArray(ticket.employees) 
      ? ticket.employees.map((te: Record<string, unknown>) => (te as { employee: Record<string, unknown> }).employee).filter(Boolean) as Array<{ name?: string }>
      : [];

    return {
      id: ticket.id,
      details: ticket.details,
      work_type_name: workType?.name || null,
      work_type_code: workType?.code || null,
      assigner_name: assigner?.name || null,
      assigner_code: assigner?.code || null,
      creator_name: creator?.name || null,
      creator_code: creator?.code || null,
      created_by: ticket.created_by || null,
      status_name: status?.name || null,
      status_code: status?.code || null,
      additional: ticket.additional,
      created_at: ticket.created_at,
      updated_at: ticket.updated_at,
      site_name: site?.name || null,
      company: site?.company || null,
      company_name: (site?.company as { name_th?: string; name_en?: string } | undefined)?.name_th || (site?.company as { name_th?: string; name_en?: string } | undefined)?.name_en || null,
      provinceCode: site?.province_code || null,
      districtCode: site?.district_code || null,
      subDistrictCode: site?.subdistrict_code || null,
      contact_name: contact?.person_name || null,
      appointment_id: appointment?.id || ticket.appointment_id || null,
      appointment_date: appointment?.appointment_date || null,
      appointment_time_start: appointment?.appointment_time_start || null,
      appointment_time_end: appointment?.appointment_time_end || null,
      appointment_type: appointment?.appointment_type || null,
      appointment_is_approved: appointment?.is_approved ?? null,
      employee_names: employees.map(emp => emp.name).filter(Boolean),
      employee_count: employees.length,
      merchandise: Array.isArray(ticket.merchandise)
        ? ticket.merchandise.map((tm: Record<string, unknown>) => {
            const merch = (tm as { merchandise: Record<string, unknown> }).merchandise;
            const model = merch?.model as { model?: string } | null;
            return {
              id: merch?.id || null,
              serial: merch?.serial_no || null,
              model: model?.model || null,
            };
          }).filter(Boolean)
        : [],
      merchandise_count: Array.isArray(ticket.merchandise) ? ticket.merchandise.length : 0,
    };
  };

  // Build count query
  let countQuery = supabase
    .from('tickets')
    .select('*', { count: 'exact', head: true });

  // Build data query
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
      created_by,
      site_id,
      contact_id,
      appointment_id,
      work_type:work_types(*),
      assigner:employees!tickets_assigner_id_fkey(*),
      creator:employees!tickets_created_by_fkey(*),
      status:ticket_statuses(*),
      site:sites(
        *,
        company:companies(*)
      ),
      contact:contacts(*),
      appointment:appointments!tickets_appointment_id_fkey(*),
      appointment_by_ticket:appointments!appointments_ticket_id_fkey(*),
      employees:ticket_employees(
        employee:employees(*)
      ),
      merchandise:ticket_merchandise(
        merchandise:merchandise(
          id,
          serial_no,
          model:models(model)
        )
      )
    `);

  // Apply filters
  if (filters.id) {
    countQuery = countQuery.eq('id', filters.id);
    dataQuery = dataQuery.eq('id', filters.id);
  }
  if (filters.details) {
    // Search in ticket details, company names, and site names
    // Step 1: Find companies matching the search term
    // Search Thai and English names separately to ensure both work correctly
    const searchTerm = filters.details;
    const allCompanyTaxIds = new Set<string>();

    // Search by Thai name
    const { data: companiesByThai, error: thaiError } = await supabase
      .from('companies')
      .select('tax_id')
      .ilike('name_th', `%${searchTerm}%`);

    if (thaiError) {
      throw new DatabaseError(`ไม่สามารถค้นหาบริษัทตามชื่อไทยได้: ${thaiError.message}`);
    }

    if (companiesByThai) {
      companiesByThai.forEach(c => allCompanyTaxIds.add(c.tax_id as string));
    }

    // Search by English name
    const { data: companiesByEnglish, error: englishError } = await supabase
      .from('companies')
      .select('tax_id')
      .ilike('name_en', `%${searchTerm}%`);

    if (englishError) {
      throw new DatabaseError(`ไม่สามารถค้นหาบริษัทตามชื่ออังกฤษได้: ${englishError.message}`);
    }

    if (companiesByEnglish) {
      companiesByEnglish.forEach(c => allCompanyTaxIds.add(c.tax_id as string));
    }

    const companyTaxIds = Array.from(allCompanyTaxIds);
    let companySiteIds: string[] = [];

    if (companyTaxIds.length > 0) {
      // Step 2: Find sites that belong to these companies
      const { data: sites, error: siteError } = await supabase
        .from('sites')
        .select('id')
        .in('company_id', companyTaxIds);

      if (siteError) {
        throw new DatabaseError(`ไม่สามารถค้นหาไซต์ตามบริษัทได้: ${siteError.message}`);
      }

      companySiteIds = (sites || []).map(s => s.id as string);
    }

    // Step 3: Find sites matching the search term by name
    const { data: sitesByName, error: siteNameError } = await supabase
      .from('sites')
      .select('id')
      .ilike('name', `%${filters.details}%`);

    if (siteNameError) {
      throw new DatabaseError(`ไม่สามารถค้นหาไซต์ได้: ${siteNameError.message}`);
    }

    const siteNameSiteIds = (sitesByName || []).map(s => s.id as string);

    // Step 4: Combine all site IDs (from company match and site name match)
    const allMatchingSiteIds = [...new Set([...companySiteIds, ...siteNameSiteIds])];

    // Step 5: Get all matching ticket IDs
    // Tickets match if:
    // - id field matches (partial match), OR
    // - details field matches, OR
    // - site_id is in the matching sites list
    const matchingTicketIds: string[] = [];

    // Get tickets matching ID field (partial match)
    // UUID fields don't support ilike directly, so we need to fetch and filter in memory
    // For UUID partial matching, we'll search in the string representation
    const { data: allTickets, error: allError } = await supabase
      .from('tickets')
      .select('id');

    if (allError) {
      throw new DatabaseError(`ไม่สามารถค้นหาตั๋วงานตาม ID ได้: ${allError.message}`);
    }

    if (allTickets) {
      const searchTermLower = filters.details.toLowerCase();
      const matchingIds = allTickets
        .filter(t => (t.id as string).toLowerCase().includes(searchTermLower))
        .map(t => t.id as string);
      matchingTicketIds.push(...matchingIds);
    }

    // Get tickets matching details field
    const { data: ticketsByDetails, error: detailsError } = await supabase
      .from('tickets')
      .select('id')
      .ilike('details', `%${filters.details}%`);

    if (detailsError) {
      throw new DatabaseError(`ไม่สามารถค้นหาตั๋วงานตามรายละเอียดได้: ${detailsError.message}`);
    }

    if (ticketsByDetails) {
      matchingTicketIds.push(...ticketsByDetails.map(t => t.id as string));
    }

    // Get tickets matching site IDs
    if (allMatchingSiteIds.length > 0) {
      const { data: ticketsBySites, error: sitesError } = await supabase
        .from('tickets')
        .select('id')
        .in('site_id', allMatchingSiteIds);

      if (sitesError) {
        throw new DatabaseError(`ไม่สามารถค้นหาตั๋วงานตามไซต์ได้: ${sitesError.message}`);
      }

      if (ticketsBySites) {
        matchingTicketIds.push(...ticketsBySites.map(t => t.id as string));
      }
    }

    // Step 6: Filter by unique ticket IDs
    const uniqueTicketIds = [...new Set(matchingTicketIds)];

    if (uniqueTicketIds.length === 0) {
      // No tickets match, return empty result
      return {
        data: [],
        pagination: calculatePagination(params.page, params.limit, 0),
      };
    }

    // Filter tickets by these IDs
    countQuery = countQuery.in('id', uniqueTicketIds);
    dataQuery = dataQuery.in('id', uniqueTicketIds);
  }
  if (filters.work_type_id) {
    countQuery = countQuery.eq('work_type_id', filters.work_type_id);
    dataQuery = dataQuery.eq('work_type_id', filters.work_type_id);
  }
  if (filters.assigner_id) {
    countQuery = countQuery.eq('assigner_id', filters.assigner_id);
    dataQuery = dataQuery.eq('assigner_id', filters.assigner_id);
  }
  if (filters.status_id) {
    countQuery = countQuery.eq('status_id', filters.status_id);
    dataQuery = dataQuery.eq('status_id', filters.status_id);
  }
  if (filters.additional) {
    countQuery = countQuery.ilike('additional', `%${filters.additional}%`);
    dataQuery = dataQuery.ilike('additional', `%${filters.additional}%`);
  }
  if (filters.site_id) {
    countQuery = countQuery.eq('site_id', filters.site_id);
    dataQuery = dataQuery.eq('site_id', filters.site_id);
  }
  if (filters.contact_id) {
    countQuery = countQuery.eq('contact_id', filters.contact_id);
    dataQuery = dataQuery.eq('contact_id', filters.contact_id);
  }
  if (filters.appointment_id) {
    countQuery = countQuery.eq('appointment_id', filters.appointment_id);
    dataQuery = dataQuery.eq('appointment_id', filters.appointment_id);
  }
  if (filters.created_at) {
    // Support date range format: "YYYY-MM-DD,YYYY-MM-DD" or single date "YYYY-MM-DD"
    const dateParts = filters.created_at.split(',');
    if (dateParts.length === 2) {
      const startDate = dateParts[0].trim();
      const endDate = dateParts[1].trim();
      // If start and end are the same, treat as single date (include full day)
      if (startDate === endDate) {
        const nextDay = new Date(new Date(startDate).getTime() + 24 * 60 * 60 * 1000).toISOString();
        countQuery = countQuery.gte('created_at', startDate).lt('created_at', nextDay);
        dataQuery = dataQuery.gte('created_at', startDate).lt('created_at', nextDay);
      } else {
        // Date range - add time to end date to include the full day
        const endDateTime = `${endDate}T23:59:59.999Z`;
        countQuery = countQuery.gte('created_at', startDate).lte('created_at', endDateTime);
        dataQuery = dataQuery.gte('created_at', startDate).lte('created_at', endDateTime);
      }
    } else {
      // Single date - include full day
      const nextDay = new Date(new Date(filters.created_at).getTime() + 24 * 60 * 60 * 1000).toISOString();
      countQuery = countQuery.gte('created_at', filters.created_at).lt('created_at', nextDay);
      dataQuery = dataQuery.gte('created_at', filters.created_at).lt('created_at', nextDay);
    }
  }
  if (filters.updated_at) {
    // Support date range format: "YYYY-MM-DD,YYYY-MM-DD" or single date "YYYY-MM-DD"
    const dateParts = filters.updated_at.split(',');
    if (dateParts.length === 2) {
      const startDate = dateParts[0].trim();
      const endDate = dateParts[1].trim();
      // If start and end are the same, treat as single date (include full day)
      if (startDate === endDate) {
        const nextDay = new Date(new Date(startDate).getTime() + 24 * 60 * 60 * 1000).toISOString();
        countQuery = countQuery.gte('updated_at', startDate).lt('updated_at', nextDay);
        dataQuery = dataQuery.gte('updated_at', startDate).lt('updated_at', nextDay);
      } else {
        // Date range - add time to end date to include the full day
        const endDateTime = `${endDate}T23:59:59.999Z`;
        countQuery = countQuery.gte('updated_at', startDate).lte('updated_at', endDateTime);
        dataQuery = dataQuery.gte('updated_at', startDate).lte('updated_at', endDateTime);
      }
    } else {
      // Single date - include full day
      const nextDay = new Date(new Date(filters.updated_at).getTime() + 24 * 60 * 60 * 1000).toISOString();
      countQuery = countQuery.gte('updated_at', filters.updated_at).lt('updated_at', nextDay);
      dataQuery = dataQuery.gte('updated_at', filters.updated_at).lt('updated_at', nextDay);
    }
  }

  // Filter by appointment date (start_date and end_date)
  // Store for post-query filtering if needed
  let dateRangeFilterTicketIds: Set<string> | undefined = undefined;
  
  if (filters.start_date && filters.end_date) {
    // Get appointments in the date range
    // When start_date == end_date, use .eq() for exact match; otherwise use range
    let appointmentQuery = supabase
      .from('appointments')
      .select('id, ticket_id');
    
    if (filters.start_date === filters.end_date) {
      // Same date - use exact match
      appointmentQuery = appointmentQuery.eq('appointment_date', filters.start_date);
    } else {
      // Date range - use >= and <=
      appointmentQuery = appointmentQuery
        .gte('appointment_date', filters.start_date)
        .lte('appointment_date', filters.end_date);
    }

    const { data: appointments, error: appError } = await appointmentQuery;

    if (appError) throw new DatabaseError(appError.message);

    if (!appointments || appointments.length === 0) {
      // No appointments in range, return empty result
      return {
        data: [],
        pagination: calculatePagination(params.page, params.limit, 0),
      };
    }

    // Get ticket IDs from both relationships:
    // 1. Tickets linked via ticket.appointment_id = appointment.id
    // 2. Tickets linked via appointment.ticket_id = ticket.id
    const appointmentIds = appointments.map(a => a.id as string);
    const ticketIdsFromAppointments = appointments
      .map(a => a.ticket_id as string)
      .filter((id): id is string => id !== null && id !== undefined);

    // Collect all matching ticket IDs to avoid long OR queries in URL
    const allTicketIds = new Set<string>();

    // Add tickets linked via appointment.ticket_id
    ticketIdsFromAppointments.forEach(id => allTicketIds.add(id));
    
    // Get tickets that have appointment_id in our list
    // Batch the queries to avoid URL length limits (max ~100 IDs per batch)
    if (appointmentIds.length > 0) {
      const BATCH_SIZE = 100;
      for (let i = 0; i < appointmentIds.length; i += BATCH_SIZE) {
        const batchIds = appointmentIds.slice(i, i + BATCH_SIZE);
        const { data: ticketsByAppointmentId, error: ticketsError } = await supabase
          .from('tickets')
          .select('id')
          .in('appointment_id', batchIds);
        
        if (ticketsError) throw new DatabaseError(ticketsError.message);
        
        if (ticketsByAppointmentId) {
          ticketsByAppointmentId.forEach(t => {
            const ticketId = t.id as string;
            if (ticketId) allTicketIds.add(ticketId);
          });
        }
      }
    }

    const finalTicketIds = Array.from(allTicketIds);

    // Filter tickets by their IDs
    // If the list is small enough, use .in() directly
    // Otherwise, we'll filter after fetching (with post-query filtering)
    if (finalTicketIds.length > 0) {
      if (finalTicketIds.length <= 300) {
        // Small enough to use .in() directly
        countQuery = countQuery.in('id', finalTicketIds);
        dataQuery = dataQuery.in('id', finalTicketIds);
      } else {
        // Too many IDs - use post-query filtering
        countQuery = countQuery.not('appointment_id', 'is', null);
        dataQuery = dataQuery.not('appointment_id', 'is', null);
        dateRangeFilterTicketIds = allTicketIds;
      }
    } else {
      // No matching tickets, return empty result
      return {
        data: [],
        pagination: calculatePagination(params.page, params.limit, 0),
      };
    }
  }

  // Exclude backlog (tickets with null appointment_id)
  if (filters.exclude_backlog) {
    // Filter out tickets where appointment_id is null
    countQuery = countQuery.not('appointment_id', 'is', null);
    dataQuery = dataQuery.not('appointment_id', 'is', null);
  }

  // Filter by appointment approval status (appointment_is_approved)
  // Store the approval status for post-query filtering if needed
  let filterByApprovalStatus: boolean | undefined = undefined;
  let approvalFilterTicketIds: Set<string> | undefined = undefined;
  
  if (filters.appointment_is_approved !== undefined) {
    // Get appointments with the specified approval status
    const appointmentQuery = supabase
      .from('appointments')
      .select('id, ticket_id')
      .eq('is_approved', filters.appointment_is_approved);

    const { data: appointments, error: appError } = await appointmentQuery;

    if (appError) throw new DatabaseError(appError.message);

    if (!appointments || appointments.length === 0) {
      // No appointments with this approval status, return empty result
      return {
        data: [],
        pagination: calculatePagination(params.page, params.limit, 0),
      };
    }

    // Get ticket IDs from both relationships:
    // 1. Tickets linked via ticket.appointment_id = appointment.id
    // 2. Tickets linked via appointment.ticket_id = ticket.id
    const appointmentIds = appointments.map(a => a.id as string);
    const ticketIdsFromAppointments = appointments
      .map(a => a.ticket_id as string)
      .filter((id): id is string => id !== null && id !== undefined);

    // Collect all matching ticket IDs to avoid long OR queries in URL
    const allTicketIds = new Set<string>();
    
    // Add tickets linked via appointment.ticket_id
    ticketIdsFromAppointments.forEach(id => allTicketIds.add(id));
    
    // Get tickets that have appointment_id in our list
    // Batch the queries to avoid URL length limits (max ~100 IDs per batch)
    if (appointmentIds.length > 0) {
      const BATCH_SIZE = 100;
      for (let i = 0; i < appointmentIds.length; i += BATCH_SIZE) {
        const batchIds = appointmentIds.slice(i, i + BATCH_SIZE);
        const { data: ticketsByAppointmentId, error: ticketsError } = await supabase
          .from('tickets')
          .select('id')
          .in('appointment_id', batchIds);
        
        if (ticketsError) throw new DatabaseError(ticketsError.message);
        
        if (ticketsByAppointmentId) {
          ticketsByAppointmentId.forEach(t => {
            const ticketId = t.id as string;
            if (ticketId) allTicketIds.add(ticketId);
          });
        }
      }
    }

    const finalTicketIds = Array.from(allTicketIds);

    // Filter tickets by their IDs
    // If the list is small enough, use .in() directly
    // Otherwise, we'll filter after fetching (with post-query filtering)
    if (finalTicketIds.length > 0) {
      if (finalTicketIds.length <= 300) {
        // Small enough to use .in() directly
        countQuery = countQuery.in('id', finalTicketIds);
        dataQuery = dataQuery.in('id', finalTicketIds);
      } else {
        // Too many IDs - use post-query filtering
        // Just filter out tickets without appointments for now
        // and store the valid ticket IDs for filtering after fetch
        countQuery = countQuery.not('appointment_id', 'is', null);
        dataQuery = dataQuery.not('appointment_id', 'is', null);
        filterByApprovalStatus = filters.appointment_is_approved;
        approvalFilterTicketIds = allTicketIds;
      }
    } else {
      // No matching tickets, return empty result
      return {
        data: [],
        pagination: calculatePagination(params.page, params.limit, 0),
      };
    }
  }

  // Filter by employee_id (tickets assigned to specific employees via ticket_employees table)
  if (filters.employee_id) {
    // Normalize to array for consistent handling
    const employeeIds = Array.isArray(filters.employee_id) 
      ? filters.employee_id 
      : [filters.employee_id];

    // Get ticket IDs that have these employees assigned
    const { data: ticketEmployees, error: teError } = await supabase
      .from('ticket_employees')
      .select('ticket_id')
      .in('employee_id', employeeIds);

    if (teError) {
      throw new DatabaseError(`ไม่สามารถค้นหาตั๋วงานตามพนักงานได้: ${teError.message}`);
    }

    const ticketIds = [...new Set((ticketEmployees || []).map(te => te.ticket_id as string))];

    if (ticketIds.length === 0) {
      // No tickets with these employees assigned, return empty result
      return {
        data: [],
        pagination: calculatePagination(params.page, params.limit, 0),
      };
    }

    // Filter tickets by these IDs
    countQuery = countQuery.in('id', ticketIds);
    dataQuery = dataQuery.in('id', ticketIds);
  }

  // Filter by department_id (through employees -> roles -> departments)
  if (filters.department_id) {
    // Normalize to array for consistent handling
    const departmentIds = Array.isArray(filters.department_id) 
      ? filters.department_id 
      : [filters.department_id];

    // Step 1: Get role IDs that belong to these departments
    const { data: roles, error: roleError } = await supabase
      .from('roles')
      .select('id')
      .in('department_id', departmentIds);

    if (roleError) {
      throw new DatabaseError(`ไม่สามารถค้นหาบทบาทตามแผนกได้: ${roleError.message}`);
    }

    const roleIds = (roles || []).map(r => r.id as string);

    if (roleIds.length === 0) {
      // No roles in these departments, return empty result
      return {
        data: [],
        pagination: calculatePagination(params.page, params.limit, 0),
      };
    }

    // Step 2: Get employee IDs that have these roles
    const { data: employees, error: empError } = await supabase
      .from('employees')
      .select('id')
      .in('role_id', roleIds);

    if (empError) {
      throw new DatabaseError(`ไม่สามารถค้นหาพนักงานตามแผนกได้: ${empError.message}`);
    }

    const employeeIds = (employees || []).map(e => e.id as string);

    if (employeeIds.length === 0) {
      // No employees in these departments, return empty result
      return {
        data: [],
        pagination: calculatePagination(params.page, params.limit, 0),
      };
    }

    // Step 3: Get ticket IDs that have these employees assigned
    const { data: ticketEmployees, error: teError } = await supabase
      .from('ticket_employees')
      .select('ticket_id')
      .in('employee_id', employeeIds);

    if (teError) {
      throw new DatabaseError(`ไม่สามารถค้นหาตั๋วงานตามแผนกได้: ${teError.message}`);
    }

    const ticketIds = [...new Set((ticketEmployees || []).map(te => te.ticket_id as string))];

    if (ticketIds.length === 0) {
      // No tickets with employees from these departments, return empty result
      return {
        data: [],
        pagination: calculatePagination(params.page, params.limit, 0),
      };
    }

    // Step 4: Filter tickets by these IDs
    countQuery = countQuery.in('id', ticketIds);
    dataQuery = dataQuery.in('id', ticketIds);
  }

  // Determine sort field and order
  const sortField = sort || 'created_at';
  const sortOrder = order === 'asc' ? true : false; // Default to descending (false)
  
  // Validate sort field
  const validSortFields = ['created_at', 'updated_at', 'appointment_date'];
  if (!validSortFields.includes(sortField)) {
    throw new ValidationError(`ไม่สามารถเรียงตาม ${sortField} ได้ ใช้ได้เฉพาะ: ${validSortFields.join(', ')}`);
  }

  let transformedData: Record<string, unknown>[];
  let total: number;

  // Check if we need to filter in memory (due to too many IDs for URL)
  const needsApprovalFiltering = filterByApprovalStatus !== undefined && approvalFilterTicketIds !== undefined;
  const needsDateRangeFiltering = dateRangeFilterTicketIds !== undefined;
  const needsPostQueryFiltering = needsApprovalFiltering || needsDateRangeFiltering;

  if (needsPostQueryFiltering || sortField === 'appointment_date') {
    // Fetch ALL matching records (no pagination yet)
    const { data: allData, error: allError } = await dataQuery.order('created_at', { ascending: false });
    
    if (allError) {
      throw new DatabaseError(allError.message);
    }

    // Transform all data
    let allTransformedData = (allData || []).map(transformTicket);

    // Apply post-query filtering for date range if needed
    if (needsDateRangeFiltering && dateRangeFilterTicketIds) {
      allTransformedData = allTransformedData.filter(ticket => {
        const ticketId = ticket.id as string;
        return dateRangeFilterTicketIds!.has(ticketId);
      });
    }

    // Apply post-query filtering for approval status if needed
    if (needsApprovalFiltering && approvalFilterTicketIds) {
      allTransformedData = allTransformedData.filter(ticket => {
        const ticketId = ticket.id as string;
        return approvalFilterTicketIds!.has(ticketId);
      });
    }

    // Update total count based on filtered results
    total = allTransformedData.length;

    // Sort if needed
    if (sortField === 'appointment_date') {
      allTransformedData = [...allTransformedData].sort((a, b) => {
        const dateA = a.appointment_date as string | null;
        const dateB = b.appointment_date as string | null;
        
        // Handle null values - put them at the end
        if (!dateA && !dateB) return 0;
        if (!dateA) return 1;
        if (!dateB) return -1;
        
        const comparison = dateA.localeCompare(dateB);
        return sortOrder ? comparison : -comparison;
      });
    } else if (sortField === 'created_at' || sortField === 'updated_at') {
      // Sort by the specified field
      allTransformedData = [...allTransformedData].sort((a, b) => {
        const dateA = a[sortField] as string | null;
        const dateB = b[sortField] as string | null;
        
        if (!dateA && !dateB) return 0;
        if (!dateA) return 1;
        if (!dateB) return -1;
        
        const comparison = dateA.localeCompare(dateB);
        return sortOrder ? comparison : -comparison;
      });
    }

    // Now paginate the filtered/sorted data
    const offset = (page - 1) * limit;
    transformedData = allTransformedData.slice(offset, offset + limit);
  } else {
    // Get total count from database
    const { count, error: countError } = await countQuery;
    if (countError) throw new DatabaseError(countError.message);
    total = count || 0;

    // For created_at and updated_at, sort at database level before pagination
    const offset = (page - 1) * limit;
    const { data, error } = await dataQuery
      .order(sortField, { ascending: sortOrder })
      .range(offset, offset + limit - 1);

    if (error) throw new DatabaseError(error.message);

    // Transform paginated data
    transformedData = (data || []).map(transformTicket);
  }

  return {
    data: transformedData,
    pagination: calculatePagination(page, limit, total),
  };
}

/**
 * Search tickets by duration (date range) with selectable date type
 */
export async function searchByDuration(params: {
  page: number;
  limit: number;
  startDate: string;
  endDate: string;
  dateType: DateType;
  sort?: string; // Sort field: 'created_at', 'updated_at', 'appointment_date'
  order?: 'asc' | 'desc'; // Sort order: 'asc' or 'desc'
}): Promise<{ data: Record<string, unknown>[]; pagination: PaginationInfo }> {
  const supabase = createServiceClient();
  const { page, limit, startDate, endDate, dateType, sort, order } = params;

  // Build count query
  let countQuery = supabase
    .from('tickets')
    .select('*', { count: 'exact', head: true });

  // Build data query
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
      created_by,
      site_id,
      contact_id,
      appointment_id,
      work_type:work_types(*),
      assigner:employees!tickets_assigner_id_fkey(*),
      creator:employees!tickets_created_by_fkey(*),
      status:ticket_statuses(*),
      site:sites(
        *,
        company:companies(*)
      ),
      contact:contacts(*),
      appointment:appointments!tickets_appointment_id_fkey(*),
      appointment_by_ticket:appointments!appointments_ticket_id_fkey(*),
      employees:ticket_employees(
        employee:employees(*)
      ),
      merchandise:ticket_merchandise(
        merchandise:merchandise(
          id,
          serial_no,
          model:models(model)
        )
      )
    `);

  // Store appointment IDs for post-query filtering if too many
  let appointedDateFilterIds: Set<string> | undefined = undefined;

  // Apply date filter based on date_type
  if (dateType === 'create') {
    // Filter by tickets.created_at
    countQuery = countQuery
      .gte('created_at', startDate)
      .lte('created_at', `${endDate}T23:59:59.999Z`);
    dataQuery = dataQuery
      .gte('created_at', startDate)
      .lte('created_at', `${endDate}T23:59:59.999Z`);
  } else if (dateType === 'update') {
    // Filter by tickets.updated_at
    countQuery = countQuery
      .gte('updated_at', startDate)
      .lte('updated_at', `${endDate}T23:59:59.999Z`);
    dataQuery = dataQuery
      .gte('updated_at', startDate)
      .lte('updated_at', `${endDate}T23:59:59.999Z`);
  } else if (dateType === 'appointed') {
    // Filter by appointments.appointment_date
    // First, get appointment IDs in the date range
    const { data: appointments, error: appError } = await supabase
      .from('appointments')
      .select('id, ticket_id')
      .gte('appointment_date', startDate)
      .lte('appointment_date', endDate);

    if (appError) throw new DatabaseError(appError.message);

    if (!appointments || appointments.length === 0) {
      // No appointments in range, return empty result
      return {
        data: [],
        pagination: calculatePagination(page, limit, 0),
      };
    }

    // Get ticket IDs from both relationships
    const appointmentIds = appointments.map(a => a.id as string);
    const ticketIdsFromAppointments = appointments
      .map(a => a.ticket_id as string)
      .filter((id): id is string => id !== null && id !== undefined);

    // Collect all matching ticket IDs
    const allTicketIds = new Set<string>();
    ticketIdsFromAppointments.forEach(id => allTicketIds.add(id));

    // Get tickets that have appointment_id in our list (batched to avoid URL length issues)
    if (appointmentIds.length > 0) {
      const BATCH_SIZE = 100;
      for (let i = 0; i < appointmentIds.length; i += BATCH_SIZE) {
        const batchIds = appointmentIds.slice(i, i + BATCH_SIZE);
        const { data: ticketsByAppointmentId, error: ticketsError } = await supabase
          .from('tickets')
          .select('id')
          .in('appointment_id', batchIds);
        
        if (ticketsError) throw new DatabaseError(ticketsError.message);
        
        if (ticketsByAppointmentId) {
          ticketsByAppointmentId.forEach(t => {
            const ticketId = t.id as string;
            if (ticketId) allTicketIds.add(ticketId);
          });
        }
      }
    }

    const finalTicketIds = Array.from(allTicketIds);

    if (finalTicketIds.length === 0) {
      return {
        data: [],
        pagination: calculatePagination(page, limit, 0),
      };
    }

    // Use direct filter if small enough, otherwise use post-query filtering
    if (finalTicketIds.length <= 300) {
      countQuery = countQuery.in('id', finalTicketIds);
      dataQuery = dataQuery.in('id', finalTicketIds);
    } else {
      // Too many IDs - use post-query filtering
      countQuery = countQuery.not('appointment_id', 'is', null);
      dataQuery = dataQuery.not('appointment_id', 'is', null);
      appointedDateFilterIds = allTicketIds;
    }
  }

  // Helper function to transform ticket data (same as in search function)
  const transformTicket = (ticket: Record<string, unknown>) => {
    const workType = ticket.work_type as { name?: string; code?: string } | null;
    const assigner = ticket.assigner as { name?: string; code?: string } | null;
    const creator = ticket.creator as { name?: string; code?: string } | null;
    const status = ticket.status as { name?: string; code?: string } | null;
    const site = ticket.site as { 
      id?: string; 
      name?: string;
      province_code?: number | null;
      district_code?: number | null;
      subdistrict_code?: number | null;
      company?: Record<string, unknown> | null;
    } | null;
    const contact = ticket.contact as { person_name?: string } | null;
    // Try appointment via appointment_id first, then via ticket_id (fallback for old tickets)
    const appointmentById = ticket.appointment as { 
      id?: string;
      appointment_date?: string;
      appointment_time_start?: string;
      appointment_time_end?: string;
      appointment_type?: string;
      is_approved?: boolean;
    } | null;
    const appointmentByTicketId = ticket.appointment_by_ticket as { 
      id?: string;
      appointment_date?: string;
      appointment_time_start?: string;
      appointment_time_end?: string;
      appointment_type?: string;
      is_approved?: boolean;
    } | null;
    // Use appointment from appointment_id if available, otherwise use from ticket_id
    const appointment = appointmentById || appointmentByTicketId;
    const employees = Array.isArray(ticket.employees) 
      ? ticket.employees.map((te: Record<string, unknown>) => (te as { employee: Record<string, unknown> }).employee).filter(Boolean) as Array<{ name?: string }>
      : [];

    return {
      id: ticket.id,
      details: ticket.details,
      work_type_name: workType?.name || null,
      work_type_code: workType?.code || null,
      assigner_name: assigner?.name || null,
      assigner_code: assigner?.code || null,
      creator_name: creator?.name || null,
      creator_code: creator?.code || null,
      created_by: ticket.created_by || null,
      status_name: status?.name || null,
      status_code: status?.code || null,
      additional: ticket.additional,
      created_at: ticket.created_at,
      updated_at: ticket.updated_at,
      site_name: site?.name || null,
      company: site?.company || null,
      company_name: (site?.company as { name_th?: string; name_en?: string } | undefined)?.name_th || (site?.company as { name_th?: string; name_en?: string } | undefined)?.name_en || null,
      provinceCode: site?.province_code || null,
      districtCode: site?.district_code || null,
      subDistrictCode: site?.subdistrict_code || null,
      contact_name: contact?.person_name || null,
      appointment_id: appointment?.id || ticket.appointment_id || null,
      appointment_date: appointment?.appointment_date || null,
      appointment_time_start: appointment?.appointment_time_start || null,
      appointment_time_end: appointment?.appointment_time_end || null,
      appointment_type: appointment?.appointment_type || null,
      appointment_is_approved: appointment?.is_approved ?? null,
      employee_names: employees.map(emp => emp.name).filter(Boolean),
      employee_count: employees.length,
      merchandise: Array.isArray(ticket.merchandise)
        ? ticket.merchandise.map((tm: Record<string, unknown>) => {
            const merch = (tm as { merchandise: Record<string, unknown> }).merchandise;
            const model = merch?.model as { model?: string } | null;
            return {
              id: merch?.id || null,
              serial: merch?.serial_no || null,
              model: model?.model || null,
            };
          }).filter(Boolean)
        : [],
      merchandise_count: Array.isArray(ticket.merchandise) ? ticket.merchandise.length : 0,
    };
  };

  // Determine sort field and order
  const sortField = sort || 'created_at';
  const sortOrder = order === 'asc' ? true : false; // Default to descending (false)
  
  // Validate sort field
  const validSortFields = ['created_at', 'updated_at', 'appointment_date'];
  if (!validSortFields.includes(sortField)) {
    throw new ValidationError(`ไม่สามารถเรียงตาม ${sortField} ได้ ใช้ได้เฉพาะ: ${validSortFields.join(', ')}`);
  }

  let transformedData: Record<string, unknown>[];
  let total: number;

  // Check if we need post-query filtering (for appointed date type with many IDs)
  const needsPostQueryFiltering = appointedDateFilterIds !== undefined;

  if (needsPostQueryFiltering || sortField === 'appointment_date') {
    // Fetch ALL matching records (no pagination yet)
    const { data: allData, error: allError } = await dataQuery.order('created_at', { ascending: false });
    
    if (allError) {
      throw new DatabaseError(allError.message);
    }

    // Transform all data
    let allTransformedData = (allData || []).map(transformTicket);

    // Apply post-query filtering for appointed date if needed
    if (needsPostQueryFiltering && appointedDateFilterIds) {
      allTransformedData = allTransformedData.filter(ticket => {
        const ticketId = ticket.id as string;
        return appointedDateFilterIds!.has(ticketId);
      });
    }

    // Update total count based on filtered results
    total = allTransformedData.length;

    // Sort if needed
    if (sortField === 'appointment_date') {
      allTransformedData = [...allTransformedData].sort((a, b) => {
        const dateA = a.appointment_date as string | null;
        const dateB = b.appointment_date as string | null;
        
        // Handle null values - put them at the end
        if (!dateA && !dateB) return 0;
        if (!dateA) return 1;
        if (!dateB) return -1;
        
        const comparison = dateA.localeCompare(dateB);
        return sortOrder ? comparison : -comparison;
      });
    } else if (sortField === 'created_at' || sortField === 'updated_at') {
      // Sort by the specified field
      allTransformedData = [...allTransformedData].sort((a, b) => {
        const dateA = a[sortField] as string | null;
        const dateB = b[sortField] as string | null;
        
        if (!dateA && !dateB) return 0;
        if (!dateA) return 1;
        if (!dateB) return -1;
        
        const comparison = dateA.localeCompare(dateB);
        return sortOrder ? comparison : -comparison;
      });
    }

    // Now paginate the filtered/sorted data
    const offset = (page - 1) * limit;
    transformedData = allTransformedData.slice(offset, offset + limit);
  } else {
    // Get total count from database
    const { count, error: countError } = await countQuery;
    if (countError) throw new DatabaseError(countError.message);
    total = count || 0;

    // For created_at and updated_at, sort at database level before pagination
    const offset = (page - 1) * limit;
    const { data, error } = await dataQuery
      .order(sortField, { ascending: sortOrder })
      .range(offset, offset + limit - 1);

    if (error) throw new DatabaseError(error.message);

    // Transform paginated data
    transformedData = (data || []).map(transformTicket);
  }

  return {
    data: transformedData,
    pagination: calculatePagination(page, limit, total),
  };
}

