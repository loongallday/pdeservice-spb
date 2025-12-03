/**
 * Search departments handler
 */

import { successWithPagination } from '../_shared/response.ts';
import { requireMinLevel } from '../_shared/auth.ts';
import { parsePaginationParams } from '../_shared/validation.ts';
import { DepartmentService } from '../services/departmentService.ts';
import type { Employee } from '../_shared/auth.ts';

export async function search(req: Request, employee: Employee) {
  // Check permissions - Level 0 and above can search departments
  await requireMinLevel(employee, 0);

  // Parse query parameters
  const url = new URL(req.url);
  const query = url.searchParams.get('q') || '';
  const { page, limit } = parsePaginationParams(url);

  // Search departments with pagination
  const result = await DepartmentService.search(query, { page, limit });

  return successWithPagination(result.data, result.pagination);
}

