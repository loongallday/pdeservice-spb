/**
 * Unlink auth account from employee handler
 */

import { success } from '../_shared/response.ts';
import { requireMinLevel } from '../_shared/auth.ts';
import { validateUUID } from '../_shared/validation.ts';
import { EmployeeService } from '../services/employeeService.ts';
import type { Employee } from '../_shared/auth.ts';

export async function unlinkAuth(req: Request, employee: Employee, id: string) {
  // Check permissions - Level 2 (admin) and above can unlink auth accounts
  await requireMinLevel(employee, 2);

  // Validate ID
  validateUUID(id, 'Employee ID');

  // Unlink auth account
  const updatedEmployee = await EmployeeService.unlinkAuth(id);

  return success(updatedEmployee);
}

