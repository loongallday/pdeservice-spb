/**
 * Get single department handler
 */

import { success } from '../../_shared/response.ts';
import { requireMinLevel } from '../../_shared/auth.ts';
import { validateUUID } from '../../_shared/validation.ts';
import { DepartmentService } from '../services/departmentService.ts';
import type { Employee } from '../../_shared/auth.ts';

export async function get(req: Request, employee: Employee, id: string) {
  // Check permissions - Level 0 (all authenticated users) and above can view departments
  await requireMinLevel(employee, 0);

  // Validate ID
  validateUUID(id, 'Department ID');

  // Fetch department
  const department = await DepartmentService.getById(id);

  return success(department);
}

