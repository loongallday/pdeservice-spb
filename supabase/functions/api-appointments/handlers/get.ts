/**
 * Get single appointment handler
 */

import { success } from '../../_shared/response.ts';
import { requireMinLevel } from '../../_shared/auth.ts';
import { validateUUID } from '../../_shared/validation.ts';
import { AppointmentService } from '../services/appointmentService.ts';
import type { Employee } from '../../_shared/auth.ts';

export async function get(req: Request, employee: Employee, id: string) {
  // Check permissions - Level 0 (all authenticated users) and above can view appointments
  await requireMinLevel(employee, 0);

  // Validate ID
  validateUUID(id, 'Appointment ID');

  // Fetch appointment
  const appointment = await AppointmentService.getById(id);

  return success(appointment);
}

