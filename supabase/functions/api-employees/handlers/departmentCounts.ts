/**
 * Get employee counts by department handler
 */

import { success } from '../_shared/response.ts';
import { requireMinLevel } from '../_shared/auth.ts';
import { EmployeeService } from '../services/employeeService.ts';
import type { Employee } from '../_shared/auth.ts';

export async function getDepartmentCounts(req: Request, employee: Employee) {
  // Check permissions - Level 0 and above can view department counts
  await requireMinLevel(employee, 0);

  // Get employee counts by department from service
  const counts = await EmployeeService.getEmployeeCountsByDepartment();

  return success(counts);
}

