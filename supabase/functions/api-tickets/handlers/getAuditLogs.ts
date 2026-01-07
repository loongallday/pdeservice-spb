/**
 * Get audit logs for a ticket handler
 */

import { success } from '../../_shared/response.ts';
import { requireMinLevel } from '../../_shared/auth.ts';
import { validateUUID } from '../../_shared/validation.ts';
import { TicketAuditService } from '../services/ticketAuditService.ts';
import type { Employee } from '../../_shared/auth.ts';

export async function getAuditLogs(req: Request, employee: Employee, ticketId: string) {
  // Check permissions - Level 0 and above can view audit logs
  await requireMinLevel(employee, 0);

  // Validate ticket ID
  validateUUID(ticketId, 'Ticket ID');

  // Get query parameters for pagination
  const url = new URL(req.url);
  const page = parseInt(url.searchParams.get('page') || '1', 10);
  const limit = parseInt(url.searchParams.get('limit') || '50', 10);

  // Get audit logs from service
  const result = await TicketAuditService.getByTicketId({
    ticketId,
    page: Math.max(1, page),
    limit: Math.min(100, Math.max(1, limit)),
  });

  return success(result);
}

/**
 * Get recent audit logs across all tickets (for admin dashboard)
 */
export async function getRecentAuditLogs(req: Request, employee: Employee) {
  // Check permissions - Level 2+ (Admin) can view all audit logs
  await requireMinLevel(employee, 2);

  // Get query parameters for pagination
  const url = new URL(req.url);
  const page = parseInt(url.searchParams.get('page') || '1', 10);
  const limit = parseInt(url.searchParams.get('limit') || '50', 10);

  // Get recent audit logs from service
  const result = await TicketAuditService.getRecent({
    page: Math.max(1, page),
    limit: Math.min(100, Math.max(1, limit)),
  });

  return success(result);
}
