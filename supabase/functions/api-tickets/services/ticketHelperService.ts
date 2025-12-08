/**
 * Ticket helper service - Helper methods for ticket operations
 */

import { createServiceClient } from '../_shared/supabase.ts';
import { DatabaseError, ValidationError } from '../_shared/error.ts';

/**
 * Check if employees have conflicting appointments
 * Returns array of employee IDs that have conflicts
 */
export async function checkEmployeeAppointmentConflicts(
  employeeIds: string[],
  appointmentDate: string | null | undefined,
  appointmentTimeStart: string | null | undefined,
  appointmentTimeEnd: string | null | undefined,
  excludeTicketId?: string
): Promise<string[]> {
  if (!employeeIds || employeeIds.length === 0) {
    return [];
  }

  // If no appointment date, no conflicts possible
  if (!appointmentDate) {
    return [];
  }

  const supabase = createServiceClient();
  const conflictedEmployeeIds: string[] = [];

  // Query for existing appointments for these employees
  let conflictQuery = supabase
    .from('ticket_employees')
    .select(`
      employee_id,
      ticket:tickets!ticket_employees_ticket_id_fkey(
        id,
        appointment:appointments!tickets_appointment_id_fkey(
          appointment_date,
          appointment_time_start,
          appointment_time_end
        )
      )
    `)
    .in('employee_id', employeeIds);

  // Exclude current ticket if updating
  if (excludeTicketId) {
    conflictQuery = conflictQuery.neq('ticket_id', excludeTicketId);
  }

  const { data: ticketEmployees, error } = await conflictQuery;

  if (error) {
    throw new ValidationError(`ไม่สามารถตรวจสอบความพร้อมของพนักงานได้: ${error.message}`);
  }

  if (!ticketEmployees) {
    return [];
  }

  // Check each employee for conflicts
  for (const te of ticketEmployees) {
    const ticket = te.ticket as Record<string, unknown> | null;
    const appointment = ticket?.appointment as Record<string, unknown> | null;

    if (!appointment) continue;

    const apptDate = appointment.appointment_date as string | null;
    if (apptDate !== appointmentDate) continue;

    const empId = te.employee_id as string;
    if (!empId || conflictedEmployeeIds.includes(empId)) continue;

    // Get appointment time range (actual or predefined based on type)
    let apptTimeStart = appointment.appointment_time_start as string | null;
    let apptTimeEnd = appointment.appointment_time_end as string | null;
    const appointmentType = appointment.appointment_type as string | null;

    // Handle predefined time slots for appointments without explicit times
    if (appointmentType === 'call_to_schedule') {
      // call_to_schedule has no time - never overlaps (to be scheduled later)
      continue;
    }
    
    if (!apptTimeStart || !apptTimeEnd) {
      if (appointmentType === 'half_morning') {
        apptTimeStart = '08:00:00';
        apptTimeEnd = '12:00:00';
      } else if (appointmentType === 'half_afternoon') {
        apptTimeStart = '13:00:00';
        apptTimeEnd = '17:30:00';
      } else if (appointmentType === 'full_day') {
        apptTimeStart = '08:00:00';
        apptTimeEnd = '17:30:00';
      }
    }

    // If still no times after handling special types, skip
    if (!apptTimeStart || !apptTimeEnd) {
      continue;
    }

    // Skip zero-duration appointments (start == end)
    if (apptTimeStart === apptTimeEnd) {
      continue;
    }

    // If time is provided, check for time overlap
    if (appointmentTimeStart && appointmentTimeEnd) {
      // Check if time ranges overlap: start1 < end2 AND start2 < end1
      if (apptTimeStart < appointmentTimeEnd && apptTimeEnd > appointmentTimeStart) {
        conflictedEmployeeIds.push(empId);
      }
    } else {
      // If only date provided, any appointment with valid duration = conflict
      conflictedEmployeeIds.push(empId);
    }
  }

  return conflictedEmployeeIds;
}

/**
 * Log ticket audit entry
 */
export async function logTicketAudit(params: {
  ticketId: string;
  action: 'created' | 'updated' | 'deleted';
  changedBy: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  changedFields?: string[];
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const supabase = createServiceClient();
  const { ticketId, action, changedBy, oldValues, newValues, changedFields, metadata } = params;

  const auditData = {
    ticket_id: ticketId,
    action,
    changed_by: changedBy,
    old_values: oldValues || null,
    new_values: newValues || null,
    changed_fields: changedFields || null,
    metadata: metadata || null,
  };

  const { error } = await supabase
    .from('ticket_audit')
    .insert([auditData]);

  if (error) {
    // Log error but don't throw - audit logging should not break the main operation
    console.error('[ticket-audit] Failed to log audit entry:', error);
  }
}

/**
 * Link merchandise to ticket
 */
export async function linkMerchandiseToTicket(ticketId: string, merchandiseIds: string[], siteId: string | null): Promise<void> {
  const supabase = createServiceClient();
  const uniqueMerchandiseIds = [...new Set(merchandiseIds)];

  // Validate all merchandise exist and are in the same site
  for (const merchandiseId of uniqueMerchandiseIds) {
    const { data: merchandise, error: merchError } = await supabase
      .from('merchandise')
      .select('id, site_id')
      .eq('id', merchandiseId)
      .single();

    if (merchError) {
      throw new DatabaseError(`ไม่สามารถดึงข้อมูลอุปกรณ์ ${merchandiseId} ได้`);
    }
    if (!merchandise) {
      throw new ValidationError(`ไม่พบอุปกรณ์ ${merchandiseId}`);
    }

    // Validate site match
    if (siteId && merchandise.site_id && siteId !== merchandise.site_id) {
      throw new ValidationError(`อุปกรณ์ ${merchandiseId} ต้องอยู่ในสถานที่เดียวกับตั๋วงาน`);
    }
  }

  // Insert all associations
  const { error: insertError } = await supabase
    .from('ticket_merchandise')
    .insert(
      uniqueMerchandiseIds.map(merchandiseId => ({
        ticket_id: ticketId,
        merchandise_id: merchandiseId,
      }))
    );

  if (insertError) {
    if (insertError.message.includes('same site')) {
      throw new ValidationError('อุปกรณ์ต้องอยู่ในสถานที่เดียวกับตั๋วงาน');
    }
    throw new DatabaseError(`ไม่สามารถเชื่อมโยงอุปกรณ์ได้: ${insertError.message}`);
  }
}

