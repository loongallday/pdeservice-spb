/**
 * List roles handler
 */

import { success } from '../../_shared/response.ts';
import { requireMinLevel } from '../../_shared/auth.ts';
import { RoleService } from '../services/roleService.ts';
import type { Employee } from '../../_shared/auth.ts';

export async function list(req: Request, employee: Employee) {
  // Check permissions - Level 0 (all authenticated users) and above can view roles
  await requireMinLevel(employee, 0);

  // Fetch roles
  const roles = await RoleService.getAll();

  return success(roles);
}

