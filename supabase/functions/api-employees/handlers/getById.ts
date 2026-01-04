/**
 * Get single employee handler
 */

import { success } from '../../_shared/response.ts';
import { requireMinLevel } from '../../_shared/auth.ts';
import { validateUUID } from '../../_shared/validation.ts';
import { EmployeeService } from '../services/employeeService.ts';
import type { Employee } from '../../_shared/auth.ts';

export async function getById(req: Request, employee: Employee, id: string) {
  // Check permissions - Level 0 and above can view employees
  await requireMinLevel(employee, 0);

  // Validate ID
  validateUUID(id, 'Employee ID');

  // Get employee from service
  const employeeData = await EmployeeService.getById(id);

  return success(employeeData);
}

