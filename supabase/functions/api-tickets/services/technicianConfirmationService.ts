/**
 * Technician confirmation service - Business logic for confirming technicians on tickets
 */

import { createServiceClient } from '../../_shared/supabase.ts';
import { NotFoundError, DatabaseError, ValidationError } from '../../_shared/error.ts';
import { AppointmentService } from '../../api-appointments/services/appointmentService.ts';
import { batchResolveLocations } from './locationResolver.ts';
import { logTicketAudit } from './ticketHelperService.ts';
import { NotificationService } from './notificationService.ts';

/**
 * Normalize employee_ids to array of objects with id and is_key
 */
function normalizeEmployeeIds(
  employeeIds: string[] | Array<{ id: string; is_key?: boolean }> | undefined
): Array<{ id: string; is_key: boolean }> {
  if (!employeeIds || employeeIds.length === 0) {
    return [];
  }

  // Check if it's the old format (string array)
  if (typeof employeeIds[0] === 'string') {
    return (employeeIds as string[]).map(id => ({ id, is_key: false }));
  }

  // New format (array of objects)
  return (employeeIds as Array<{ id: string; is_key?: boolean }>).map(emp => ({
    id: emp.id,
    is_key: emp.is_key ?? false,
  }));
}

export class TechnicianConfirmationService {
  /**
   * Confirm technicians for a ticket
   * Only creates records in jct_ticket_employees_cf (confirmation table)
   * Does NOT auto-create assignment in jct_ticket_employees
   */
  static async confirmTechnicians(
    ticketId: string,
    employeeIds: Array<{ id: string; is_key?: boolean }>,
    confirmedBy: string,
    notes?: string
  ): Promise<Array<Record<string, unknown>>> {
    const supabase = createServiceClient();

    // Validate ticket exists
    const { data: ticket, error: ticketError } = await supabase
      .from('main_tickets')
      .select('id, appointment_id')
      .eq('id', ticketId)
      .single();

    if (ticketError) {
      if (ticketError.code === 'PGRST116') {
        throw new NotFoundError('ไม่พบตั๋วงาน');
      }
      throw new DatabaseError(ticketError.message);
    }

    if (!ticket) {
      throw new NotFoundError('ไม่พบตั๋วงาน');
    }

    // Validate appointment exists and is approved
    if (!ticket.appointment_id) {
      throw new ValidationError('ตั๋วงานนี้ยังไม่มีนัดหมาย');
    }

    const appointment = await AppointmentService.getById(ticket.appointment_id as string);
    
    if (!appointment.is_approved) {
      throw new ValidationError('ต้องอนุมัติการนัดหมายก่อนยืนยันช่าง');
    }

    if (!appointment.appointment_date) {
      throw new ValidationError('การนัดหมายต้องมีวันที่');
    }

    const appointmentDate = appointment.appointment_date as string;

    // Normalize employee IDs
    const normalizedEmployees = normalizeEmployeeIds(employeeIds);

    if (normalizedEmployees.length === 0) {
      throw new ValidationError('กรุณาระบุช่างที่ต้องการยืนยัน');
    }

    // Remove duplicates by employee ID
    const uniqueEmployees = normalizedEmployees.filter((emp, index, self) =>
      index === self.findIndex(e => e.id === emp.id)
    );

    // Delete existing confirmations for this ticket and date (to allow re-confirmation)
    const { error: deleteError } = await supabase
      .from('jct_ticket_employees_cf')
      .delete()
      .eq('ticket_id', ticketId)
      .eq('date', appointmentDate);

    if (deleteError) {
      throw new DatabaseError(`ไม่สามารถลบการยืนยันเดิมได้: ${deleteError.message}`);
    }

    // Create new confirmations
    const { data: confirmations, error: confirmError } = await supabase
      .from('jct_ticket_employees_cf')
      .insert(
        uniqueEmployees.map(emp => ({
          ticket_id: ticketId,
          employee_id: emp.id,
          confirmed_by: confirmedBy,
          date: appointmentDate,
          notes: notes || null,
        }))
      )
      .select(`
        id,
        ticket_id,
        employee_id,
        confirmed_by,
        confirmed_at,
        date,
        notes,
        employee:main_employees!jct_ticket_employees_cf_employee_id_fkey(
          id,
          name,
          code
        ),
        confirmed_by_employee:main_employees!jct_ticket_employees_cf_confirmed_by_fkey(
          id,
          name,
          code
        )
      `);

    if (confirmError) {
      if (confirmError.message.includes('unique') || confirmError.message.includes('duplicate')) {
        throw new ValidationError('ช่างบางคนถูกยืนยันให้ตั๋วงานนี้ในวันที่นี้แล้ว');
      }
      throw new DatabaseError(`ไม่สามารถยืนยันช่างได้: ${confirmError.message}`);
    }

    // Log audit for technician confirmation
    const employeeNames = confirmations?.map((c: Record<string, unknown>) => {
      const emp = c.employee as { name?: string; code?: string } | null;
      return emp?.name || emp?.code || 'Unknown';
    }) || [];

    await logTicketAudit({
      ticketId,
      action: 'technician_confirmed',
      changedBy: confirmedBy,
      newValues: {
        confirmed_employees: uniqueEmployees.map(e => e.id),
        employee_names: employeeNames,
        date: appointmentDate,
      },
      metadata: {
        employee_count: uniqueEmployees.length,
        notes: notes || null,
      },
    });

    // Create notifications for confirmed technicians (async, don't wait)
    NotificationService.createTechnicianConfirmationNotifications(
      ticketId,
      uniqueEmployees.map(e => e.id),
      confirmedBy,
      appointmentDate
    ).catch(err => {
      console.error('[technician-confirmation] Failed to create notifications:', err);
    });

    return confirmations || [];
  }

