/**
 * Ticket helper service - Helper methods for ticket operations
 */

import { createServiceClient } from '../_shared/supabase.ts';
import { DatabaseError, ValidationError } from '../_shared/error.ts';

/**
 * Check if employees have conflicting appointments
 * Returns array of employee IDs that have conflicts
 * Uses a database function for efficient conflict checking
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

  // Use database function for efficient conflict checking
  // This replaces complex in-memory logic with a single database call
  const { data: conflicts, error } = await supabase.rpc(
    'check_employee_appointment_conflicts',
    {
      p_employee_ids: employeeIds,
      p_date: appointmentDate,
      p_time_start: appointmentTimeStart || null,
      p_time_end: appointmentTimeEnd || null,
      p_exclude_ticket_id: excludeTicketId || null,
    }
  );

  if (error) {
    throw new ValidationError(`ไม่สามารถตรวจสอบความพร้อมของพนักงานได้: ${error.message}`);
  }

  if (!conflicts || conflicts.length === 0) {
    return [];
  }

  // Extract employee IDs from the result
  return conflicts.map((c: { conflicted_employee_id: string }) => c.conflicted_employee_id);
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
 * Uses batch validation to avoid N+1 queries
 */
export async function linkMerchandiseToTicket(ticketId: string, merchandiseIds: string[], siteId: string | null): Promise<void> {
  const supabase = createServiceClient();
  const uniqueMerchandiseIds = [...new Set(merchandiseIds)];

  if (uniqueMerchandiseIds.length === 0) {
    return;
  }

  // Batch query: Validate all merchandise exist at once
  const { data: merchandiseList, error: merchError } = await supabase
    .from('merchandise')
    .select('id, site_id')
    .in('id', uniqueMerchandiseIds);

  if (merchError) {
    throw new DatabaseError(`ไม่สามารถดึงข้อมูลอุปกรณ์ได้: ${merchError.message}`);
  }

  // Check for missing merchandise IDs
  const foundIds = new Set((merchandiseList || []).map(m => m.id as string));
  const invalidIds = uniqueMerchandiseIds.filter(id => !foundIds.has(id));
  if (invalidIds.length > 0) {
    throw new ValidationError(`ไม่พบอุปกรณ์: ${invalidIds.join(', ')}`);
  }

  // Batch validate site match
  if (siteId) {
    const mismatchedMerchandise = (merchandiseList || []).filter(m => 
      m.site_id && m.site_id !== siteId
    );
    if (mismatchedMerchandise.length > 0) {
      const mismatchedIds = mismatchedMerchandise.map(m => m.id).join(', ');
      throw new ValidationError(`อุปกรณ์ต่อไปนี้ต้องอยู่ในสถานที่เดียวกับตั๋วงาน: ${mismatchedIds}`);
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

