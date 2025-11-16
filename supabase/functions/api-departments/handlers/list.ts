/**
 * List departments handler
 */

import { success } from '../../_shared/response.ts';
import { requireMinLevel } from '../../_shared/auth.ts';
import { DepartmentService } from '../services/departmentService.ts';
import type { Employee } from '../../_shared/auth.ts';

export async function list(req: Request, employee: Employee) {
  // Check permissions - Level 0 (all authenticated users) and above can view departments
  await requireMinLevel(employee, 0);

  // Fetch departments
  const departments = await DepartmentService.getAll();

  return success(departments);
}

