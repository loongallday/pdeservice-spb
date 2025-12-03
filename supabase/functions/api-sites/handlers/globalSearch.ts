/**
 * Global search sites handler
 * Supports text search with pagination
 */

import { successWithPagination } from '../_shared/response.ts';
import { requireMinLevel } from '../_shared/auth.ts';
import { parsePaginationParams } from '../_shared/validation.ts';
import { SiteService } from '../services/siteService.ts';
import type { Employee } from '../_shared/auth.ts';

export async function globalSearch(req: Request, employee: Employee) {
  // Check permissions - Level 0 and above can search sites
  await requireMinLevel(employee, 0);

  // Parse query parameters
  const url = new URL(req.url);
  const { page, limit } = parsePaginationParams(url);
  
  // Text search query (optional) - searches name and address_detail
  const q = url.searchParams.get('q') || undefined;
  
  // Optional company filter
  const company_id = url.searchParams.get('company_id') || undefined;

  // Global search with pagination
  const result = await SiteService.globalSearch({
    q,
    page,
    limit,
    company_id,
  });

  return successWithPagination(result.data, result.pagination);
}

