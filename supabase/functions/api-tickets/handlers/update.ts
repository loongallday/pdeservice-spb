/**
 * Update ticket handler
 */

import { success } from '../_shared/response.ts';
import { requireLevelGreaterThanZero } from '../_shared/auth.ts';
import { parseRequestBody, validateUUID, validateRequired } from '../_shared/validation.ts';
import { TicketService } from '../services/ticketService.ts';
import type { Employee } from '../_shared/auth.ts';

export async function update(req: Request, employee: Employee, id: string) {
  // Check permissions - Level > 0 can update tickets
  await requireLevelGreaterThanZero(employee);

  // Validate ID
  validateUUID(id, 'Ticket ID');

  // Parse request body
  const body = await parseRequestBody<{
    ticketData: Record<string, unknown>;
    employeeIds?: string[];
    merchandiseIds?: string[];
  }>(req);

  // Validate required fields
  validateRequired(body.ticketData, 'ข้อมูลตั๋วงาน');

  // Update ticket
  const ticket = await TicketService.update(id, body.ticketData, body.employeeIds, body.merchandiseIds);

  return success(ticket);
}

