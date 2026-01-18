/**
 * @fileoverview Create new employee handler
 * @endpoint POST /api-employees
 * @auth Required - Level 2+ (Admin, Superadmin)
 *
 * @bodyParam {string} name - Required: Employee full name
 * @bodyParam {string} code - Required: Employee code/ID (unique identifier)
 * @bodyParam {string} [nickname] - Employee nickname
 * @bodyParam {string} [email] - Email address
 * @bodyParam {string} [role_id] - Role UUID (preferred over role code)
 * @bodyParam {string} [role] - Role code (legacy, converted to role_id)
 * @bodyParam {string} [profile_image_url] - Profile image URL
 * @bodyParam {string} [cover_image_url] - Cover image URL
 * @bodyParam {string} [supervisor_id] - Supervisor employee UUID
 * @bodyParam {boolean} [is_active=true] - Active status
 *
 * @returns {EmployeeWithRole} The created employee with role/department data (HTTP 201)
 * @throws {AuthenticationError} 401 - If not authenticated
 * @throws {ForbiddenError} 403 - If permission level < 2
 * @throws {ValidationError} 400 - If name or code is missing
 * @throws {DatabaseError} 500 - If role code not found or creation fails
 *
 * @description
 * Creates a new employee in the system. On creation:
 * - If `role` (code) is provided instead of `role_id`, it's converted to UUID
 * - Initial leave balances are automatically created (sick: 30, vacation: 6, personal: 3)
 * - Employee is created with is_active=true by default
 *
 * @example
 * POST /api-employees
 * {
 *   "name": "John Doe",
 *   "code": "EMP001",
 *   "email": "john@example.com",
 *   "role_id": "uuid-of-technician-role"
 * }
 */

import { success } from '../../_shared/response.ts';
import { requireMinLevel } from '../../_shared/auth.ts';
import { parseRequestBody, validateRequired } from '../../_shared/validation.ts';
import { EmployeeService } from '../services/employeeService.ts';
import { HTTP_STATUS } from '../../_shared/constants.ts';
import type { Employee } from '../../_shared/auth.ts';

export async function create(req: Request, employee: Employee) {
  // Check permissions - Level 2 (admin) and above can create employees
  await requireMinLevel(employee, 2);

  // Parse request body
      const body = await parseRequestBody<Record<string, unknown>>(req);

  // Validate required fields
  validateRequired(body.name, 'ชื่อ');
  validateRequired(body.code, 'รหัสพนักงาน');

  // Create employee
  const newEmployee = await EmployeeService.create(body);

  return success(newEmployee, HTTP_STATUS.CREATED);
}

