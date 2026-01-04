/**
 * List package items handler
 */

import { successWithPagination } from '../../_shared/response.ts';
import { requireMinLevel } from '../../_shared/auth.ts';
import { parsePaginationParams } from '../../_shared/validation.ts';
import { PackageItemService } from '../services/packageItemService.ts';
import type { Employee } from '../../_shared/auth.ts';

export async function list(req: Request, employee: Employee) {
  // Check permissions - Level 0 and above can list package items
  await requireMinLevel(employee, 0);

  // Parse query parameters
  const url = new URL(req.url);
  const { page, limit } = parsePaginationParams(url);
  const category = url.searchParams.get('category') || undefined;
  const is_active_param = url.searchParams.get('is_active');
  const is_active = is_active_param !== null ? is_active_param === 'true' : undefined;
  const q = url.searchParams.get('q') || undefined;

  // Get package items with pagination
  const result = await PackageItemService.getAll({ page, limit, category, is_active, q });

  return successWithPagination(result.data, result.pagination);
}

