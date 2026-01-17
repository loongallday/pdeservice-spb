/**
 * @fileoverview Get single appointment by ID handler
 * @endpoint GET /api-appointments/:id
 * @auth Required - Level 0+ (all authenticated users)
 *
 * @pathParam {string} id - UUID of the appointment to retrieve
 *
 * @returns {AppointmentResponse} The requested appointment
 * @throws {AuthenticationError} 401 - If not authenticated
 * @throws {ValidationError} 400 - If ID is not a valid UUID
 * @throws {NotFoundError} 404 - If appointment doesn't exist
 *
 * @example
 * GET /api-appointments/4b0080c0-fe38-4aa5-8db7-86565d7cdb7e
 */

import { success } from '../../_shared/response.ts';
import { requireMinLevel } from '../../_shared/auth.ts';
import { validateUUID } from '../../_shared/validation.ts';
import { AppointmentService } from '../services/appointmentService.ts';
import type { Employee } from '../../_shared/auth.ts';

/**
 * Handles GET /api-appointments/:id request
 *
 * @param req - HTTP request object
 * @param employee - Authenticated employee from JWT
 * @param id - Appointment UUID from path
 * @returns HTTP response with appointment data
 */
export async function get(req: Request, employee: Employee, id: string) {
  // Check permissions - Level 0 (all authenticated users) and above can view appointments
  await requireMinLevel(employee, 0);

  // Validate ID format
  validateUUID(id, 'Appointment ID');

  // Fetch appointment
  const appointment = await AppointmentService.getById(id);

  return success(appointment);
}