  /**
   * Get confirmed technicians for a ticket
   */
  static async getConfirmedTechnicians(
    ticketId: string,
    date?: string
  ): Promise<Array<Record<string, unknown>>> {
    const supabase = createServiceClient();

    let query = supabase
      .from('jct_ticket_employees_cf')
      .select(`
        id,
        ticket_id,
        employee_id,
        confirmed_by,
        confirmed_at,
        date,
        notes,
        employee:main_employees!jct_ticket_employees_cf_employee_id_fkey(
          id,
          name,
          code,
          profile_image_url
        ),
        confirmed_by_employee:main_employees!jct_ticket_employees_cf_confirmed_by_fkey(
          id,
          name,
          code
        )
      `)
      .eq('ticket_id', ticketId)
      .order('confirmed_at', { ascending: false });

    if (date) {
      query = query.eq('date', date);
    }

    const { data, error } = await query;

    if (error) {
      throw new DatabaseError(`ไม่สามารถดึงข้อมูลช่างที่ยืนยันได้: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Format time to Thai style (e.g., "10.00 น.")
   */
  private static formatThaiTime(timeStr: string | null | undefined): string {
    if (!timeStr) return '';
    // Convert HH:MM:SS to HH.MM
    const parts = timeStr.split(':');
    if (parts.length >= 2) {
      return `${parts[0]}.${parts[1]} น.`;
    }
    return timeStr;
  }

  /**
   * Format appointment type to Thai display text
   */
  private static formatAppointmentType(appointmentType: string | null | undefined): string {
    if (!appointmentType) return '';

    const typeMap: Record<string, string> = {
      'half_morning': 'ครึ่งเช้า',
      'half_afternoon': 'ครึ่งบ่าย',
      'full_day': 'เต็มวัน',
      'time_range': 'ระบุเวลา',
      'call_to_schedule': 'โทรนัด',
      'backlog': 'Backlog',
    };

    return typeMap[appointmentType] || appointmentType;
  }

  /**
   * Generate summary text for a single ticket
   * Format: -WorkGiver - Company - Contact Phone - WorkType - Details – (Address) Time
   * WorkGiver defaults to "PDE" if not set
   * @param ticketId - The ticket ID
   * @param format - 'full' (default, preserves newlines) or 'compact' (replaces newlines with commas for LINE)
   */
  static async generateLineSummary(ticketId: string, format: 'full' | 'compact' = 'full'): Promise<string> {
    const supabase = createServiceClient();

    // Get ticket with all related data
    const { data: ticket, error: ticketError } = await supabase
      .from('main_tickets')
      .select(`
        id,
        details,
        created_at,
        work_type:ref_ticket_work_types(name, code),
        site:main_sites(
          id,
          name,
          province_code,
          district_code,
          subdistrict_code,
          address_detail,
          company:main_companies(name_th, name_en, tax_id)
        ),
        contact:child_site_contacts(
          id,
          person_name,
          phone
        ),
        appointment:main_appointments!main_tickets_appointment_id_fkey(
          id,
          appointment_date,
          appointment_time_start,
          appointment_time_end,
          appointment_type,
          is_approved
        ),
        confirmed_technicians:jct_ticket_employees_cf(
          employee:main_employees!jct_ticket_employees_cf_employee_id_fkey(
            id,
            name,
            code
          )
        ),
        work_giver:child_ticket_work_givers!child_ticket_work_givers_ticket_id_fkey(
          id,
          work_giver_id,
          work_giver:ref_work_givers!child_ticket_work_givers_work_giver_id_fkey(id, code, name)
        )
      `)
      .eq('id', ticketId)
      .single();

    if (ticketError) {
      if (ticketError.code === 'PGRST116') {
        throw new NotFoundError('ไม่พบตั๋วงาน');
      }
      throw new DatabaseError(ticketError.message);
    }

    if (!ticket) {
      throw new NotFoundError('ไม่พบตั๋วงาน');
    }

    // Resolve location
    const site = ticket.site as {
      province_code?: number | null;
      district_code?: number | null;
      subdistrict_code?: number | null;
      address_detail?: string | null;
      name?: string;
      company?: {
        name_th?: string;
        name_en?: string;
      };
    } | null;

    const locationInput = {
      provinceCode: site?.province_code || null,
      districtCode: site?.district_code || null,
      subdistrictCode: site?.subdistrict_code || null,
      addressDetail: site?.address_detail || null,
    };

    const [resolvedLocation] = await batchResolveLocations([locationInput]);

    // Format full address (compact format for LINE)
    const addressParts: string[] = [];
    if (site?.address_detail) {
      addressParts.push(site.address_detail);
    }
    if (resolvedLocation.subdistrict_name) {
      addressParts.push(resolvedLocation.subdistrict_name);
    }
    if (resolvedLocation.district_name) {
      addressParts.push(resolvedLocation.district_name);
    }
    if (resolvedLocation.province_name) {
      addressParts.push(resolvedLocation.province_name);
    }
    const fullAddress = addressParts.length > 0 ? addressParts.join(' ') : '';

    // Format appointment time and type
    const appointment = ticket.appointment as {
      appointment_date?: string;
      appointment_time_start?: string;
      appointment_time_end?: string;
      appointment_type?: string;
    } | null;

    const timeStr = this.formatThaiTime(appointment?.appointment_time_start);
    const typeStr = this.formatAppointmentType(appointment?.appointment_type);
    
    // Combine time and type (e.g., "นัดแล้ว 10.00 น." or "โทรนัด")
    let timeDisplay = '';
    if (typeStr && timeStr) {
      timeDisplay = `${typeStr} ${timeStr}`;
    } else if (typeStr) {
      timeDisplay = typeStr;
    } else if (timeStr) {
      timeDisplay = timeStr;
    }

    // Format contact info (คุณName Phone)
    const contact = ticket.contact as {
      person_name?: string;
      phone?: string[] | string;
    } | null;

    let contactDisplay = '';
    if (contact?.person_name) {
      // Avoid double "คุณ" prefix if name already starts with it
      const name = contact.person_name;
      contactDisplay = name.startsWith('คุณ') ? name : `คุณ${name}`;
      if (contact.phone) {
        const phones = Array.isArray(contact.phone) ? contact.phone : [contact.phone];
        if (phones.length > 0 && phones[0]) {
          contactDisplay += ` ${phones[0]}`;
        }
      }
    }

    // Get work type name
    const workType = ticket.work_type as { name?: string } | null;
    const workTypeName = workType?.name || '';

    // Get company name
    const companyName = site?.company?.name_th || site?.company?.name_en || '';

    // Get site name
    const siteName = site?.name || '';

    // Get work giver name (default to "PDE" if not set)
    let workGiverName = 'PDE';
    if (Array.isArray(ticket.work_giver) && ticket.work_giver.length > 0) {
      const workGiverLink = ticket.work_giver[0] as {
        work_giver: { name?: string } | null;
      };
      if (workGiverLink.work_giver?.name) {
        workGiverName = workGiverLink.work_giver.name;
      }
    }
    
    // Fallback: Query work_giver separately if join didn't return data
    if (workGiverName === 'PDE') {
      const { data: workGiverData } = await supabase
        .from('child_ticket_work_givers')
        .select(`
          ref_work_givers:work_giver_id (
            name
          )
        `)
        .eq('ticket_id', ticketId)
        .maybeSingle();
      
      if (workGiverData?.ref_work_givers) {
        const wg = workGiverData.ref_work_givers as { name: string };
        if (wg.name) {
          workGiverName = wg.name;
        }
      }
    }

    // Build clean, professional summary
    const lines: string[] = [];
    
    // Header: WorkGiver - Company - Contact - Time
    const headerParts: string[] = [];
    // Always add work giver at the start (prefix with -)
    headerParts.push(`-${workGiverName}`);
    if (companyName) {
      headerParts.push(companyName);
    }
    if (contactDisplay) {
      headerParts.push(contactDisplay);
    }
    if (timeDisplay) {
      headerParts.push(timeDisplay);
    }
    if (headerParts.length > 0) {
      lines.push(headerParts.join(' - '));
    }
    
    // Work Type + Details on same concept (cleaner)
    if (workTypeName || ticket.details) {
      const workLine: string[] = [];
      if (workTypeName) {
        workLine.push(`งาน: ${workTypeName}`);
      }
      if (ticket.details) {
        let details = (ticket.details as string).trim().replace(/\r\n/g, '\n');

        if (format === 'compact') {
          // Compact: replace newlines with comma-space for LINE messaging
          details = details.replace(/\n+/g, ', ').replace(/\s+/g, ' ');
        }
        // Full format: keep newlines as-is

        workLine.push(details);
      }
      lines.push(workLine.join(' | '));
    }
    
    // Location: Site name, Address (single line, comma separated)
    const locationParts: string[] = [];
    if (siteName) {
      locationParts.push(siteName);
    }
    if (fullAddress) {
      locationParts.push(fullAddress);
    }
    if (locationParts.length > 0) {
      lines.push(`สถานที่: ${locationParts.join(', ')}`);
    }

    return lines.join('\n');
  }

  /**
   * Format date to Thai style with day name
   * e.g., "วัน เสาร์ ที่ 27 ธันวาคม 2568"
   */
  private static formatThaiDateWithDay(dateStr: string): string {
    const date = new Date(dateStr);
    
    const dayNames = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
    const monthNames = [
      'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
      'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
    ];
    
    const dayName = dayNames[date.getDay()];
    const day = date.getDate();
    const month = monthNames[date.getMonth()];
    const year = date.getFullYear() + 543; // Buddhist Era
    
    return `วัน ${dayName} ที่ ${day} ${month} ${year}`;
  }

  /**
   * Get summaries grouped by technician combinations for a specific date
   * Returns formatted LINE-ready text
   */
  static async getSummariesGroupedByTechnicians(date: string, format: 'full' | 'compact' = 'full'): Promise<{
    date: string;
    date_display: string;
    team_count: number;
    groups: Array<{
      team_number: number;
      technician_ids: string[];
      technicians: Array<{ id: string; name: string; code: string }>;
      technician_display: string;
      tickets: Array<{
        ticket_id: string;
        summary: string;
        appointment_time: string;
        appointment_type: string;
        site_name: string;
        company_name: string;
      }>;
    }>;
    full_summary: string;
  }> {
    const supabase = createServiceClient();

    // Find all tickets with approved appointments on the specified date
    // Use !inner join to filter tickets by appointment date and approval status
    const { data: tickets, error: ticketsError } = await supabase
      .from('main_tickets')
      .select(`
        id,
        details,
        created_at,
        work_type:ref_ticket_work_types(name, code),
        site:main_sites(
          id,
          name,
          province_code,
          district_code,
          subdistrict_code,
          address_detail,
          company:main_companies(name_th, name_en, tax_id)
        ),
        contact:child_site_contacts(
          id,
          person_name,
          phone
        ),
        appointment:main_appointments!inner(
          id,
          appointment_date,
          appointment_time_start,
          appointment_time_end,
          appointment_type,
          is_approved
        ),
        confirmed_technicians:jct_ticket_employees_cf(
          employee_id,
          date,
          employee:main_employees!jct_ticket_employees_cf_employee_id_fkey(
            id,
            name,
            code
          )
        )
      `)
      .eq('appointment.appointment_date', date)
      .eq('appointment.is_approved', true);

    if (ticketsError) {
      throw new DatabaseError(`ไม่สามารถดึงข้อมูลตั๋วงานได้: ${ticketsError.message}`);
    }

    const dateDisplay = this.formatThaiDateWithDay(date);

    if (!tickets || tickets.length === 0) {
      return {
        date,
        date_display: dateDisplay,
        team_count: 0,
        groups: [],
        full_summary: `${dateDisplay} (ไม่มีงานคะ)`,
      };
    }

    // Filter tickets that have confirmed technicians
    const ticketsWithConfirmations = tickets.filter((ticket: Record<string, unknown>) => {
      const confirmed = ticket.confirmed_technicians as Array<Record<string, unknown>> | null;
      return confirmed && Array.isArray(confirmed) && confirmed.length > 0;
    });

    if (ticketsWithConfirmations.length === 0) {
      return {
        date,
        date_display: dateDisplay,
        team_count: 0,
        groups: [],
        full_summary: `${dateDisplay} (ยังไม่มีการยืนยันช่างคะ)`,
      };
    }

    // Group tickets by technician combinations
    const groupMap = new Map<string, {
      technician_ids: string[];
      technicians: Array<{ id: string; name: string; code: string }>;
      tickets: Array<Record<string, unknown>>;
    }>();

    for (const ticket of ticketsWithConfirmations) {
      const confirmed = ticket.confirmed_technicians as Array<{
        employee_id: string;
        employee: { id: string; name: string; code: string };
      }> | null;

      if (!confirmed || confirmed.length === 0) continue;

      // Create sorted array of technician IDs for grouping key
      const technicianIds = confirmed
        .map(cf => cf.employee_id)
        .sort()
        .join(',');

      // Get technician details
      const technicians = confirmed
        .map(cf => cf.employee)
        .filter(Boolean)
        .sort((a, b) => (a.code || '').localeCompare(b.code || ''));

      if (!groupMap.has(technicianIds)) {
        groupMap.set(technicianIds, {
          technician_ids: confirmed.map(cf => cf.employee_id),
          technicians,
          tickets: [],
        });
      }

      groupMap.get(technicianIds)!.tickets.push(ticket);
    }

    // Generate summaries for each ticket in each group
    const groupsArray = Array.from(groupMap.values());
    const groups = await Promise.all(
      groupsArray.map(async (group, index) => {
        const teamNumber = index + 1; // 1-indexed
        
        const ticketSummaries = await Promise.all(
          group.tickets.map(async (ticket: Record<string, unknown>) => {
            const summary = await this.generateLineSummary(ticket.id as string, format);

            const site = ticket.site as { name?: string; company?: { name_th?: string; name_en?: string } } | null;
            const appointment = ticket.appointment as {
              appointment_time_start?: string;
              appointment_time_end?: string;
              appointment_type?: string;
            } | null;

            const timeDisplay = appointment?.appointment_time_start && appointment?.appointment_time_end
              ? `${appointment.appointment_time_start}-${appointment.appointment_time_end}`
              : appointment?.appointment_time_start || '';

            return {
              ticket_id: ticket.id as string,
              summary,
              appointment_time: timeDisplay,
              appointment_type: this.formatAppointmentType(appointment?.appointment_type),
              site_name: site?.name || 'ไม่ระบุสถานที่',
              company_name: site?.company?.name_th || site?.company?.name_en || 'ไม่ระบุบริษัท',
            };
          })
        );

        // Sort tickets by appointment time
        ticketSummaries.sort((a, b) => {
          if (!a.appointment_time && !b.appointment_time) return 0;
          if (!a.appointment_time) return 1;
          if (!b.appointment_time) return -1;
          return a.appointment_time.localeCompare(b.appointment_time);
        });

        // Format technician display: "คุณName + คุณName"
        const technicianDisplay = group.technicians
          .map(t => `คุณ${t.name}`)
          .join(' + ');

        return {
          team_number: teamNumber,
          technician_ids: group.technician_ids,
          technicians: group.technicians,
          technician_display: technicianDisplay,
          tickets: ticketSummaries,
        };
      })
    );

    // Sort groups by team number
    groups.sort((a, b) => a.team_number - b.team_number);

    const teamCount = groups.length;

    // Build full summary text for LINE
    const summaryParts: string[] = [];
    
    // Header
    summaryParts.push(`${dateDisplay} (ออกงานทั้งหมด ${teamCount} ทีมคะ)`);
    summaryParts.push('');

    // Each team
    for (const group of groups) {
      // Team header
      summaryParts.push(`${group.team_number}. ${group.technician_display}`);
      
      // Tickets for this team
      for (const ticket of group.tickets) {
        summaryParts.push(ticket.summary);
      }
      
      summaryParts.push('');
    }

    const fullSummary = summaryParts.join('\n').trim();

    return {
      date,
      date_display: dateDisplay,
      team_count: teamCount,
      groups,
      full_summary: fullSummary,
    };
  }
}

