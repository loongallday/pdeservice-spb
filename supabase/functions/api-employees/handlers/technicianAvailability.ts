/**
 * Get technician workload handler
 * Returns technicians with their workload status for a given date
 */

import { success } from '../../_shared/response.ts';
import { requireMinLevel } from '../../_shared/auth.ts';
import { ValidationError } from '../../_shared/error.ts';
import { EmployeeService } from '../services/employeeService.ts';
import type { Employee } from '../../_shared/auth.ts';

export async function getTechnicianAvailability(req: Request, employee: Employee) {
  // Check permissions - Level 1 and above can view technician workload
  await requireMinLevel(employee, 1);

  // Parse query parameters
  const url = new URL(req.url);
  const date = url.searchParams.get('date') || undefined;

  // Validate date format if provided
  if (date) {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      throw new ValidationError('รูปแบบวันที่ไม่ถูกต้อง ต้องเป็น YYYY-MM-DD');
    }

    // Validate date is a valid date
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) {
      throw new ValidationError('วันที่ไม่ถูกต้อง');
    }
  }

  // Get technicians with workload (if no date, all return "no_work")
  const technicians = await EmployeeService.getTechniciansWithWorkload(date);

  return success(technicians);
}
