/**
 * Approve/un-approve appointment handler
 * Allows approvers to approve (is_approved=true) or un-approve (is_approved=false) appointments
 * Also allows editing appointment details (date, time, type) while approving/un-approving
 */

import { success } from '../../_shared/response.ts';
import { requireCanApproveAppointments } from '../../_shared/auth.ts';
import { parseRequestBody, validateUUID, validateRequired } from '../../_shared/validation.ts';
import { AppointmentService } from '../services/appointmentService.ts';
import type { Employee } from '../../_shared/auth.ts';

export async function approve(req: Request, employee: Employee) {
  // Check permissions - Only roles that can approve appointments
  await requireCanApproveAppointments(employee);

  // Parse request body
  const body = await parseRequestBody<Record<string, unknown>>(req);

  // Validate required fields
  validateRequired(body.id, 'ID การนัดหมาย');
  validateUUID(body.id as string, 'Appointment ID');

  // Extract appointment data (id is required, others are optional for editing)
  const appointmentId = body.id as string;
  const updateData: Record<string, unknown> = {};

  // Set is_approved - allow both approve (true) and un-approve (false)
  // Defaults to true if not provided (for backward compatibility)
  if (body.is_approved !== undefined) {
    updateData.is_approved = body.is_approved === true || body.is_approved === 'true';
  } else {
    updateData.is_approved = true; // Default to approve if not specified
  }

  // Add optional fields if provided
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

  // Approve/un-approve and update appointment
  const appointment = await AppointmentService.approve(appointmentId, updateData);

  return success(appointment);
}

