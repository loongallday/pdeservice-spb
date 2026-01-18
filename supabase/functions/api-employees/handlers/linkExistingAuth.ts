/**
 * @fileoverview Link existing auth account to employee handler
 * @endpoint POST /api-employees/:id/link-existing-auth
 * @auth Required - Level 2+ (Admin, Superadmin)
 *
 * @param {string} id - Employee UUID from URL path
 *
 * @bodyParam {string} auth_user_id - Required: Existing Supabase auth user UUID
 * @bodyParam {string} email - Required: Email to set on the employee record
 *
 * @returns {EmployeeWithRole} Updated employee with role/department data
 * @throws {AuthenticationError} 401 - If not authenticated
 * @throws {ForbiddenError} 403 - If permission level < 2
 * @throws {ValidationError} 400 - If ID is invalid, auth_user_id/email missing, or email invalid
 * @throws {DatabaseError} 500 - If auth user doesn't exist or already linked to another employee
 *
 * @description
 * Links an existing Supabase auth user to an employee. Use this when:
 * - An auth account was created outside the system
 * - Migrating users from another system
 * - Re-linking a previously unlinked account
 *
 * Validation performed:
 * - Auth user must exist
 * - Auth user must not be linked to another employee
 *
 * @example
 * POST /api-employees/123e4567-e89b-12d3-a456-426614174000/link-existing-auth
 * {
 *   "auth_user_id": "auth-user-uuid",
 *   "email": "john@example.com"
 * }
 */

import { success } from '../../_shared/response.ts';
import { requireMinLevel } from '../../_shared/auth.ts';
import { parseRequestBody, validateUUID, validateRequired, validateEmail } from '../../_shared/validation.ts';
import { EmployeeService } from '../services/employeeService.ts';
import type { Employee } from '../../_shared/auth.ts';

export async function linkExistingAuth(req: Request, employee: Employee, id: string) {
  // Check permissions - Level 2 (admin) and above can link auth accounts
  await requireMinLevel(employee, 2);

  // Validate ID
  validateUUID(id, 'Employee ID');

  // Parse request body
  const body = await parseRequestBody<{
    auth_user_id: string;
    email: string;
  }>(req);

  // Validate required fields
  validateRequired(body.auth_user_id, 'Auth User ID');
  validateRequired(body.email, 'อีเมล');
  validateEmail(body.email);

  // Link existing auth account
  const updatedEmployee = await EmployeeService.linkExistingAuth(id, body.auth_user_id, body.email);

  return success(updatedEmployee);
}

