/**
 * Get appointment by ticket ID handler
 */

import { success } from '../../_shared/response.ts';
import { requireMinLevel } from '../../_shared/auth.ts';
import { validateUUID } from '../../_shared/validation.ts';
import { AppointmentService } from '../services/appointmentService.ts';
import type { Employee } from '../../_shared/auth.ts';

export async function getByTicket(req: Request, employee: Employee, ticketId: string) {
  // Check permissions - Level 0 (all authenticated users) and above can view appointments
  await requireMinLevel(employee, 0);

  // Validate ticket ID
  validateUUID(ticketId, 'Ticket ID');

  // Fetch appointment
  const appointment = await AppointmentService.getByTicketId(ticketId);

  return success(appointment);
}

