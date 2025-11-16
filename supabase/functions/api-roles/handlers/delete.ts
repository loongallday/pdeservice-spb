/**
 * Delete role handler
 */

import { success } from '../../_shared/response.ts';
import { isSuperAdmin } from '../../_shared/auth.ts';
import { validateUUID } from '../../_shared/validation.ts';
import { AuthorizationError } from '../../_shared/error.ts';
import { RoleService } from '../services/roleService.ts';
import type { Employee } from '../../_shared/auth.ts';

export async function deleteRole(req: Request, employee: Employee, id: string) {
  // Check permissions - Only superadmin can delete roles
  if (!isSuperAdmin(employee)) {
    throw new AuthorizationError('เฉพาะ Superadmin เท่านั้น');
  }

  // Validate ID
  validateUUID(id, 'Role ID');

  // Delete role
  await RoleService.delete(id);

  return success({ message: 'ลบบทบาทสำเร็จ' });
}

