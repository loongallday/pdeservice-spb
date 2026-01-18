/**
 * @fileoverview Master search/list employees handler
 * @endpoint GET /api-employees
 * @auth Required - Level 1+ (Assigner, PM, Sales, Admin, Superadmin)
 *
 * @queryParam {number} [page=1] - Page number (1-based)
 * @queryParam {number} [limit=50] - Items per page
 * @queryParam {string} [q] - Text search (searches name, code, email, nickname)
 * @queryParam {string} [role] - Filter by role code (e.g., "technician_l1")
 * @queryParam {string} [role_id] - Filter by role UUID
 * @queryParam {string} [department_id] - Filter by department UUID
 * @queryParam {string} [code] - Filter by exact employee code
 * @queryParam {boolean} [is_active] - Filter by active status ("true"/"false")
 *
 * @returns {PaginatedResponse<EmployeeSearchResult[]>} Paginated list of employees
 * @throws {AuthenticationError} 401 - If not authenticated
 * @throws {ForbiddenError} 403 - If permission level < 1
 * @throws {ValidationError} 400 - If UUIDs are invalid
 *
 * @description
 * Master search endpoint for employee management (admin-level).
 * Uses the v_employees view which provides flattened role and department data.
 *
 * Returns transformed employee data with:
 * - Flattened role info (role_id, role_code, role_name)
 * - Flattened department info (department_id, department_code, department_name)
 *
 * Performance optimizations:
 * - Combined count + data query
 * - Cached role/department lookups
 *
 * @example
 * GET /api-employees?q=john&is_active=true&limit=20
 * GET /api-employees?department_id=uuid&role=technician_l1
 */

import { successWithPagination } from '../../_shared/response.ts';
import { requireMinLevel } from '../../_shared/auth.ts';
import { parsePaginationParams, validateUUID } from '../../_shared/validation.ts';
import { EmployeeService } from '../services/employeeService.ts';
import type { Employee } from '../../_shared/auth.ts';

export async function search(req: Request, employee: Employee) {
  // Check permissions - Level 1+ can search employees (admin level)
  await requireMinLevel(employee, 1);

  // Parse query parameters
  const url = new URL(req.url);
  const { page, limit } = parsePaginationParams(url);

  // Text search query (optional) - searches name, code, email, nickname
  const q = url.searchParams.get('q') || undefined;

  // Search filters
  const role = url.searchParams.get('role') || undefined;
  const role_id = url.searchParams.get('role_id') || undefined;
  const department_id = url.searchParams.get('department_id') || undefined;
  const code = url.searchParams.get('code') || undefined;
  const is_active = url.searchParams.get('is_active') === 'true' ? true :
                    url.searchParams.get('is_active') === 'false' ? false : undefined;

  // Validate UUIDs if provided
  if (role_id) {
    validateUUID(role_id, 'Role ID');
  }
  if (department_id) {
    validateUUID(department_id, 'Department ID');
  }

  // Search with filters and pagination
  const result = await EmployeeService.search({
    q,
    page,
    limit,
    role,
    department_id,
    code,
    is_active,
  });

  return successWithPagination(result.data, result.pagination);
}
