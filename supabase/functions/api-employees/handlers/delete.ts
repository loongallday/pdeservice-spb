/**
 * @fileoverview Delete (soft delete) employee handler
 * @endpoint DELETE /api-employees/:id
 * @auth Required - Level 2+ (Admin, Superadmin)
 *
 * @param {string} id - Employee UUID from URL path
 *
 * @returns {Object} Success message: { message: "ลบพนักงานสำเร็จ" }
 * @throws {AuthenticationError} 401 - If not authenticated
 * @throws {ForbiddenError} 403 - If permission level < 2
 * @throws {ValidationError} 400 - If ID is not a valid UUID
 *
 * @description
 * Performs a soft delete on an employee by setting is_active=false.
 * The employee record is preserved but will not appear in active listings.
 * This operation does NOT:
 * - Delete the associated auth account (use unlink-auth first if needed)
 * - Remove any historical data or relationships
 *
 * @example
 * DELETE /api-employees/123e4567-e89b-12d3-a456-426614174000
 */

import { success } from '../../_shared/response.ts';
import { requireMinLevel } from '../../_shared/auth.ts';
import { validateUUID } from '../../_shared/validation.ts';
import { EmployeeService } from '../services/employeeService.ts';
import { HTTP_STATUS } from '../../_shared/constants.ts';
import type { Employee } from '../../_shared/auth.ts';

export async function deleteEmployee(req: Request, employee: Employee, id: string) {
  // Check permissions - Level 2 (admin) and above can delete employees
  await requireMinLevel(employee, 2);

  // Validate ID
  validateUUID(id, 'Employee ID');

  // Delete employee (soft delete)
  await EmployeeService.delete(id);

  return success({ message: 'ลบพนักงานสำเร็จ' }, HTTP_STATUS.OK);
}

