/**
 * Update department handler
 */

import { success } from '../../_shared/response.ts';
import { isSuperAdmin } from '../../_shared/auth.ts';
import { parseRequestBody, validateUUID } from '../../_shared/validation.ts';
import { AuthorizationError } from '../../_shared/error.ts';
import { DepartmentService } from '../services/departmentService.ts';
import type { Employee } from '../../_shared/auth.ts';

export async function update(req: Request, employee: Employee, id: string) {
  // Check permissions - Only superadmin can update departments
  if (!isSuperAdmin(employee)) {
    throw new AuthorizationError('เฉพาะ Superadmin เท่านั้น');
  }

  // Validate ID
  validateUUID(id, 'Department ID');

  // Parse request body
  const body = await parseRequestBody<Record<string, unknown>>(req);

  // Update department
  const department = await DepartmentService.update(id, body);

  return success(department);
}

