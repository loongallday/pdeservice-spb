/**
 * Search roles handler
 */

import { successWithPagination } from '../../_shared/response.ts';
import { requireMinLevel } from '../../_shared/auth.ts';
import { parsePaginationParams } from '../../_shared/validation.ts';
import { RoleService } from '../services/roleService.ts';
import type { Employee } from '../../_shared/auth.ts';

export async function search(req: Request, employee: Employee) {
  // Check permissions - Level 0 and above can search roles
  await requireMinLevel(employee, 0);

  // Parse query parameters
  const url = new URL(req.url);
  const query = url.searchParams.get('q') || '';
  const { page, limit } = parsePaginationParams(url);

  // Search roles with pagination
  const result = await RoleService.search(query, { page, limit });

  return successWithPagination(result.data, result.pagination);
}

