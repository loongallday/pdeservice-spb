/**
 * Delete ticket handler
 */

import { success } from '../_shared/response.ts';
import { requireLevelGreaterThanZero } from '../_shared/auth.ts';
import { validateUUID } from '../_shared/validation.ts';
import { TicketService } from '../services/ticketService.ts';
import { HTTP_STATUS } from '../_shared/constants.ts';
import type { Employee } from '../_shared/auth.ts';

export async function deleteTicket(req: Request, employee: Employee, id: string) {
  // Check permissions - Level > 0 can delete tickets
  await requireLevelGreaterThanZero(employee);

  // Validate ID
  validateUUID(id, 'Ticket ID');

  // Delete ticket
  await TicketService.delete(id);

  return success({ message: 'ลบตั๋วงานสำเร็จ' }, HTTP_STATUS.OK);
}

