/**
 * Get employee counts by role handler
 */

import { success } from '../_shared/response.ts';
import { requireMinLevel } from '../_shared/auth.ts';
import { EmployeeService } from '../services/employeeService.ts';
import type { Employee } from '../_shared/auth.ts';

export async function getRoleCounts(req: Request, employee: Employee) {
  // Check permissions - Level 0 and above can view role counts
  await requireMinLevel(employee, 0);

  // Get employee counts by role from service
  const counts = await EmployeeService.getEmployeeCountsByRole();

  return success(counts);
}

