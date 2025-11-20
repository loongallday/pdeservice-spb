/**
 * Update department handler
 */

import { success } from '../../_shared/response.ts';
import { requireMinLevel } from '../../_shared/auth.ts';
import { parseRequestBody, validateUUID } from '../../_shared/validation.ts';
import { DepartmentService } from '../services/departmentService.ts';
import type { Employee } from '../../_shared/auth.ts';

export async function update(req: Request, employee: Employee, id: string) {
  // Check permissions - Level 2 and above can update departments
  await requireMinLevel(employee, 2);

  // Validate ID
  validateUUID(id, 'Department ID');

  // Parse request body
  const body = await parseRequestBody<Record<string, unknown>>(req);

  // Update department
  const department = await DepartmentService.update(id, body);

  return success(department);
}

