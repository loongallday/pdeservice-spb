/**
 * @fileoverview Get appointment linked to a ticket handler
 * @endpoint GET /api-appointments/ticket/:ticketId
 * @auth Required - Level 0+ (all authenticated users)
 *
 * @pathParam {string} ticketId - UUID of the ticket to find appointment for
 *
 * @returns {AppointmentResponse} The appointment linked to the ticket, or null if none
 * @throws {AuthenticationError} 401 - If not authenticated
 * @throws {ValidationError} 400 - If ticketId is not a valid UUID
 *
 * @description
 * Retrieves the appointment that is linked to a specific ticket.
 * The relationship is stored via main_tickets.appointment_id.
 * Returns null (with 200 status) if the ticket has no linked appointment.
 *
 * @example
 * GET /api-appointments/ticket/6ff495f4-8d5c-4523-b2c3-e080bf7618cf
 */

import { success } from '../../_shared/response.ts';
import { requireMinLevel } from '../../_shared/auth.ts';
import { validateUUID } from '../../_shared/validation.ts';
import { AppointmentService } from '../services/appointmentService.ts';
import type { Employee } from '../../_shared/auth.ts';

/**
 * Handles GET /api-appointments/ticket/:ticketId request
 *
 * @param req - HTTP request object
 * @param employee - Authenticated employee from JWT
 * @param ticketId - Ticket UUID from path
 * @returns HTTP response with appointment data or null
 */
export async function getByTicket(req: Request, employee: Employee, ticketId: string) {
  // Check permissions - Level 0 (all authenticated users) and above can view appointments
  await requireMinLevel(employee, 0);

  // Validate ticket ID format
  validateUUID(ticketId, 'Ticket ID');

  // Fetch appointment linked to this ticket
  const appointment = await AppointmentService.getByTicketId(ticketId);

  return success(appointment);
}
