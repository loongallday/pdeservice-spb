/**
 * @fileoverview Create and link new auth account to employee handler
 * @endpoint POST /api-employees/:id/link-auth
 * @auth Required - Level 2+ (Admin, Superadmin)
 *
 * @param {string} id - Employee UUID from URL path
 *
 * @bodyParam {string} email - Required: Email for the new auth account
 * @bodyParam {string} password - Required: Password for the new auth account
 *
 * @returns {EmployeeWithRole} Updated employee with role/department data
 * @throws {AuthenticationError} 401 - If not authenticated
 * @throws {ForbiddenError} 403 - If permission level < 2
 * @throws {ValidationError} 400 - If ID is invalid, email/password missing, or email invalid
 * @throws {DatabaseError} 500 - If auth user creation fails (e.g., email already exists)
 *
 * @description
 * Creates a new Supabase auth user and links it to the employee.
 * This enables the employee to log into the system.
 * The auth user is created with email_confirm=true (pre-verified).
 *
 * After linking:
 * - Employee's auth_user_id is set to the new auth user's ID
 * - Employee's email is updated to match the auth account
 *
 * @example
 * POST /api-employees/123e4567-e89b-12d3-a456-426614174000/link-auth
 * { "email": "john@example.com", "password": "SecurePass123" }
 */

import { success } from '../../_shared/response.ts';
import { requireMinLevel } from '../../_shared/auth.ts';
import { parseRequestBody, validateUUID, validateRequired, validateEmail } from '../../_shared/validation.ts';
import { EmployeeService } from '../services/employeeService.ts';
import type { Employee } from '../../_shared/auth.ts';

export async function linkAuth(req: Request, employee: Employee, id: string) {
  // Check permissions - Level 2 (admin) and above can link auth accounts
  await requireMinLevel(employee, 2);

  // Validate ID
  validateUUID(id, 'Employee ID');

  // Parse request body
  const body = await parseRequestBody<{
    email: string;
    password: string;
  }>(req);

  // Validate required fields
  validateRequired(body.email, 'อีเมล');
  validateRequired(body.password, 'รหัสผ่าน');
  validateEmail(body.email);

  // Link auth account
  const updatedEmployee = await EmployeeService.linkAuth(id, body.email, body.password);

  return success(updatedEmployee);
}

