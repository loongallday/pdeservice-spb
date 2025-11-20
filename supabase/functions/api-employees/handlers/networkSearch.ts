/**
 * Network search employees handler
 * Network user search API for employee management
 * Supports text search and network-relevant filters with pagination
 */

import { successWithPagination } from '../_shared/response.ts';
import { requireMinLevel } from '../_shared/auth.ts';
import { parsePaginationParams, validateUUID } from '../_shared/validation.ts';
import { EmployeeService } from '../services/employeeService.ts';
import type { Employee } from '../_shared/auth.ts';

export async function networkSearch(req: Request, employee: Employee) {
  // Check permissions - Level 0 and above can search employees
  await requireMinLevel(employee, 0);

  // Parse query parameters
  const url = new URL(req.url);
  const { page, limit } = parsePaginationParams(url);
  
  // Text search query (optional) - searches name and email
  const q = url.searchParams.get('q') || undefined;
  
  // Network user search filters
  const department_id = url.searchParams.get('department_id') || undefined;
  const role = url.searchParams.get('role') || undefined;
  const is_active = url.searchParams.get('is_active') === 'true' ? true : 
                    url.searchParams.get('is_active') === 'false' ? false : undefined;

  // Validate department_id if provided
  if (department_id) {
    validateUUID(department_id, 'Department ID');
  }

  // Network search with filters and pagination
  const result = await EmployeeService.networkSearch({
    q,
    page,
    limit,
    department_id,
    role,
    is_active,
  });

  return successWithPagination(result.data, result.pagination);
}

