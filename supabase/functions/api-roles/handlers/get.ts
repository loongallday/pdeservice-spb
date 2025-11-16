/**
 * Get single role handler
 */

import { success } from '../../_shared/response.ts';
import { requireMinLevel } from '../../_shared/auth.ts';
import { validateUUID } from '../../_shared/validation.ts';
import { RoleService } from '../services/roleService.ts';
import type { Employee } from '../../_shared/auth.ts';

export async function get(req: Request, employee: Employee, id: string) {
  // Check permissions - Level 0 (all authenticated users) and above can view roles
  await requireMinLevel(employee, 0);

  // Validate ID
  validateUUID(id, 'Role ID');

  // Fetch role
  const role = await RoleService.getById(id);

  return success(role);
}

