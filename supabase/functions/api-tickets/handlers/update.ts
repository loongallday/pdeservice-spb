/**
 * Update ticket handler - Comprehensive ticket updates with all related data
 */

import { success } from '../../_shared/response.ts';
import { requireMinLevel } from '../../_shared/auth.ts';
import { validateUUID } from '../../_shared/validation.ts';
import { TicketService } from '../services/ticketService.ts';
import type { Employee } from '../../_shared/auth.ts';
import type { MasterTicketUpdateInput } from '../services/ticketService.ts';

export async function update(req: Request, employee: Employee, id: string) {
  // Check permissions - Level 1 and above can update tickets
  await requireMinLevel(employee, 1);

  // Validate ID
  validateUUID(id, 'Ticket ID');

  // Parse request body
  const body = await req.json() as MasterTicketUpdateInput;

  // Update comprehensive ticket
  const result = await TicketService.update(id, body, employee.id);

  return success(result);
}

