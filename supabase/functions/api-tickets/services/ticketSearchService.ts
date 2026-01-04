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
      merchandise:jct_ticket_merchandise(
        merchandise:main_merchandise(
          *,
          model:main_models(*)
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
  
  return {
    ...data,
    time: data.created_at, // Map created_at to time for frontend compatibility
    employees: Array.isArray(data.employees)
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
      : [],
    creator_name: creator?.name || null,
    creator_code: creator?.code || null,
    merchandise: merchandise,
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
  const creator = ticket.creator as { name?: string; code?: string } | null;
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
    
    // Content
    details: ticket.details as string | null,
    additional: ticket.additional as string | null,
    
    // Merchandise
    merchandise: merchandise,
    merchandise_count: merchandise.length,
    
    // Timestamps
    created_at: ticket.created_at as string,
    updated_at: ticket.updated_at as string,
  };

  // Add IDs for updates (only in full mode)
  if (includeMode === 'full') {
    displayItem._ids = {
      site_id: site?.id || ticket.site_id as string || null,
      status_id: ticket.status_id as string,
      work_type_id: ticket.work_type_id as string,
      assigner_id: ticket.assigner_id as string,
      contact_id: contact?.id || ticket.contact_id as string || null,
    };
  }

  return displayItem;
}

/**
 * Search tickets with filters for all ticket fields (paginated)
 * Returns display-ready data with pre-resolved location names
 * Uses server-side RPC for filtering to avoid URL length issues
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
  exclude_backlog?: boolean;
  only_backlog?: boolean;
  appointment_is_approved?: boolean;
  department_id?: string | string[];
  employee_id?: string | string[];
  sort?: string;
  order?: 'asc' | 'desc';
  include?: IncludeMode;
}): Promise<{ data: TicketDisplayItem[]; pagination: PaginationInfo }> {
  const supabase = createServiceClient();
  const { page, limit, sort, order, include = 'full', ...filters } = params;

  // Use RPC for server-side filtering (avoids URL length issues with large result sets)
  const { data: ticketResults, error: rpcError } = await supabase.rpc('search_tickets', {
    p_page: page,
    p_limit: limit,
    p_sort: sort || 'created_at',
    p_order: order || 'desc',
    p_start_date: filters.start_date || null,
    p_end_date: filters.end_date || null,
    p_date_type: 'appointed', // Default to appointment date filtering
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

  // Fetch full ticket data for the paginated IDs (limited set, safe for URL)
  const { data: rawTickets, error: ticketError } = await supabase
    .from('main_tickets')
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
      merchandise:jct_ticket_merchandise(
        merchandise:main_merchandise(
          id,
          serial_no,
          model:main_models(model)
        )
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

  // Transform tickets to display format
  const displayItems: TicketDisplayItem[] = orderedTickets.map((ticket, index) => 
    createTicketDisplayItem(ticket, resolvedLocations[index], include)
  );

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
      merchandise:jct_ticket_merchandise(
        merchandise:main_merchandise(
          id,
          serial_no,
          model:main_models(model)
        )
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

  // Transform tickets to display format
  const displayItems: TicketDisplayItem[] = orderedTickets.map((ticket, index) => 
    createTicketDisplayItem(ticket, resolvedLocations[index], include)
  );

  return {
    data: displayItems,
    pagination: calculatePagination(page, limit, totalCount),
  };
}
