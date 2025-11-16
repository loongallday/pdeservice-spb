/**
 * Create role handler
 */

import { success } from '../../_shared/response.ts';
import { isSuperAdmin } from '../../_shared/auth.ts';
import { parseRequestBody, validateRequired } from '../../_shared/validation.ts';
import { AuthorizationError } from '../../_shared/error.ts';
import { RoleService } from '../services/roleService.ts';
import { HTTP_STATUS } from '../../_shared/constants.ts';
import type { Employee } from '../../_shared/auth.ts';

export async function create(req: Request, employee: Employee) {
  // Check permissions - Only superadmin can create roles
  if (!isSuperAdmin(employee)) {
    throw new AuthorizationError('เฉพาะ Superadmin เท่านั้น');
  }

  // Parse request body
  const body = await parseRequestBody<Record<string, unknown>>(req);

  // Validate required fields
  validateRequired(body.code, 'รหัสบทบาท');
  validateRequired(body.name_th, 'ชื่อบทบาท');

  // Extract only the fields that PostgREST currently recognizes
  // Temporarily exclude is_active and requires_auth until PostgREST schema cache refreshes
  // Database defaults (true for is_active, false for requires_auth) will be applied
  const roleData: Record<string, unknown> = {
    code: body.code,
    name_th: body.name_th,
    name_en: body.name_en ?? null,
    description: body.description ?? null,
    level: body.level ?? null,
    department_id: body.department_id ?? null,
    // Note: is_active and requires_auth excluded temporarily until PostgREST cache refreshes
    // They will use database defaults (is_active=true, requires_auth=false)
  };

  // Create role
  const role = await RoleService.create(roleData);

  return success(role, HTTP_STATUS.CREATED);
}

