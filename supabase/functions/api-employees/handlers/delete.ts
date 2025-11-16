/**
 * Delete employee handler
 */

import { success } from '../_shared/response.ts';
import { requireMinLevel } from '../_shared/auth.ts';
import { validateUUID } from '../_shared/validation.ts';
import { EmployeeService } from '../services/employeeService.ts';
import { HTTP_STATUS } from '../_shared/constants.ts';
import type { Employee } from '../_shared/auth.ts';

export async function deleteEmployee(req: Request, employee: Employee, id: string) {
  // Check permissions - Level 2 (admin) and above can delete employees
  await requireMinLevel(employee, 2);

  // Validate ID
  validateUUID(id, 'Employee ID');

  // Delete employee (soft delete)
  await EmployeeService.delete(id);

  return success({ message: 'ลบพนักงานสำเร็จ' }, HTTP_STATUS.OK);
}

