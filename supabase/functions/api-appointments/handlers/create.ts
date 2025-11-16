/**
 * Create appointment handler
 */

import { success } from '../../_shared/response.ts';
import { requireMinLevel } from '../../_shared/auth.ts';
import { parseRequestBody, validateRequired, validateUUID } from '../../_shared/validation.ts';
import { AppointmentService } from '../services/appointmentService.ts';
import { HTTP_STATUS } from '../../_shared/constants.ts';
import type { Employee } from '../../_shared/auth.ts';

export async function create(req: Request, employee: Employee) {
  // Check permissions - Level 1 (non-technician_l1) and above can create appointments
  await requireMinLevel(employee, 1);

  // Parse request body
  const body = await parseRequestBody<Record<string, unknown>>(req);

  // Validate required fields
  validateRequired(body.appointment_type, 'ประเภทการนัดหมาย');
  
  // Validate ticket_id if provided
  if (body.ticket_id) {
    validateUUID(body.ticket_id as string, 'Ticket ID');
  }

  // Create appointment
  const appointment = await AppointmentService.create(body);

  return success(appointment, HTTP_STATUS.CREATED);
}

