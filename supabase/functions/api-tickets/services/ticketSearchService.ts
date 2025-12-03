/**
 * Ticket search service - Business logic for searching tickets
 */

import { createServiceClient } from '../_shared/supabase.ts';
import { NotFoundError, DatabaseError } from '../_shared/error.ts';
import { calculatePagination } from '../_shared/response.ts';
import type { PaginationInfo } from '../_shared/response.ts';
import type { DateType } from './ticketTypes.ts';

/**
 * Get single ticket by ID with full details (site, appointment, work result)
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
      work_result_id,
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

  // Get work result details if work_result_id exists
  let workResult = null;
  if (data.work_result_id) {
    const { data: wrData, error: wrError } = await supabase
      .from('work_results')
      .select(`
        *,
        photos:work_result_photos(*),
        documents:work_result_documents(*,pages:work_result_document_pages(*))
      `)
      .eq('id', data.work_result_id)
      .single();

    if (wrError && wrError.code !== 'PGRST116') {
      throw new DatabaseError(wrError.message);
    }
    workResult = wrData || null;
  }

  // Transform data to flatten employees array and add work result
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
      ? data.employees.map((te: Record<string, unknown>) => (te as { employee: Record<string, unknown> }).employee).filter(Boolean)
      : [],
    work_result: workResult,
    creator_name: creator?.name || null,
    creator_code: creator?.code || null,
    merchandise: merchandise,
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
  work_result_id?: string;
  appointment_id?: string;
  created_at?: string; // Date string (YYYY-MM-DD) or range
  updated_at?: string; // Date string (YYYY-MM-DD) or range
  start_date?: string; // Start date for appointment date filtering (YYYY-MM-DD)
  end_date?: string; // End date for appointment date filtering (YYYY-MM-DD)
  exclude_backlog?: boolean; // Exclude tickets with appointment_id = NULL
  department_id?: string | string[]; // Single department_id or array of department_ids
}): Promise<{ data: Record<string, unknown>[]; pagination: PaginationInfo }> {
  const supabase = createServiceClient();
  const { page, limit, ...filters } = params;

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
      work_result_id,
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
    countQuery = countQuery.ilike('details', `%${filters.details}%`);
    dataQuery = dataQuery.ilike('details', `%${filters.details}%`);
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
  if (filters.work_result_id) {
    countQuery = countQuery.eq('work_result_id', filters.work_result_id);
    dataQuery = dataQuery.eq('work_result_id', filters.work_result_id);
  }
  if (filters.appointment_id) {
    countQuery = countQuery.eq('appointment_id', filters.appointment_id);
    dataQuery = dataQuery.eq('appointment_id', filters.appointment_id);
  }
  if (filters.created_at) {
    // Support date range format: "YYYY-MM-DD,YYYY-MM-DD" or single date "YYYY-MM-DD"
    const dateParts = filters.created_at.split(',');
    if (dateParts.length === 2) {
      countQuery = countQuery.gte('created_at', dateParts[0]).lte('created_at', dateParts[1]);
      dataQuery = dataQuery.gte('created_at', dateParts[0]).lte('created_at', dateParts[1]);
    } else {
      countQuery = countQuery.gte('created_at', filters.created_at).lt('created_at', new Date(new Date(filters.created_at).getTime() + 24 * 60 * 60 * 1000).toISOString());
      dataQuery = dataQuery.gte('created_at', filters.created_at).lt('created_at', new Date(new Date(filters.created_at).getTime() + 24 * 60 * 60 * 1000).toISOString());
    }
  }
  if (filters.updated_at) {
    // Support date range format: "YYYY-MM-DD,YYYY-MM-DD" or single date "YYYY-MM-DD"
    const dateParts = filters.updated_at.split(',');
    if (dateParts.length === 2) {
      countQuery = countQuery.gte('updated_at', dateParts[0]).lte('updated_at', dateParts[1]);
      dataQuery = dataQuery.gte('updated_at', dateParts[0]).lte('updated_at', dateParts[1]);
    } else {
      countQuery = countQuery.gte('updated_at', filters.updated_at).lt('updated_at', new Date(new Date(filters.updated_at).getTime() + 24 * 60 * 60 * 1000).toISOString());
      dataQuery = dataQuery.gte('updated_at', filters.updated_at).lt('updated_at', new Date(new Date(filters.updated_at).getTime() + 24 * 60 * 60 * 1000).toISOString());
    }
  }

  // Filter by appointment date (start_date and end_date)
  if (filters.start_date && filters.end_date) {
    // Get appointment IDs in the date range
    const { data: appointments, error: appError } = await supabase
      .from('appointments')
      .select('id')
      .gte('appointment_date', filters.start_date)
      .lte('appointment_date', filters.end_date);

    if (appError) throw new DatabaseError(appError.message);

    const appointmentIds = appointments?.map(a => a.id) || [];
    
    if (appointmentIds.length === 0) {
      // No appointments in range, return empty result
      return {
        data: [],
        pagination: calculatePagination(params.page, params.limit, 0),
      };
    }

    // Filter tickets by appointment_id - this automatically excludes tickets with null appointment_id
    countQuery = countQuery.in('appointment_id', appointmentIds);
    dataQuery = dataQuery.in('appointment_id', appointmentIds);
  }

  // Exclude backlog (tickets with null appointment_id)
  if (filters.exclude_backlog) {
    // Filter out tickets where appointment_id is null
    countQuery = countQuery.not('appointment_id', 'is', null);
    dataQuery = dataQuery.not('appointment_id', 'is', null);
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

  // Get total count
  const { count, error: countError } = await countQuery;
  if (countError) throw new DatabaseError(countError.message);
  const total = count || 0;

  // Get paginated data
  const offset = (page - 1) * limit;
  const { data, error } = await dataQuery
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw new DatabaseError(error.message);

  // Transform data to flatten nested objects into display fields
  const transformedData = (data || []).map(ticket => {
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
      company?: { name_th?: string; name_en?: string } | null;
    } | null;
    const contact = ticket.contact as { person_name?: string } | null;
    // Try appointment via appointment_id first, then via ticket_id (fallback for old tickets)
    const appointmentById = ticket.appointment as { 
      id?: string;
      appointment_date?: string;
      appointment_time_start?: string;
      appointment_time_end?: string;
      appointment_type?: string;
    } | null;
    const appointmentByTicketId = ticket.appointment_by_ticket as { 
      id?: string;
      appointment_date?: string;
      appointment_time_start?: string;
      appointment_time_end?: string;
      appointment_type?: string;
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
      company_name: site?.company?.name_th || site?.company?.name_en || null,
      provinceCode: site?.province_code || null,
      districtCode: site?.district_code || null,
      subDistrictCode: site?.subdistrict_code || null,
      contact_name: contact?.person_name || null,
      appointment_id: appointment?.id || ticket.appointment_id || null,
      appointment_date: appointment?.appointment_date || null,
      appointment_time_start: appointment?.appointment_time_start || null,
      appointment_time_end: appointment?.appointment_time_end || null,
      appointment_type: appointment?.appointment_type || null,
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
  });

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
}): Promise<{ data: Record<string, unknown>[]; pagination: PaginationInfo }> {
  const supabase = createServiceClient();
  const { page, limit, startDate, endDate, dateType } = params;

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
      work_result_id,
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
      .select('id')
      .gte('appointment_date', startDate)
      .lte('appointment_date', endDate);

    if (appError) throw new DatabaseError(appError.message);

    const appointmentIds = appointments?.map(a => a.id) || [];
    
    if (appointmentIds.length === 0) {
      // No appointments in range, return empty result
      return {
        data: [],
        pagination: calculatePagination(page, limit, 0),
      };
    }

    countQuery = countQuery.in('appointment_id', appointmentIds);
    dataQuery = dataQuery.in('appointment_id', appointmentIds);
  }

  // Get total count
  const { count, error: countError } = await countQuery;
  if (countError) throw new DatabaseError(countError.message);
  const total = count || 0;

  // Get paginated data
  const offset = (page - 1) * limit;
  const { data, error } = await dataQuery
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw new DatabaseError(error.message);

  // Transform data to flatten nested objects into display fields
  const transformedData = (data || []).map(ticket => {
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
      company?: { name_th?: string; name_en?: string } | null;
    } | null;
    const contact = ticket.contact as { person_name?: string } | null;
    // Try appointment via appointment_id first, then via ticket_id (fallback for old tickets)
    const appointmentById = ticket.appointment as { 
      id?: string;
      appointment_date?: string;
      appointment_time_start?: string;
      appointment_time_end?: string;
      appointment_type?: string;
    } | null;
    const appointmentByTicketId = ticket.appointment_by_ticket as { 
      id?: string;
      appointment_date?: string;
      appointment_time_start?: string;
      appointment_time_end?: string;
      appointment_type?: string;
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
      company_name: site?.company?.name_th || site?.company?.name_en || null,
      provinceCode: site?.province_code || null,
      districtCode: site?.district_code || null,
      subDistrictCode: site?.subdistrict_code || null,
      contact_name: contact?.person_name || null,
      appointment_id: appointment?.id || ticket.appointment_id || null,
      appointment_date: appointment?.appointment_date || null,
      appointment_time_start: appointment?.appointment_time_start || null,
      appointment_time_end: appointment?.appointment_time_end || null,
      appointment_type: appointment?.appointment_type || null,
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
  });

  return {
    data: transformedData,
    pagination: calculatePagination(page, limit, total),
  };
}

