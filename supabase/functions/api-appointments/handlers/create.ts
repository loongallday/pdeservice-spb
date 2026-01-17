/**
 * @fileoverview Create new appointment handler
 * @endpoint POST /api-appointments
 * @auth Required - Level 1+ (Assigner, PM, Sales, Admin, Superadmin)
 *
 * @bodyParam {AppointmentType} appointment_type - Required: Type of scheduling
 * @bodyParam {string} [appointment_date] - Date in YYYY-MM-DD format
 * @bodyParam {string} [appointment_time_start] - Start time in HH:MM format
 * @bodyParam {string} [appointment_time_end] - End time in HH:MM format
 * @bodyParam {string} [ticket_id] - UUID of ticket to link appointment to
 *
 * @returns {AppointmentResponse} The created appointment (HTTP 201)
 * @throws {AuthenticationError} 401 - If not authenticated
 * @throws {ForbiddenError} 403 - If permission level < 1
 * @throws {ValidationError} 400 - If required fields missing or invalid
 *
 * @description
 * Creates a new appointment. If ticket_id is provided, the ticket's
 * appointment_id will be updated to point to this new appointment.
 *
 * Appointment types:
 * - full_day: Available all day
 * - time_range: Specific time window (use with time_start/end)
 * - half_morning: Morning only
 * - half_afternoon: Afternoon only
 * - call_to_schedule: Call customer to arrange
 *
 * @example
 * POST /api-appointments
 * {
 *   "appointment_type": "time_range",
 *   "appointment_date": "2026-01-25",
 *   "appointment_time_start": "09:00",
 *   "appointment_time_end": "12:00",
 *   "ticket_id": "6ff495f4-8d5c-4523-b2c3-e080bf7618cf"
 * }
 */

import { success } from '../../_shared/response.ts';
import { requireMinLevel } from '../../_shared/auth.ts';
import { parseRequestBody, validateRequired, validateUUID } from '../../_shared/validation.ts';
import { AppointmentService } from '../services/appointmentService.ts';
import { HTTP_STATUS } from '../../_shared/constants.ts';
import type { Employee } from '../../_shared/auth.ts';
import type { CreateAppointmentInput } from '../types.ts';

/**
 * Handles POST /api-appointments request
 *
 * @param req - HTTP request object
 * @param employee - Authenticated employee from JWT
 * @returns HTTP response with created appointment (201 Created)
 */
export async function create(req: Request, employee: Employee) {
  // Check permissions - Level 1 (non-technician_l1) and above can create appointments
  await requireMinLevel(employee, 1);

  // Parse request body
  const body = await parseRequestBody<CreateAppointmentInput>(req);

  // Validate required fields
  validateRequired(body.appointment_type, 'ประเภทการนัดหมาย');

  // Validate ticket_id if provided
  if (body.ticket_id) {
    validateUUID(body.ticket_id, 'Ticket ID');
  }

  // Create appointment
  const appointment = await AppointmentService.create(body);

  return success(appointment, HTTP_STATUS.CREATED);
}
