/**
 * Search appointments handler
 */

import { success } from '../../_shared/response.ts';
import { requireMinLevel } from '../../_shared/auth.ts';
import { AppointmentService } from '../services/appointmentService.ts';
import type { Employee } from '../../_shared/auth.ts';

export async function search(req: Request, employee: Employee) {
  // Check permissions - Level 0 and above can search appointments
  await requireMinLevel(employee, 0);

  // Parse query parameters
  const url = new URL(req.url);
  const query = url.searchParams.get('q') || '';

  // Search appointments
  const results = await AppointmentService.search(query);

  return success(results);
}

