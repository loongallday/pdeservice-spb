/**
 * Get employee summary handler
 * Returns lightweight employee list with minimal fields
 */

import { success } from '../_shared/response.ts';
import { requireMinLevel } from '../_shared/auth.ts';
import { EmployeeService } from '../services/employeeService.ts';
import type { Employee } from '../_shared/auth.ts';

export async function getEmployeeSummary(_req: Request, employee: Employee) {
  // Check permissions - Level 0 and above can view employee summary
  await requireMinLevel(employee, 0);

  // Get employee summary from service
  const summary = await EmployeeService.getEmployeeSummary();

  return success(summary);
}

