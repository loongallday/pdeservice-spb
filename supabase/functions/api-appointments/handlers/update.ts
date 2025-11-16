/**
 * Update appointment handler
 */

import { success } from '../../_shared/response.ts';
import { requireMinLevel } from '../../_shared/auth.ts';
import { parseRequestBody, validateUUID } from '../../_shared/validation.ts';
import { AppointmentService } from '../services/appointmentService.ts';
import type { Employee } from '../../_shared/auth.ts';

export async function update(req: Request, employee: Employee, id: string) {
  // Check permissions - Level 1 (non-technician_l1) and above can update appointments
  await requireMinLevel(employee, 1);

  // Validate ID
  validateUUID(id, 'Appointment ID');

  // Parse request body
  const body = await parseRequestBody<Record<string, unknown>>(req);

  // Validate ticket_id if provided
  if (body.ticket_id) {
    validateUUID(body.ticket_id as string, 'Ticket ID');
  }

  // Update appointment
  const appointment = await AppointmentService.update(id, body);

  return success(appointment);
}

