/**
 * Delete department handler
 */

import { success } from '../../_shared/response.ts';
import { requireMinLevel } from '../../_shared/auth.ts';
import { validateUUID } from '../../_shared/validation.ts';
import { DepartmentService } from '../services/departmentService.ts';
import type { Employee } from '../../_shared/auth.ts';

export async function deleteDepartment(_: Request, employee: Employee, id: string) {
  // Check permissions - Level 2 and above can delete departments
  await requireMinLevel(employee, 2);

  // Validate ID
  validateUUID(id, 'Department ID');

  // Delete department
  await DepartmentService.delete(id);

  return success({ message: 'ลบแผนกสำเร็จ' });
}

