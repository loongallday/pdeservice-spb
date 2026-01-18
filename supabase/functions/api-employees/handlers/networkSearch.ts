/**
 * @fileoverview Network search employees handler
 * @endpoint GET /api-employees/network-search
 * @auth Required - Level 0+ (all authenticated users)
 *
 * @queryParam {number} [page=1] - Page number (1-based)
 * @queryParam {number} [limit=50] - Items per page
 * @queryParam {string} [q] - Text search (searches name and email only)
 * @queryParam {string} [department_id] - Filter by department UUID(s) - supports multiple via % or , separator
 * @queryParam {string} [role] - Filter by role code
 * @queryParam {string} [role_id] - Filter by role UUID
 * @queryParam {boolean} [is_active] - Filter by active status ("true"/"false")
 *
 * @returns {PaginatedResponse<EmployeeSearchResult[]>} Paginated list of employees
 * @throws {AuthenticationError} 401 - If not authenticated
 * @throws {ValidationError} 400 - If UUIDs are invalid
 *
 * @description
 * Network search endpoint optimized for user management UI (e.g., employee pickers).
 * Simpler than master search - focuses on name/email and network-relevant filters.
 *
 * Key differences from master search (/api-employees):
 * - Lower permission level (Level 0 vs Level 1)
 * - Text search only on name and email (not code/nickname)
 * - Supports multiple department_id values (array filter)
 * - Includes auth_user_id in response
 *
 * Department ID array formats:
 * - Percent-separated (new): ?department_id=uuid1%uuid2
 * - Comma-separated (legacy): ?department_id=uuid1,uuid2
 *
 * @example
 * GET /api-employees/network-search?q=john&is_active=true
 * GET /api-employees/network-search?department_id=uuid1%uuid2
 */

import { successWithPagination } from '../../_shared/response.ts';
import { requireMinLevel } from '../../_shared/auth.ts';
import { parsePaginationParams, validateUUID } from '../../_shared/validation.ts';
import { EmployeeService } from '../services/employeeService.ts';
import type { Employee } from '../../_shared/auth.ts';

export async function networkSearch(req: Request, employee: Employee) {
  // Check permissions - Level 0 and above can search employees
  await requireMinLevel(employee, 0);

  // Parse query parameters
  const url = new URL(req.url);
  const { page, limit } = parsePaginationParams(url);
  
  // Text search query (optional) - searches name and email
  const q = url.searchParams.get('q') || undefined;
  
  // Network user search filters
  // Handle department_id - support both single value and array (percent-separated or comma-separated)
  const departmentIdParam = url.searchParams.get('department_id') || undefined;
  let department_id: string | string[] | undefined = undefined;
  if (departmentIdParam) {
    // Support both % separator (new format) and comma separator (backward compatibility)
    // Split by % first, if no % found, split by comma
    let departmentIds: string[];
    if (departmentIdParam.includes('%')) {
      departmentIds = departmentIdParam.split('%').map(id => id.trim()).filter(Boolean);
    } else {
      departmentIds = departmentIdParam.split(',').map(id => id.trim()).filter(Boolean);
    }
    department_id = departmentIds.length === 1 ? departmentIds[0] : departmentIds;
    
    // Validate all department IDs
    const idsToValidate = Array.isArray(department_id) ? department_id : [department_id];
    for (const id of idsToValidate) {
      validateUUID(id, 'Department ID');
    }
  }
  
  const role = url.searchParams.get('role') || undefined;
  const role_id = url.searchParams.get('role_id') || undefined;
  const is_active = url.searchParams.get('is_active') === 'true' ? true :
                    url.searchParams.get('is_active') === 'false' ? false : undefined;

  // Validate department IDs and role_id if provided
  if (role_id) {
    validateUUID(role_id, 'Role ID');
  }

  // Network search with filters and pagination
  const result = await EmployeeService.networkSearch({
    q,
    page,
    limit,
    department_id,
    role,
    role_id,
    is_active,
  });

  return successWithPagination(result.data, result.pagination);
}

