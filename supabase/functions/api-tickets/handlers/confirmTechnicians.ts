/**
 * @fileoverview Confirm technicians for ticket appointment handler
 * @endpoint POST /api-tickets/:id/confirm-technicians
 * @auth Required - Appointment approvers only
 *
 * @param {string} id - Ticket UUID (path parameter)
 *
 * @bodyParam {Array<string|{id: string, is_key?: boolean}>} employee_ids - Required: Technicians to confirm
 * @bodyParam {string} [notes] - Optional notes for the confirmation
 *
 * @returns {ConfirmationResult} Confirmation record (HTTP 201)
 * @throws {ValidationError} 400 - Invalid UUID or empty employee list
 * @throws {AuthenticationError} 401 - If not authenticated
 * @throws {ForbiddenError} 403 - User cannot approve appointments
 *
 * @description
 * Confirms which technicians will actually work on a ticket's appointment.
 * This is separate from initial assignment and represents the final
 * approved technician list for scheduling.
 *
 * Employee IDs Format:
 * - Simple string array: ["uuid1", "uuid2"]
 * - Object array with key technician flag: [{id: "uuid1", is_key: true}, {id: "uuid2"}]
 *
 * The is_key flag indicates the primary/lead technician for the job.
 */

import { success } from '../../_shared/response.ts';
import { requireCanApproveAppointments } from '../../_shared/auth.ts';
import { parseRequestBody, validateUUID, validateRequired } from '../../_shared/validation.ts';
import { ValidationError } from '../../_shared/error.ts';
import { TechnicianConfirmationService } from '../services/technicianConfirmationService.ts';
import type { Employee } from '../../_shared/auth.ts';

export async function confirmTechnicians(req: Request, employee: Employee, ticketId: string) {
  // Check permissions - Only approvers can confirm technicians
  await requireCanApproveAppointments(employee);

  // Validate ticket ID
  validateUUID(ticketId, 'Ticket ID');

  // Parse request body
  const body = await parseRequestBody<Record<string, unknown>>(req);

  // Validate required fields
  validateRequired(body.employee_ids, 'รายชื่อช่าง');
  
  if (!Array.isArray(body.employee_ids)) {
    throw new ValidationError('employee_ids ต้องเป็น array');
  }

  if (body.employee_ids.length === 0) {
    throw new ValidationError('กรุณาระบุช่างอย่างน้อย 1 คน');
  }

  // Validate each employee ID
  const employeeIds = body.employee_ids as Array<{ id: string; is_key?: boolean } | string>;
  const normalizedEmployees = employeeIds.map((emp, index) => {
    if (typeof emp === 'string') {
      validateUUID(emp, `Employee ID #${index + 1}`);
      return { id: emp, is_key: false };
    } else {
      validateUUID(emp.id, `Employee ID #${index + 1}`);
      return { id: emp.id, is_key: emp.is_key || false };
    }
  });

  // Get optional notes
  const notes = typeof body.notes === 'string' ? body.notes : undefined;

  // Confirm technicians
  const result = await TechnicianConfirmationService.confirmTechnicians(
    ticketId,
    normalizedEmployees,
    employee.id,
    notes
  );

  return success(result, 201);
}

