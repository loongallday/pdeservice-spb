/**
 * Search models handler - Search by description and code with pagination
 */

import { successWithPagination } from '../../_shared/response.ts';
import { requireMinLevel } from '../../_shared/auth.ts';
import { ModelService } from '../services/modelService.ts';
import type { Employee } from '../../_shared/auth.ts';

export async function search(req: Request, employee: Employee) {
  // Check permissions - Level 0 and above can search models
  await requireMinLevel(employee, 0);

  // Parse query parameters
  const url = new URL(req.url);
  const description = url.searchParams.get('description') || undefined;
  const code = url.searchParams.get('code') || undefined;
  const category = url.searchParams.get('category') || undefined;
  const is_active = url.searchParams.get('is_active');
  const has_serial = url.searchParams.get('has_serial');
  const page = parseInt(url.searchParams.get('page') || '1', 10);
  const limit = parseInt(url.searchParams.get('limit') || '20', 10);

  // Parse boolean filters (null = all, true/false = specific)
  const isActiveFilter = is_active === 'true' ? true : is_active === 'false' ? false : undefined;
  const hasSerialFilter = has_serial === 'true' ? true : has_serial === 'false' ? false : undefined;

  // Search models with pagination
  const results = await ModelService.search({
    description,
    code,
    category,
    is_active: isActiveFilter,
    has_serial: hasSerialFilter,
    page,
    limit
  });

  return successWithPagination(results.data, results.pagination);
}

