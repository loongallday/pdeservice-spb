/**
 * Ticket search service - Business logic for searching tickets
 * Enhanced with display-ready response format
 */

import { createServiceClient } from '../../_shared/supabase.ts';
import { NotFoundError, DatabaseError } from '../../_shared/error.ts';
import { calculatePagination } from '../../_shared/response.ts';
import type { PaginationInfo } from '../../_shared/response.ts';
import type { DateType } from './ticketTypes.ts';
import type { 
  TicketDisplayItem, 
  TicketLocation, 
  TicketAppointment, 
  TicketEmployee,
  TicketMerchandiseSummary,
  TicketIds,
  IncludeMode,
} from './ticketDisplayTypes.ts';
import { 
  formatAppointmentTypeDisplay, 
  normalizeAppointmentType 
} from './ticketDisplayTypes.ts';
import { batchResolveLocations } from './locationResolver.ts';

/**
 * Get single ticket by ID with full details (site, appointment)
 */
export async function getById(id: string): Promise<Record<string, unknown>> {
  const supabase = createServiceClient();

  // Get ticket with all related data using v_tickets view for base data
  // Note: Using main_tickets for joins that aren't in the view
  const { data, error } = await supabase
    .from('main_tickets')
    .select(`
      id,
      ticket_code,
      ticket_number,
      details,
      details_summary,
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
      work_type:ref_ticket_work_types(*),
      assigner:main_employees!main_tickets_assigner_id_fkey(*),
      creator:main_employees!main_tickets_created_by_fkey(*),
      status:ref_ticket_statuses(*),
      site:main_sites(
        *,
        company:main_companies(*)
      ),
      contact:child_site_contacts(*),
      appointment:main_appointments!main_tickets_appointment_id_fkey(*),
      employees:jct_ticket_employees(
        id,
        date,
        is_key_employee,
        employee:main_employees(*)
      ),
      confirmed_technicians:jct_ticket_employees_cf(
        id,
        date,
        confirmed_by,
        confirmed_at,
        notes,
        employee:main_employees!jct_ticket_employees_cf_employee_id_fkey(*),
        confirmed_by_employee:main_employees!jct_ticket_employees_cf_confirmed_by_fkey(*)
      ),
      merchandise:jct_ticket_merchandise(
        merchandise:main_merchandise(
          *,
          model:main_models(*)
        )
      ),
      work_giver:child_ticket_work_givers!child_ticket_work_givers_ticket_id_fkey(
        id,
        work_giver_id,
        work_giver:ref_work_givers!child_ticket_work_givers_work_giver_id_fkey(*)
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
  
  // Transform employees
  const employees = Array.isArray(data.employees)
      ? data.employees.map((te: Record<string, unknown>) => {
          const ticketEmployee = te as { employee: Record<string, unknown>; is_key_employee?: boolean; date?: string };
          const employee = ticketEmployee.employee;
          if (!employee) return null;
          return {
            ...employee,
            is_key_employee: ticketEmployee.is_key_employee ?? false,
            assignment_date: ticketEmployee.date || null,
        };
      }).filter(Boolean)
    : [];

  // Transform confirmed technicians to cf_employees
  const cf_employees = Array.isArray(data.confirmed_technicians)
    ? data.confirmed_technicians.map((cf: Record<string, unknown>) => {
        const confirmation = cf as {
          employee: Record<string, unknown>;
          confirmed_by_employee: Record<string, unknown>;
          date?: string;
          confirmed_at?: string;
          notes?: string;
        };
        const employee = confirmation.employee;
        if (!employee) return null;
        return {
          ...employee,
          is_key: false, // Confirmed technicians don't have is_key flag
        };
      }).filter(Boolean)
    : [];

  // Transform work_giver (1:1 relationship via child table)
  // First try from joined data
  let work_giver: { id: string; code: string; name: string } | null = null;
  if (Array.isArray(data.work_giver) && data.work_giver.length > 0) {
    const workGiverLink = data.work_giver[0] as { work_giver: { id: string; code: string; name: string } | null };
    if (workGiverLink.work_giver) {
      work_giver = {
        id: workGiverLink.work_giver.id,
        code: workGiverLink.work_giver.code,
        name: workGiverLink.work_giver.name,
      };
    }
  }
  
  // Fallback: Query work_giver separately if join didn't return data
  if (!work_giver) {
    const { data: workGiverData } = await supabase
      .from('child_ticket_work_givers')
      .select(`
        id,
        work_giver_id,
        ref_work_givers:work_giver_id (
          id,
          code,
          name
        )
      `)
      .eq('ticket_id', id)
      .maybeSingle();
    
    if (workGiverData?.ref_work_givers) {
      const wg = workGiverData.ref_work_givers as { id: string; code: string; name: string };
      work_giver = {
        id: wg.id,
        code: wg.code,
        name: wg.name,
      };
    }
  }

  return {
    ...data,
    time: data.created_at, // Map created_at to time for frontend compatibility
    employees: employees,
    cf_employees: cf_employees,
    confirmed_technicians: Array.isArray(data.confirmed_technicians)
      ? data.confirmed_technicians.map((cf: Record<string, unknown>) => {
          const confirmation = cf as {
            employee: Record<string, unknown>;
            confirmed_by_employee: Record<string, unknown>;
            date?: string;
            confirmed_at?: string;
            notes?: string;
          };
          const employee = confirmation.employee;
          if (!employee) return null;
          return {
            ...employee,
            confirmation_date: confirmation.date || null,
            confirmed_at: confirmation.confirmed_at || null,
            confirmed_by: confirmation.confirmed_by_employee || null,
            notes: confirmation.notes || null,
          };
        }).filter(Boolean)
      : [],
    creator_name: creator?.name || null,
    creator_code: creator?.code || null,
    merchandise: merchandise,
    work_giver: work_giver,
  };
}

/**
 * Transform raw ticket data to display-ready format
 */
function createTicketDisplayItem(
  ticket: Record<string, unknown>,
  resolvedLocation: TicketLocation,
  includeMode: IncludeMode
): TicketDisplayItem {
  const workType = ticket.work_type as { name?: string; code?: string } | null;
  const assigner = ticket.assigner as { name?: string; code?: string } | null;
  const creator = ticket.creator as { id?: string; name?: string; code?: string } | null;
  const status = ticket.status as { name?: string; code?: string } | null;
  const site = ticket.site as { 
    id?: string; 
    name?: string;
    province_code?: number | null;
    district_code?: number | null;
    subdistrict_code?: number | null;
    address_detail?: string | null;
    company?: { name_th?: string; name_en?: string; tax_id?: string } | null;
  } | null;
  const contact = ticket.contact as { id?: string; person_name?: string } | null;
  const appointment = ticket.appointment as {
    id?: string;
    appointment_date?: string;
    appointment_time_start?: string;
    appointment_time_end?: string;
    appointment_type?: string;
    is_approved?: boolean;
  } | null;

  // Transform employees to display format
  const employees: TicketEmployee[] = [];
  if (Array.isArray(ticket.employees)) {
    for (const te of ticket.employees) {
      const ticketEmployee = te as { 
        employee: Record<string, unknown>; 
        is_key_employee?: boolean; 
        date?: string 
      };
      const emp = ticketEmployee.employee as {
        id?: string;
        name?: string;
        code?: string;
        profile_image_url?: string;
      } | null;
      
      if (emp && emp.id) {
        employees.push({
          id: emp.id,
          name: emp.name || '',
          code: emp.code || null,
          is_key: ticketEmployee.is_key_employee ?? false,
          profile_image_url: emp.profile_image_url || null,
        });
      }
    }
  }

  // Transform confirmed technicians to display format (cf_employees)
  const cf_employees: TicketEmployee[] = [];
  if (Array.isArray(ticket.confirmed_technicians)) {
    for (const cf of ticket.confirmed_technicians) {
      const confirmation = cf as {
        employee: Record<string, unknown>;
        date?: string;
      };
      const emp = confirmation.employee as {
        id?: string;
        name?: string;
        code?: string;
        profile_image_url?: string;
      } | null;
      
      if (emp && emp.id) {
        cf_employees.push({
          id: emp.id,
          name: emp.name || '',
          code: emp.code || null,
          is_key: false, // Confirmed technicians don't have is_key flag
          profile_image_url: emp.profile_image_url || null,
        });
      }
    }
  }

  // Transform merchandise to display format
  const merchandise: TicketMerchandiseSummary[] = [];
  if (Array.isArray(ticket.merchandise)) {
    for (const tm of ticket.merchandise) {
      const merch = (tm as { merchandise: Record<string, unknown> }).merchandise as {
        id?: string;
        serial_no?: string;
        model?: { model?: string } | null;
      } | null;
      
      if (merch && merch.id) {
        merchandise.push({
          id: merch.id,
          serial_no: merch.serial_no || '',
          model_name: merch.model?.model || null,
        });
      }
    }
  }

  // Transform work_giver to display format (1:1 relationship via child table)
  let workGiverDisplay: { id: string; code: string; name: string } | null = null;
  if (Array.isArray(ticket.work_giver) && ticket.work_giver.length > 0) {
    const workGiverLink = ticket.work_giver[0] as { 
      work_giver: { id: string; code: string; name: string } | null 
    };
    if (workGiverLink.work_giver) {
      workGiverDisplay = {
        id: workGiverLink.work_giver.id,
        code: workGiverLink.work_giver.code,
        name: workGiverLink.work_giver.name,
      };
    }
  }

  // Build appointment display object
  const appointmentType = normalizeAppointmentType(appointment?.appointment_type || null);
  const appointmentDisplay: TicketAppointment = {
    id: appointment?.id || ticket.appointment_id as string || null,
    date: appointment?.appointment_date || null,
    time_start: appointment?.appointment_time_start 
      ? appointment.appointment_time_start.substring(0, 5) 
      : null,
    time_end: appointment?.appointment_time_end 
      ? appointment.appointment_time_end.substring(0, 5) 
      : null,
    type: appointmentType,
    type_display: formatAppointmentTypeDisplay(
      appointmentType,
      appointment?.appointment_time_start || null,
      appointment?.appointment_time_end || null
    ),
    is_approved: appointment?.is_approved ?? null,
  };

  // Build the display item
  const displayItem: TicketDisplayItem = {
    id: ticket.id as string,
    ticket_code: ticket.ticket_code as string,
    ticket_number: ticket.ticket_number as number,

    // Display strings
    site_name: site?.name || null,
    company_name: site?.company?.name_th || site?.company?.name_en || null,
    work_type_name: workType?.name || null,
    work_type_code: workType?.code || null,
    status_name: status?.name || null,
    status_code: status?.code || null,
    assigner_name: assigner?.name || null,
    creator_name: creator?.name || null,
    
    // Location with pre-resolved names
    location: resolvedLocation,
    
    // Appointment with pre-formatted display
    appointment: appointmentDisplay,
    
    // Employees
    employees: employees,
    employee_count: employees.length,
    
    // Confirmed Employees
    cf_employees: cf_employees,
    cf_employee_count: cf_employees.length,
    
    // Content
    details: ticket.details as string | null,
    details_summary: ticket.details_summary as string | null,
    additional: ticket.additional as string | null,
    
    // Merchandise
    merchandise: merchandise,
    merchandise_count: merchandise.length,
    
    // Work Giver
    work_giver: workGiverDisplay,
    
    // Timestamps
    created_at: ticket.created_at as string,
    updated_at: ticket.updated_at as string,
  };

  // Add IDs for updates (only in full mode)
  if (includeMode === 'full') {
    const ids: TicketIds = {
      site_id: site?.id || ticket.site_id as string || null,
      status_id: ticket.status_id as string,
      work_type_id: ticket.work_type_id as string,
      assigner_id: ticket.assigner_id as string,
      creator_id: creator?.id || ticket.created_by as string || null,
      contact_id: contact?.id || ticket.contact_id as string || null,
    };
    displayItem._ids = ids;
  }

  return displayItem;
}

/**
 * Search tickets with filters for all ticket fields (paginated)
 * Returns display-ready data with pre-resolved location names
 * Uses server-side RPC for filtering to avoid URL length issues
 *
 * Supports `watching=true` with `watcher_employee_id` to filter only watched tickets
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
  created_at?: string;
  updated_at?: string;
  start_date?: string;
  end_date?: string;
  date_type?: 'create' | 'update' | 'appointed';
  exclude_backlog?: boolean;
  only_backlog?: boolean;
  appointment_is_approved?: boolean;
  department_id?: string | string[];
  employee_id?: string | string[];
  sort?: string;
  order?: 'asc' | 'desc';
  include?: IncludeMode;
  watching?: boolean;
  watcher_employee_id?: string;
}): Promise<{ data: TicketDisplayItem[]; pagination: PaginationInfo }> {
  const supabase = createServiceClient();
  const { page, limit, sort, order, include = 'full', watching, watcher_employee_id, ...filters } = params;

  // If watching=true, get watched ticket IDs first
  let watchedTicketIds: string[] | null = null;
  if (watching && watcher_employee_id) {
    const { data: watchedTickets, error: watchError } = await supabase
      .from('jct_ticket_watchers')
      .select('ticket_id')
      .eq('employee_id', watcher_employee_id);

    if (watchError) {
      console.error('[ticketSearchService] Failed to get watched tickets:', watchError);
      throw new DatabaseError(watchError.message);
    }

    watchedTicketIds = (watchedTickets || []).map(w => w.ticket_id);

    // If no watched tickets, return empty result
    if (watchedTicketIds.length === 0) {
      return {
        data: [],
        pagination: calculatePagination(page, limit, 0),
      };
    }
  }

  // Map date_type to RPC parameter format
  const rpcDateType = filters.date_type === 'create' ? 'created'
    : filters.date_type === 'update' ? 'updated'
    : 'appointed';

  // When watching filter is active, use direct query instead of RPC for accurate pagination
  let ticketIds: string[];
  let totalCount: number;

  if (watchedTicketIds) {
    // Direct query for watched tickets with pagination
    const offset = (page - 1) * limit;

    // Get total count of watched tickets
    totalCount = watchedTicketIds.length;

    // Paginate watched ticket IDs
    const sortField = sort || 'created_at';
    const sortOrder = order || 'desc';

    // Fetch paginated watched tickets with sorting
    const { data: paginatedTickets, error: paginateError } = await supabase
      .from('main_tickets')
      .select('id')
      .in('id', watchedTicketIds)
      .order(sortField, { ascending: sortOrder === 'asc' })
      .range(offset, offset + limit - 1);

    if (paginateError) {
      console.error('[ticketSearchService] Pagination error:', paginateError.message);
      throw new DatabaseError(paginateError.message);
    }

    ticketIds = (paginatedTickets || []).map(t => t.id);

    // If no tickets in this page, return empty
    if (ticketIds.length === 0) {
      return {
        data: [],
        pagination: calculatePagination(page, limit, totalCount),
      };
    }
  } else {
    // Use RPC for server-side filtering (avoids URL length issues with large result sets)
    const { data: ticketResults, error: rpcError } = await supabase.rpc('search_tickets', {
      p_page: page,
      p_limit: limit,
      p_sort: sort || 'created_at',
      p_order: order || 'desc',
      p_start_date: filters.start_date || null,
      p_end_date: filters.end_date || null,
      p_date_type: rpcDateType,
      p_site_id: filters.site_id || null,
      p_status_id: filters.status_id || null,
      p_work_type_id: filters.work_type_id || null,
      p_assigner_id: filters.assigner_id || null,
      p_contact_id: filters.contact_id || null,
      p_details: filters.details || null,
      p_exclude_backlog: filters.exclude_backlog || false,
      p_only_backlog: filters.only_backlog || false,
      p_employee_id: Array.isArray(filters.employee_id) ? filters.employee_id[0] : (filters.employee_id || null),
      p_department_id: Array.isArray(filters.department_id) ? filters.department_id[0] : (filters.department_id || null),
      p_appointment_is_approved: filters.appointment_is_approved ?? null,
    });

    if (rpcError) {
      console.error('[ticketSearchService] RPC error:', rpcError.message);
      throw new DatabaseError(rpcError.message);
    }

    // Handle empty results
    if (!ticketResults || ticketResults.length === 0) {
      return {
        data: [],
        pagination: calculatePagination(page, limit, 0),
      };
    }

    // Extract ticket IDs and total count from RPC results
    ticketIds = ticketResults.map((r: { ticket_id: string }) => r.ticket_id);
    totalCount = Number(ticketResults[0]?.total_count || 0);
  }

  // Fetch full ticket data for the paginated IDs (limited set, safe for URL)
  const { data: rawTickets, error: ticketError } = await supabase
    .from('main_tickets')
    .select(`
      id,
      ticket_code,
      ticket_number,
      details,
      details_summary,
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
      work_type:ref_ticket_work_types(name, code),
      assigner:main_employees!main_tickets_assigner_id_fkey(id, name, code),
      creator:main_employees!main_tickets_created_by_fkey(id, name, code),
      status:ref_ticket_statuses(name, code),
      site:main_sites(
        id,
        name,
        province_code,
        district_code,
        subdistrict_code,
        address_detail,
        company:main_companies(name_th, name_en, tax_id)
      ),
      contact:child_site_contacts(id, person_name),
      appointment:main_appointments!main_tickets_appointment_id_fkey(
        id,
        appointment_date,
        appointment_time_start,
        appointment_time_end,
        appointment_type,
        is_approved
      ),
      employees:jct_ticket_employees(
        id,
        date,
        is_key_employee,
        employee:main_employees(id, name, code, profile_image_url)
      ),
      confirmed_technicians:jct_ticket_employees_cf(
        id,
        date,
        employee:main_employees!jct_ticket_employees_cf_employee_id_fkey(id, name, code, profile_image_url)
      ),
      merchandise:jct_ticket_merchandise(
        merchandise:main_merchandise(
          id,
          serial_no,
          model:main_models(model)
        )
      ),
      work_giver:child_ticket_work_givers!child_ticket_work_givers_ticket_id_fkey(
        id,
        work_giver_id,
        work_giver:ref_work_givers!child_ticket_work_givers_work_giver_id_fkey(id, code, name)
      )
    `)
    .in('id', ticketIds);

  if (ticketError) {
    throw new DatabaseError(ticketError.message);
  }

  // Sort results to match RPC order (RPC returns in sorted order)
  const ticketMap = new Map((rawTickets || []).map(t => [t.id, t]));
  const orderedTickets = ticketIds.map((id: string) => ticketMap.get(id)).filter(Boolean) as Record<string, unknown>[];

  // Extract location codes for batch resolution
  const locationInputs = orderedTickets.map(ticket => {
    const site = ticket.site as { 
      province_code?: number | null;
      district_code?: number | null;
      subdistrict_code?: number | null;
      address_detail?: string | null;
    } | null;
    
    return {
      provinceCode: site?.province_code || null,
      districtCode: site?.district_code || null,
      subdistrictCode: site?.subdistrict_code || null,
      addressDetail: site?.address_detail || null,
    };
  });

  // Batch resolve all locations (single database call for districts/subdistricts)
  const resolvedLocations = await batchResolveLocations(locationInputs);

  // Batch fetch work_givers for all tickets (fallback if join doesn't return data)
  const workGiverMap = new Map<string, { id: string; code: string; name: string }>();
  if (ticketIds.length > 0) {
    const { data: workGiverData } = await supabase
      .from('child_ticket_work_givers')
      .select(`
        ticket_id,
        ref_work_givers:work_giver_id (
          id,
          code,
          name
        )
      `)
      .in('ticket_id', ticketIds);
    
    if (workGiverData) {
      for (const wg of workGiverData) {
        if (wg.ref_work_givers && wg.ticket_id) {
          const refWg = wg.ref_work_givers as { id: string; code: string; name: string };
          workGiverMap.set(wg.ticket_id as string, {
            id: refWg.id,
            code: refWg.code,
            name: refWg.name,
          });
        }
      }
    }
  }

  // Transform tickets to display format
  const displayItems: TicketDisplayItem[] = orderedTickets.map((ticket, index) => {
    const item = createTicketDisplayItem(ticket, resolvedLocations[index], include);
    // Apply work_giver from fallback if join didn't return it
    if (!item.work_giver && workGiverMap.has(ticket.id as string)) {
      item.work_giver = workGiverMap.get(ticket.id as string) || null;
    }
    return item;
  });

  return {
    data: displayItems,
    pagination: calculatePagination(page, limit, totalCount),
  };
}

/**
 * Search tickets by duration (date range) with selectable date type
 * Uses server-side RPC for filtering to avoid URL length issues
 */
export async function searchByDuration(params: {
  page: number;
  limit: number;
  startDate: string;
  endDate: string;
  dateType: DateType;
  sort?: string;
  order?: 'asc' | 'desc';
  include?: IncludeMode;
}): Promise<{ data: TicketDisplayItem[]; pagination: PaginationInfo }> {
  const supabase = createServiceClient();
  const { page, limit, startDate, endDate, dateType, sort, order, include = 'full' } = params;

  // Map dateType to RPC parameter
  const rpcDateType = dateType === 'create' ? 'created' : dateType === 'update' ? 'updated' : 'appointed';

  // Use comprehensive RPC for server-side filtering
  const { data: ticketResults, error: rpcError } = await supabase.rpc('search_tickets', {
    p_page: page,
    p_limit: limit,
    p_sort: sort || 'created_at',
    p_order: order || 'desc',
    p_start_date: startDate,
    p_end_date: endDate,
    p_date_type: rpcDateType,
    // No other filters for duration search
    p_site_id: null,
    p_status_id: null,
    p_work_type_id: null,
    p_assigner_id: null,
    p_contact_id: null,
    p_details: null,
    p_exclude_backlog: false,
    p_only_backlog: false,
    p_employee_id: null,
    p_department_id: null,
  });

  if (rpcError) {
    console.error('[ticketSearchService] RPC error:', rpcError.message);
    throw new DatabaseError(rpcError.message);
  }

  // Handle empty results
  if (!ticketResults || ticketResults.length === 0) {
    return {
      data: [],
      pagination: calculatePagination(page, limit, 0),
    };
  }

  // Extract ticket IDs and total count
  const ticketIds = ticketResults.map((r: { ticket_id: string }) => r.ticket_id);
  const totalCount = Number(ticketResults[0]?.total_count || 0);

  // Fetch full ticket data for the paginated IDs
  const { data: rawTickets, error: ticketError } = await supabase
    .from('main_tickets')
    .select(`
      id,
      ticket_code,
      ticket_number,
      details,
      details_summary,
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
      work_type:ref_ticket_work_types(name, code),
      assigner:main_employees!main_tickets_assigner_id_fkey(id, name, code),
      creator:main_employees!main_tickets_created_by_fkey(id, name, code),
      status:ref_ticket_statuses(name, code),
      site:main_sites(
        id,
        name,
        province_code,
        district_code,
        subdistrict_code,
        address_detail,
        company:main_companies(name_th, name_en, tax_id)
      ),
      contact:child_site_contacts(id, person_name),
      appointment:main_appointments!main_tickets_appointment_id_fkey(
        id,
        appointment_date,
        appointment_time_start,
        appointment_time_end,
        appointment_type,
        is_approved
      ),
      employees:jct_ticket_employees(
        id,
        date,
        is_key_employee,
        employee:main_employees(id, name, code, profile_image_url)
      ),
      confirmed_technicians:jct_ticket_employees_cf(
        id,
        date,
        employee:main_employees!jct_ticket_employees_cf_employee_id_fkey(id, name, code, profile_image_url)
      ),
      merchandise:jct_ticket_merchandise(
        merchandise:main_merchandise(
          id,
          serial_no,
          model:main_models(model)
        )
      ),
      work_giver:child_ticket_work_givers!child_ticket_work_givers_ticket_id_fkey(
        id,
        work_giver_id,
        work_giver:ref_work_givers!child_ticket_work_givers_work_giver_id_fkey(id, code, name)
      )
    `)
    .in('id', ticketIds);

  if (ticketError) {
    throw new DatabaseError(ticketError.message);
  }

  // Sort results to match RPC order
  const ticketMap = new Map((rawTickets || []).map(t => [t.id, t]));
  const orderedTickets = ticketIds.map((id: string) => ticketMap.get(id)).filter(Boolean) as Record<string, unknown>[];

  // Extract location codes for batch resolution
  const locationInputs = orderedTickets.map(ticket => {
    const site = ticket.site as {
      province_code?: number | null;
      district_code?: number | null;
      subdistrict_code?: number | null;
      address_detail?: string | null;
    } | null;

    return {
      provinceCode: site?.province_code || null,
      districtCode: site?.district_code || null,
      subdistrictCode: site?.subdistrict_code || null,
      addressDetail: site?.address_detail || null,
    };
  });

  // Batch resolve all locations
  const resolvedLocations = await batchResolveLocations(locationInputs);

  // Batch fetch work_givers for all tickets (fallback if join doesn't return data)
  const workGiverMap = new Map<string, { id: string; code: string; name: string }>();
  if (ticketIds.length > 0) {
    const { data: workGiverData } = await supabase
      .from('child_ticket_work_givers')
      .select(`
        ticket_id,
        ref_work_givers:work_giver_id (
          id,
          code,
          name
        )
      `)
      .in('ticket_id', ticketIds);

    if (workGiverData) {
      for (const wg of workGiverData) {
        if (wg.ref_work_givers && wg.ticket_id) {
          const refWg = wg.ref_work_givers as { id: string; code: string; name: string };
          workGiverMap.set(wg.ticket_id as string, {
            id: refWg.id,
            code: refWg.code,
            name: refWg.name,
          });
        }
      }
    }
  }

  // Transform tickets to display format
  const displayItems: TicketDisplayItem[] = orderedTickets.map((ticket, index) => {
    const item = createTicketDisplayItem(ticket, resolvedLocations[index], include);
    // Apply work_giver from fallback if join didn't return it
    if (!item.work_giver && workGiverMap.has(ticket.id as string)) {
      item.work_giver = workGiverMap.get(ticket.id as string) || null;
    }
    return item;
  });

  return {
    data: displayItems,
    pagination: calculatePagination(page, limit, totalCount),
  };
}
