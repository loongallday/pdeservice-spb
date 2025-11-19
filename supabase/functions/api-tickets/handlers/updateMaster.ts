/**
 * Update master ticket handler - Update ticket with all related data
 */

import { success } from '../_shared/response.ts';
import { requireMinLevel } from '../_shared/auth.ts';
import { MasterTicketService } from '../services/masterTicketService.ts';
import type { Employee } from '../_shared/auth.ts';
import type { MasterTicketUpdateInput } from '../services/masterTicketService.ts';

export async function updateMaster(req: Request, employee: Employee, ticketId: string) {
  // Check permissions - Level 1 and above can update master tickets
  await requireMinLevel(employee, 1);

  // Parse request body
  const body = await req.json() as MasterTicketUpdateInput;

  // Update master ticket
  const result = await MasterTicketService.updateMaster(ticketId, body);

  return success(result);
}

