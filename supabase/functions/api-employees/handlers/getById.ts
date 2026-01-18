/**
 * @fileoverview Get single employee by ID handler
 * @endpoint GET /api-employees/:id
 * @auth Required - Level 0+ (all authenticated users)
 *
 * @param {string} id - Employee UUID from URL path
 *
 * @returns {EmployeeWithRole} Employee data with nested role and department
 * @throws {AuthenticationError} 401 - If not authenticated
 * @throws {ValidationError} 400 - If ID is not a valid UUID
 * @throws {NotFoundError} 404 - If employee not found
 *
 * @description
 * Retrieves a single employee by their UUID. Returns full employee data
 * including nested role information with department.
 *
 * @example
 * GET /api-employees/123e4567-e89b-12d3-a456-426614174000
 *
 * Response:
 * {
 *   "data": {
 *     "id": "123e4567-e89b-12d3-a456-426614174000",
 *     "name": "John Doe",
 *     "code": "EMP001",
 *     "role_data": {
 *       "code": "technician_l1",
 *       "name_th": "ช่างเทคนิค",
 *       "department": { ... }
 *     }
 *   }
 * }
 */

import { success } from '../../_shared/response.ts';
import { requireMinLevel } from '../../_shared/auth.ts';
import { validateUUID } from '../../_shared/validation.ts';
import { EmployeeService } from '../services/employeeService.ts';
import type { Employee } from '../../_shared/auth.ts';

export async function getById(req: Request, employee: Employee, id: string) {
  // Check permissions - Level 0 and above can view employees
  await requireMinLevel(employee, 0);

  // Validate ID
  validateUUID(id, 'Employee ID');

  // Get employee from service
  const employeeData = await EmployeeService.getById(id);

  return success(employeeData);
}

