/**
 * Get confirmed technicians handler
 */

import { success } from '../../_shared/response.ts';
import { requireMinLevel } from '../../_shared/auth.ts';
import { validateUUID } from '../../_shared/validation.ts';
import { TechnicianConfirmationService } from '../services/technicianConfirmationService.ts';
import type { Employee } from '../../_shared/auth.ts';

export async function getConfirmedTechnicians(req: Request, employee: Employee, ticketId: string) {
  // Check permissions - Level 0 and above can view confirmed technicians
  await requireMinLevel(employee, 0);

  // Validate ticket ID
  validateUUID(ticketId, 'Ticket ID');

  // Get optional date parameter
  const url = new URL(req.url);
  const date = url.searchParams.get('date') || undefined;

  // Get confirmed technicians
  const result = await TechnicianConfirmationService.getConfirmedTechnicians(ticketId, date);

  return success(result);
}

