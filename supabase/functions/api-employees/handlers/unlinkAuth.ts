/**
 * @fileoverview Unlink auth account from employee handler
 * @endpoint POST /api-employees/:id/unlink-auth
 * @auth Required - Level 2+ (Admin, Superadmin)
 *
 * @param {string} id - Employee UUID from URL path
 *
 * @returns {EmployeeWithRole} Updated employee with role/department data
 * @throws {AuthenticationError} 401 - If not authenticated
 * @throws {ForbiddenError} 403 - If permission level < 2
 * @throws {ValidationError} 400 - If ID is not a valid UUID
 *
 * @description
 * Removes the link between an employee and their auth account.
 * After unlinking:
 * - Employee's auth_user_id is set to null
 * - The auth account still exists but the employee cannot log in
 * - The auth account can be linked to a different employee
 *
 * Note: This does NOT delete the Supabase auth user, only removes
 * the association with the employee record.
 *
 * @example
 * POST /api-employees/123e4567-e89b-12d3-a456-426614174000/unlink-auth
 */

import { success } from '../../_shared/response.ts';
import { requireMinLevel } from '../../_shared/auth.ts';
import { validateUUID } from '../../_shared/validation.ts';
import { EmployeeService } from '../services/employeeService.ts';
import type { Employee } from '../../_shared/auth.ts';

export async function unlinkAuth(req: Request, employee: Employee, id: string) {
  // Check permissions - Level 2 (admin) and above can unlink auth accounts
  await requireMinLevel(employee, 2);

  // Validate ID
  validateUUID(id, 'Employee ID');

  // Unlink auth account
  const updatedEmployee = await EmployeeService.unlinkAuth(id);

  return success(updatedEmployee);
}

