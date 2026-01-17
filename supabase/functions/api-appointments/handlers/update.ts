/**
 * @fileoverview Update appointment handler
 * @endpoint PUT /api-appointments/:id
 * @auth Required - Level 1+ (Assigner, PM, Sales, Admin, Superadmin)
 *
 * @pathParam {string} id - UUID of the appointment to update
 *
 * @bodyParam {string} [appointment_date] - Date in YYYY-MM-DD format
 * @bodyParam {string} [appointment_time_start] - Start time in HH:MM format
 * @bodyParam {string} [appointment_time_end] - End time in HH:MM format
 * @bodyParam {AppointmentType} [appointment_type] - Type of scheduling
 *
 * @returns {AppointmentResponse} The updated appointment
 * @throws {AuthenticationError} 401 - If not authenticated
 * @throws {ForbiddenError} 403 - If permission level < 1
 * @throws {ValidationError} 400 - If ID is not a valid UUID
 * @throws {NotFoundError} 404 - If appointment doesn't exist
 *
 * @description
 * Updates an existing appointment. If the user is NOT an approver and makes
 * changes, is_approved will automatically be set to false, requiring
 * re-approval. This also removes any confirmed technicians from the ticket.
 *
 * Approvers can edit without losing approval status.
 *
 * @example
 * PUT /api-appointments/4b0080c0-fe38-4aa5-8db7-86565d7cdb7e
 * {
 *   "appointment_date": "2026-01-26",
 *   "appointment_time_start": "14:00",
 *   "appointment_time_end": "17:00"
 * }
 */

import { success } from '../../_shared/response.ts';
import { requireMinLevel, canApproveAppointments } from '../../_shared/auth.ts';
import { parseRequestBody, validateUUID } from '../../_shared/validation.ts';
import { AppointmentService } from '../services/appointmentService.ts';
import type { Employee } from '../../_shared/auth.ts';
import type { UpdateAppointmentInput } from '../types.ts';

/**
 * Handles PUT /api-appointments/:id request
 *
 * @param req - HTTP request object
 * @param employee - Authenticated employee from JWT
 * @param id - Appointment UUID from path
 * @returns HTTP response with updated appointment
 */
export async function update(req: Request, employee: Employee, id: string) {
  // Check permissions - Level 1 (non-technician_l1) and above can update appointments
  await requireMinLevel(employee, 1);

  // Validate ID format
  validateUUID(id, 'Appointment ID');

  // Parse request body
  const body = await parseRequestBody<UpdateAppointmentInput & { is_approved?: boolean }>(req);

  // Validate ticket_id if provided
  if (body.ticket_id) {
    validateUUID(body.ticket_id, 'Ticket ID');
  }

  // Check if employee can approve appointments
  const canApprove = await canApproveAppointments(employee);

  // If non-approver edits appointment, set is_approved to false
  // This triggers removal of confirmed technicians in the service
  if (!canApprove) {
    body.is_approved = false;
  }

  // Update appointment
  const appointment = await AppointmentService.update(id, body);

  return success(appointment);
}
