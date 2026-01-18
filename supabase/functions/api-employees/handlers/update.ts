/**
 * @fileoverview Update existing employee handler
 * @endpoint PUT /api-employees/:id
 * @auth Required - Variable permissions (see description)
 *
 * @param {string} id - Employee UUID from URL path
 *
 * @bodyParam {string} [name] - Employee full name
 * @bodyParam {string} [code] - Employee code
 * @bodyParam {string} [nickname] - Employee nickname
 * @bodyParam {string} [email] - Email address
 * @bodyParam {string} [role_id] - Role UUID
 * @bodyParam {string} [role] - Role code (legacy)
 * @bodyParam {string} [profile_image_url] - Profile image URL
 * @bodyParam {string} [cover_image_url] - Cover image URL
 * @bodyParam {string} [supervisor_id] - Supervisor employee UUID
 * @bodyParam {boolean} [is_active] - Active status
 *
 * @returns {EmployeeWithRole} The updated employee with role/department data
 * @throws {AuthenticationError} 401 - If not authenticated
 * @throws {ForbiddenError} 403 - If trying to update restricted fields without admin
 * @throws {ValidationError} 400 - If ID is not a valid UUID
 * @throws {NotFoundError} 404 - If employee not found
 *
 * @description
 * Updates an existing employee. Permission rules:
 * - Self-update (own profile): Can update name, nickname, email, profile_image_url
 * - Admin update (Level 2+): Can update all fields including role, status, etc.
 *
 * If a non-admin tries to update restricted fields (like role, is_active),
 * admin permission check is enforced.
 *
 * @example
 * PUT /api-employees/123e4567-e89b-12d3-a456-426614174000
 * { "nickname": "Johnny", "email": "john.new@example.com" }
 */

import { success } from '../../_shared/response.ts';
import { requireMinLevel } from '../../_shared/auth.ts';
import { parseRequestBody, validateUUID } from '../../_shared/validation.ts';
import { EmployeeService } from '../services/employeeService.ts';
import type { Employee } from '../../_shared/auth.ts';

// Fields that employees can update on their own profile
const ALLOWED_SELF_UPDATE_FIELDS = ['name', 'nickname', 'email', 'profile_image_url'];

export async function update(req: Request, employee: Employee, id: string) {
  // Validate ID
  validateUUID(id, 'Employee ID');

  // Parse request body
  const body = await parseRequestBody<Record<string, unknown>>(req);

  // Check if employee is updating themselves
  const isUpdatingSelf = employee.id === id;

  if (isUpdatingSelf) {
    // Employees can update their own profile, but only certain fields
    // Check if they're trying to update restricted fields
    const restrictedFields = Object.keys(body).filter(
      (key) => !ALLOWED_SELF_UPDATE_FIELDS.includes(key)
    );

    if (restrictedFields.length > 0) {
      // If trying to update restricted fields, require admin permissions
      await requireMinLevel(employee, 2);
    }
    // Otherwise, allow the update (no permission check needed for self-update of allowed fields)
  } else {
    // Updating another employee requires admin permissions
    await requireMinLevel(employee, 2);
  }

  // Update employee
  const updatedEmployee = await EmployeeService.update(id, body);

  return success(updatedEmployee);
}

