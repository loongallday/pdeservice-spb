/**
 * List merchandise for a ticket handler
 */

import { success } from '../_shared/response.ts';
import { requireMinLevel } from '../_shared/auth.ts';
import { validateUUID } from '../_shared/validation.ts';
import { TicketService } from '../services/ticketService.ts';
import type { Employee } from '../_shared/auth.ts';

export async function listMerchandise(req: Request, employee: Employee, ticketId: string) {
  // Check permissions - Level 0 and above can view merchandise
  await requireMinLevel(employee, 0);

  // Validate ticket ID
  validateUUID(ticketId, 'Ticket ID');

  // Get merchandise for ticket
  const merchandise = await TicketService.getMerchandise(ticketId);

  return success(merchandise);
}



