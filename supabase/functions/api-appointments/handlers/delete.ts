/**
 * Delete appointment handler
 */

import { success } from '../../_shared/response.ts';
import { requireMinLevel } from '../../_shared/auth.ts';
import { validateUUID } from '../../_shared/validation.ts';
import { AppointmentService } from '../services/appointmentService.ts';
import type { Employee } from '../../_shared/auth.ts';

export async function deleteAppointment(req: Request, employee: Employee, id: string) {
  // Check permissions - Level 1 (non-technician_l1) and above can delete appointments
  await requireMinLevel(employee, 1);

  // Validate ID
  validateUUID(id, 'Appointment ID');

  // Delete appointment
  await AppointmentService.delete(id);

  return success({ message: 'ลบการนัดหมายสำเร็จ' });
}

