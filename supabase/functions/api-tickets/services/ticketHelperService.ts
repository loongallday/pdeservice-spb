/**
 * Ticket helper service - Helper methods for ticket operations
 */

import { createServiceClient } from '../../_shared/supabase.ts';
import { DatabaseError, ValidationError } from '../../_shared/error.ts';

/**
 * Audit action types for comprehensive ticket tracking
 */
export type TicketAuditAction =
  | 'created'           // Ticket created
  | 'updated'           // Ticket fields updated
  | 'deleted'           // Ticket deleted
  | 'approved'          // Appointment approved
  | 'unapproved'        // Appointment un-approved
  | 'technician_confirmed'    // Technicians confirmed
  | 'technician_changed'      // Confirmed technicians changed
  | 'employee_assigned'       // Employees assigned (requested)
  | 'employee_removed'        // Employees removed from assignment
  | 'work_giver_set'          // Work giver assigned
  | 'work_giver_changed'      // Work giver changed
  | 'comment_added';          // Comment added to ticket

/**
 * Log ticket audit entry
 */
export async function logTicketAudit(params: {
  ticketId: string;
  action: TicketAuditAction;
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
    .from('child_ticket_audit')
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
      .from('main_merchandise')
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
    .from('jct_ticket_merchandise')
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

