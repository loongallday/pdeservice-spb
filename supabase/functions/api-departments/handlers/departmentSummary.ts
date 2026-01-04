/**
 * Get department summary handler
 * Returns employee counts grouped by department
 */

import { success } from '../../_shared/response.ts';
import { requireMinLevel } from '../../_shared/auth.ts';
import { DepartmentService } from '../services/departmentService.ts';
import type { Employee } from '../../_shared/auth.ts';

export async function getDepartmentSummary(_req: Request, employee: Employee) {
  // Check permissions - Level 0 and above can view department summary
  await requireMinLevel(employee, 0);

  // Get department summary from service
  const summary = await DepartmentService.getDepartmentSummary();

  return success(summary);
}

