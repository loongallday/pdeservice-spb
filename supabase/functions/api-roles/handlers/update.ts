/**
 * Update role handler
 */

import { success } from '../../_shared/response.ts';
import { isSuperAdmin } from '../../_shared/auth.ts';
import { parseRequestBody, validateUUID } from '../../_shared/validation.ts';
import { AuthorizationError, ValidationError } from '../../_shared/error.ts';
import { RoleService } from '../services/roleService.ts';
import type { Employee } from '../../_shared/auth.ts';

export async function update(req: Request, employee: Employee, id: string) {
  // Check permissions - Only superadmin can update roles
  if (!isSuperAdmin(employee)) {
    throw new AuthorizationError('เฉพาะ Superadmin เท่านั้น');
  }

  // Validate ID
  validateUUID(id, 'Role ID');

  // Parse request body
  const body = await parseRequestBody<Record<string, unknown>>(req);

  // Extract fields to update
  // Temporarily exclude is_active and requires_auth until PostgREST schema cache refreshes
  // These fields will keep their current values in the database
  const updateData: Record<string, unknown> = {};
  
  if (body.code !== undefined) updateData.code = body.code;
  if (body.name_th !== undefined) updateData.name_th = body.name_th;
  if (body.name_en !== undefined) updateData.name_en = body.name_en;
  if (body.description !== undefined) updateData.description = body.description;
  if (body.level !== undefined) updateData.level = body.level;
  if (body.department_id !== undefined) updateData.department_id = body.department_id;
  
  // Note: is_active and requires_auth excluded temporarily until PostgREST cache refreshes
  // They will maintain their current database values during updates

  // Ensure we have at least one field to update
  if (Object.keys(updateData).length === 0) {
    throw new ValidationError('ไม่มีข้อมูลที่จะอัปเดต');
  }

  // Update role
  const role = await RoleService.update(id, updateData);

  return success(role);
}

