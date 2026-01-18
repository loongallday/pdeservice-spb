/**
 * @fileoverview Get confirmed technicians for a ticket handler
 * @endpoint GET /api-tickets/:id/confirmed-technicians
 * @auth Required - Level 0+ (all authenticated users)
 *
 * @param {string} id - Ticket UUID (path parameter)
 * @queryParam {string} [date] - Optional: Filter by specific date (YYYY-MM-DD)
 *
 * @returns {ConfirmedTechnician[]} List of confirmed technicians
 * @throws {ValidationError} 400 - Invalid UUID format
 * @throws {AuthenticationError} 401 - If not authenticated
 *
 * @description
 * Returns the list of technicians who have been confirmed for a ticket's
 * appointment. Each technician record includes:
 * - Employee details (id, name, code)
 * - is_key flag (primary technician)
 * - Confirmation metadata (confirmed_by, confirmed_at)
 *
 * When date parameter is provided, filters to confirmations for that
 * specific appointment date.
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

