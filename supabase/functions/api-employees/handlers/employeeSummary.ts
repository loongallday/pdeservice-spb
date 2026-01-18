/**
 * @fileoverview Get employee summary (lightweight list) handler
 * @endpoint GET /api-employees/employee-summary
 * @auth Required - Level 0+ (all authenticated users)
 *
 * @returns {EmployeeSummary[]} Array of lightweight employee records
 * @throws {AuthenticationError} 401 - If not authenticated
 *
 * @description
 * Returns a lightweight list of all active employees with minimal fields.
 * Designed for use in dropdowns, autocomplete, and employee pickers.
 *
 * Returns only active employees (is_active=true) with:
 * - id, name, email
 * - role_name (Thai name)
 * - is_link_auth (whether employee has linked auth account)
 * - profile_image_url
 *
 * NOT paginated - returns all active employees.
 * Use search endpoints for filtered/paginated results.
 *
 * @example
 * GET /api-employees/employee-summary
 *
 * Response:
 * {
 *   "data": [
 *     {
 *       "id": "uuid",
 *       "name": "John Doe",
 *       "email": "john@example.com",
 *       "role_name": "ช่างเทคนิค",
 *       "is_link_auth": true,
 *       "profile_image_url": "https://..."
 *     }
 *   ]
 * }
 */

import { success } from '../../_shared/response.ts';
import { requireMinLevel } from '../../_shared/auth.ts';
import { EmployeeService } from '../services/employeeService.ts';
import type { Employee } from '../../_shared/auth.ts';

export async function getEmployeeSummary(_req: Request, employee: Employee) {
  // Check permissions - Level 0 and above can view employee summary
  await requireMinLevel(employee, 0);

  // Get employee summary from service
  const summary = await EmployeeService.getEmployeeSummary();

  return success(summary);
}

