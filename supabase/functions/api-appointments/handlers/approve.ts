/**
 * @fileoverview Approve/unapprove appointment handler
 * @endpoint POST /api-appointments/approve
 * @auth Required - Appointment approver role only
 *
 * @bodyParam {string} id - Required: UUID of appointment to approve
 * @bodyParam {boolean} [is_approved=true] - Set approval status
 * @bodyParam {string} [appointment_date] - Optionally update date while approving
 * @bodyParam {string} [appointment_time_start] - Optionally update start time
 * @bodyParam {string} [appointment_time_end] - Optionally update end time
 * @bodyParam {AppointmentType} [appointment_type] - Optionally update type
 *
 * @returns {AppointmentResponse} The approved/updated appointment
 * @throws {AuthenticationError} 401 - If not authenticated
 * @throws {ForbiddenError} 403 - If user cannot approve appointments
 * @throws {ValidationError} 400 - If id is missing or not a valid UUID
 * @throws {NotFoundError} 404 - If appointment doesn't exist
 *
 * @description
 * Approves or unapproves an appointment. Only users with appointment approver
 * permissions can use this endpoint.
 *
 * Approvers can also update appointment details (date, time, type) while
 * approving in a single request.
 *
 * When an appointment is approved:
 * - An audit log entry is created on the linked ticket
 * - Notifications are sent to confirmed technicians
 *
 * When an appointment is unapproved (is_approved=false):
 * - Same audit and notification behavior
 * - Can be used when a previously approved appointment needs changes
 *
 * @example
 * // Approve an appointment
 * POST /api-appointments/approve
 * { "id": "4b0080c0-fe38-4aa5-8db7-86565d7cdb7e" }
 *
 * @example
 * // Approve and update date
 * POST /api-appointments/approve
 * {
 *   "id": "4b0080c0-fe38-4aa5-8db7-86565d7cdb7e",
 *   "appointment_date": "2026-01-28",
 *   "appointment_time_start": "10:00"
 * }
 *
 * @example
 * // Unapprove an appointment
 * POST /api-appointments/approve
 * { "id": "4b0080c0-fe38-4aa5-8db7-86565d7cdb7e", "is_approved": false }
 */

import { success } from '../../_shared/response.ts';
import { requireCanApproveAppointments } from '../../_shared/auth.ts';
import { parseRequestBody, validateUUID, validateRequired } from '../../_shared/validation.ts';
import { AppointmentService } from '../services/appointmentService.ts';
import type { Employee } from '../../_shared/auth.ts';
import type { ApproveAppointmentInput } from '../types.ts';

/**
 * Handles POST /api-appointments/approve request
 *
 * @param req - HTTP request object
 * @param employee - Authenticated employee from JWT
 * @returns HTTP response with approved/updated appointment
 */
export async function approve(req: Request, employee: Employee) {
  // Check permissions - Only roles that can approve appointments
  await requireCanApproveAppointments(employee);

  // Parse request body
  const body = await parseRequestBody<ApproveAppointmentInput>(req);

  // Validate required fields
  validateRequired(body.id, 'ID การนัดหมาย');
  validateUUID(body.id, 'Appointment ID');

  // Build update data from request
  const appointmentId = body.id;
  const updateData: Partial<ApproveAppointmentInput> = {};

  // Handle is_approved - defaults to true for backward compatibility
  if (body.is_approved !== undefined) {
    updateData.is_approved = body.is_approved === true || body.is_approved === ('true' as unknown);
  } else {
    updateData.is_approved = true;
  }

  // Add optional field updates
  if (body.appointment_date) {
    updateData.appointment_date = body.appointment_date;
  }
  if (body.appointment_time_start) {
    updateData.appointment_time_start = body.appointment_time_start;
  }
  if (body.appointment_time_end) {
    updateData.appointment_time_end = body.appointment_time_end;
  }
  if (body.appointment_type) {
    updateData.appointment_type = body.appointment_type;
  }

  // Approve/unapprove and update appointment
  const appointment = await AppointmentService.approve(appointmentId, updateData, employee.id);

  return success(appointment);
}
