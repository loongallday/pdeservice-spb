/**
 * @fileoverview Delete appointment handler
 * @endpoint DELETE /api-appointments/:id
 * @auth Required - Level 1+ (Assigner, PM, Sales, Admin, Superadmin)
 *
 * @pathParam {string} id - UUID of the appointment to delete
 *
 * @returns {Object} Success message { message: "ลบการนัดหมายสำเร็จ" }
 * @throws {AuthenticationError} 401 - If not authenticated
 * @throws {ForbiddenError} 403 - If permission level < 1
 * @throws {ValidationError} 400 - If ID is not a valid UUID
 * @throws {DatabaseError} 500 - If deletion fails
 *
 * @description
 * Permanently deletes an appointment. If the appointment was linked to a
 * ticket, the ticket's appointment_id will be cleared (set to null).
 *
 * This is a hard delete - the appointment cannot be recovered.
 *
 * @example
 * DELETE /api-appointments/4b0080c0-fe38-4aa5-8db7-86565d7cdb7e
 */

import { success } from '../../_shared/response.ts';
import { requireMinLevel } from '../../_shared/auth.ts';
import { validateUUID } from '../../_shared/validation.ts';
import { AppointmentService } from '../services/appointmentService.ts';
import type { Employee } from '../../_shared/auth.ts';

/**
 * Handles DELETE /api-appointments/:id request
 *
 * @param req - HTTP request object
 * @param employee - Authenticated employee from JWT
 * @param id - Appointment UUID from path
 * @returns HTTP response with success message
 */
export async function deleteAppointment(req: Request, employee: Employee, id: string) {
  // Check permissions - Level 1 (non-technician_l1) and above can delete appointments
  await requireMinLevel(employee, 1);

  // Validate ID format
  validateUUID(id, 'Appointment ID');

  // Delete appointment (also clears ticket's appointment_id if linked)
  await AppointmentService.delete(id);

  return success({ message: 'ลบการนัดหมายสำเร็จ' });
}
