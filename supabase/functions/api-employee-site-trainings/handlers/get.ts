/**
 * Get employee-site training by ID handler
 */

import { success } from '../_shared/response.ts';
import { requireMinLevel } from '../_shared/auth.ts';
import { EmployeeSiteTrainingService } from '../services/employeeSiteTrainingService.ts';
import type { Employee } from '../_shared/auth.ts';

export async function get(req: Request, employee: Employee, id: string) {
  // Level 0+: all authenticated users can view
  await requireMinLevel(employee, 0);

  const result = await EmployeeSiteTrainingService.getById(id);

  return success(result);
}

