/**
 * Get employee by code handler
 */

import { success } from '../_shared/response.ts';
import { requireMinLevel } from '../_shared/auth.ts';
import { validateRequired } from '../_shared/validation.ts';
import { EmployeeService } from '../services/employeeService.ts';
import type { Employee } from '../_shared/auth.ts';

export async function getByCode(req: Request, employee: Employee, code: string) {
  // Check permissions - Level 0 and above can lookup by code
  await requireMinLevel(employee, 0);

  // Validate code
  validateRequired(code, 'รหัสพนักงาน');

  // Get employee from service
  const employeeData = await EmployeeService.getByCode(code);

  return success(employeeData);
}

