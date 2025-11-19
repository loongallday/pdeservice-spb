/**
 * Add merchandise to ticket handler
 */

import { success } from '../_shared/response.ts';
import { requireMinLevel } from '../_shared/auth.ts';
import { parseRequestBody, validateUUID, validateRequired } from '../_shared/validation.ts';
import { TicketService } from '../services/ticketService.ts';
import { HTTP_STATUS } from '../_shared/constants.ts';
import type { Employee } from '../_shared/auth.ts';

export async function addMerchandise(req: Request, employee: Employee, ticketId: string) {
  // Check permissions - Level 1 and above can add merchandise
  await requireMinLevel(employee, 1);

  // Validate ticket ID
  validateUUID(ticketId, 'Ticket ID');

  // Parse request body
  const body = await parseRequestBody<{ merchandise_id: string }>(req);

  // Validate required fields
  validateRequired(body.merchandise_id, 'Merchandise ID');
  validateUUID(body.merchandise_id, 'Merchandise ID');

  // Add merchandise to ticket (idempotent - returns existing if already linked)
  const { data, created } = await TicketService.addMerchandise(ticketId, body.merchandise_id);

  // Return 201 Created if newly created, 200 OK if already existed
  return success(data, created ? HTTP_STATUS.CREATED : 200);
}



