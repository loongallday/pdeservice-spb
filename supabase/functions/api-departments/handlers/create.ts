/**
 * Create department handler
 */

import { success } from '../../_shared/response.ts';
import { isSuperAdmin } from '../../_shared/auth.ts';
import { parseRequestBody, validateRequired } from '../../_shared/validation.ts';
import { AuthorizationError } from '../../_shared/error.ts';
import { DepartmentService } from '../services/departmentService.ts';
import { HTTP_STATUS } from '../../_shared/constants.ts';
import type { Employee } from '../../_shared/auth.ts';

export async function create(req: Request, employee: Employee) {
  // Check permissions - Only superadmin can create departments
  if (!isSuperAdmin(employee)) {
    throw new AuthorizationError('เฉพาะ Superadmin เท่านั้น');
  }

  // Parse request body
  const body = await parseRequestBody<Record<string, unknown>>(req);

  // Validate required fields
  validateRequired(body.code, 'รหัสแผนก');
  validateRequired(body.name, 'ชื่อแผนก');

  // Create department
  const department = await DepartmentService.create(body);

  return success(department, HTTP_STATUS.CREATED);
}

