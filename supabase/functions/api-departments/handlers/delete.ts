/**
 * Delete department handler
 */

import { success } from '../../_shared/response.ts';
import { isSuperAdmin } from '../../_shared/auth.ts';
import { validateUUID } from '../../_shared/validation.ts';
import { AuthorizationError } from '../../_shared/error.ts';
import { DepartmentService } from '../services/departmentService.ts';
import type { Employee } from '../../_shared/auth.ts';

export async function deleteDepartment(_: Request, employee: Employee, id: string) {
  // Check permissions - Only superadmin can delete departments
  if (!isSuperAdmin(employee)) {
    throw new AuthorizationError('เฉพาะ Superadmin เท่านั้น');
  }

  // Validate ID
  validateUUID(id, 'Department ID');

  // Delete department
  await DepartmentService.delete(id);

  return success({ message: 'ลบแผนกสำเร็จ' });
}

