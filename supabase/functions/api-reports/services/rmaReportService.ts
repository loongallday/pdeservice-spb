/**
 * Work Type Report Service
 * Fetches ticket data by work type for Excel export
 */

import { createServiceClient } from '../../_shared/supabase.ts';
import { DatabaseError } from '../../_shared/error.ts';

// Province names cache
let provinceCache: Map<number, string> | null = null;

// Work type display names
export const WORK_TYPE_DISPLAY: Record<string, string> = {
  rma: 'RMA',
  pm: 'PM',
  sales: 'Sales',
};

/**
 * Load province names into cache
 */
async function loadProvinceCache(): Promise<Map<number, string>> {
  if (provinceCache) return provinceCache;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('ref_provinces')
    .select('id, name_th');

  if (error) {
    console.error('[workTypeReportService] Failed to load provinces:', error.message);
    return new Map();
  }

  provinceCache = new Map();
  for (const province of data || []) {
    provinceCache.set(province.id, province.name_th);
  }

  return provinceCache;
}

export interface WorkTypeTicketData {
  id: string;
  details: string | null;
  site: {
    name: string | null;
    province_code: number | null;
    company: {
      name_th: string | null;
      name_en: string | null;
    } | null;
  } | null;
  appointment: {
    appointment_date: string | null;
    appointment_type: string | null;
    appointment_time_start: string | null;
    appointment_time_end: string | null;
  } | null;
  confirmed_technicians: Array<{
    employee: {
      name: string | null;
      nickname: string | null;
    } | null;
  }>;
  employees: Array<{
    employee: {
      name: string | null;
      nickname: string | null;
    } | null;
  }>;
  location: {
    province_name: string | null;
  };
}

// Keep backward compatibility
export type RmaTicketData = WorkTypeTicketData;

/**
 * Fetch tickets by work type for a date range
 */
export async function fetchTicketsByWorkType(
  workTypeCode: string,
  startDate: string,
  endDate: string
): Promise<WorkTypeTicketData[]> {
  const supabase = createServiceClient();

  // Get the work type ID
  const { data: workType, error: wtError } = await supabase
    .from('ref_ticket_work_types')
    .select('id, name')
    .eq('code', workTypeCode)
    .single();

  if (wtError || !workType) {
    console.error(`[workTypeReportService] Failed to find ${workTypeCode} work type:`, wtError?.message);
    throw new DatabaseError(`ไม่พบประเภทงาน ${WORK_TYPE_DISPLAY[workTypeCode] || workTypeCode} ในระบบ`);
  }

  // Fetch tickets with work type and appointment date in range
  const { data: tickets, error: ticketError } = await supabase
    .from('main_tickets')
    .select(`
      id,
      details,
      site:main_sites(
        name,
        province_code,
        company:main_companies(name_th, name_en)
      ),
      appointment:main_appointments!main_tickets_appointment_id_fkey(
        appointment_date,
        appointment_type,
        appointment_time_start,
        appointment_time_end
      ),
      confirmed_technicians:jct_ticket_employees_cf(
        employee:main_employees!jct_ticket_employees_cf_employee_id_fkey(name, nickname)
      ),
      employees:jct_ticket_employees(
        employee:main_employees(name, nickname)
      )
    `)
    .eq('work_type_id', workType.id)
    .gte('appointment.appointment_date', startDate)
    .lte('appointment.appointment_date', endDate)
    .not('appointment', 'is', null)
    .order('appointment(appointment_date)', { ascending: true });

  if (ticketError) {
    console.error('[workTypeReportService] Failed to fetch tickets:', ticketError.message);
    throw new DatabaseError(ticketError.message);
  }

  // Load province cache
  const provinces = await loadProvinceCache();

  // Transform and add province names
  const result: WorkTypeTicketData[] = (tickets || []).map(ticket => {
    const site = ticket.site as {
      name: string | null;
      province_code: number | null;
      company: { name_th: string | null; name_en: string | null } | null;
    } | null;

    const provinceName = site?.province_code
      ? provinces.get(site.province_code) || null
      : null;

    return {
      id: ticket.id,
      details: ticket.details,
      site: site,
      appointment: ticket.appointment as {
        appointment_date: string | null;
        appointment_type: string | null;
        appointment_time_start: string | null;
        appointment_time_end: string | null;
      } | null,
      confirmed_technicians: (ticket.confirmed_technicians || []) as Array<{
        employee: { name: string | null; nickname: string | null } | null;
      }>,
      employees: (ticket.employees || []) as Array<{
        employee: { name: string | null; nickname: string | null } | null;
      }>,
      location: {
        province_name: provinceName,
      },
    };
  });

  // Filter out tickets without valid appointment dates (due to the join filter)
  return result.filter(t => t.appointment?.appointment_date);
}

/**
 * Fetch RMA tickets for a date range (backward compatible)
 */
export async function fetchRmaTickets(
  startDate: string,
  endDate: string
): Promise<RmaTicketData[]> {
  return fetchTicketsByWorkType('rma', startDate, endDate);
}
