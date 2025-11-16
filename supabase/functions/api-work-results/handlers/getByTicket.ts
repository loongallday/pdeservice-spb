/**
 * Get work result by ticket handler
 */

import { success } from '../../_shared/response.ts';
import { requireMinLevel } from '../../_shared/auth.ts';
import { validateUUID } from '../../_shared/validation.ts';
import { WorkResultService } from '../services/workResultService.ts';
import type { Employee } from '../../_shared/auth.ts';

export async function getByTicket(req: Request, employee: Employee, ticketId: string) {
  // Check permissions - Level 0 (all authenticated users) and above can view work results
  await requireMinLevel(employee, 0);

  // Validate ticket ID
  validateUUID(ticketId, 'Ticket ID');

  // Fetch work result
  const workResult = await WorkResultService.getByTicket(ticketId);

  return success(workResult);
}

