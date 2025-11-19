/**
 * Remove merchandise from ticket handler
 */

import { success } from '../_shared/response.ts';
import { requireMinLevel } from '../_shared/auth.ts';
import { validateUUID } from '../_shared/validation.ts';
import { TicketService } from '../services/ticketService.ts';
import type { Employee } from '../_shared/auth.ts';

export async function removeMerchandise(req: Request, employee: Employee, ticketId: string, merchandiseId: string) {
  // Check permissions - Level 1 and above can remove merchandise
  await requireMinLevel(employee, 1);

  // Validate IDs
  validateUUID(ticketId, 'Ticket ID');
  validateUUID(merchandiseId, 'Merchandise ID');

  // Remove merchandise from ticket
  await TicketService.removeMerchandise(ticketId, merchandiseId);

  return success({ message: 'ลบการเชื่อมโยงอุปกรณ์สำเร็จ' });
}



