/**
 * List appointments handler
 */

import { success } from '../../_shared/response.ts';
import { requireMinLevel } from '../../_shared/auth.ts';
import { parsePaginationParams } from '../../_shared/validation.ts';
import { AppointmentService } from '../services/appointmentService.ts';
import type { Employee } from '../../_shared/auth.ts';

export async function list(req: Request, employee: Employee) {
  // Check permissions - Level 0 (all authenticated users) and above can view appointments
  await requireMinLevel(employee, 0);

  // Parse pagination and filters
  const url = new URL(req.url);
  const { page, limit } = parsePaginationParams(url);
  const ticket_id = url.searchParams.get('ticket_id') || undefined;

  // Fetch appointments
  const result = await AppointmentService.getAll({ page, limit, ticket_id });

  return success(result);
}

