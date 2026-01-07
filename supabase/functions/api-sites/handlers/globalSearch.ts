/**
 * Global search sites handler
 * Supports text search with pagination
 */

import { successWithPagination } from '../../_shared/response.ts';
import { requireMinLevel } from '../../_shared/auth.ts';
import { parsePaginationParams } from '../../_shared/validation.ts';
import { SiteService } from '../services/siteService.ts';
import type { Employee } from '../../_shared/auth.ts';

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

  // Optional ticket count filters
  const min_ticket_count_str = url.searchParams.get('min_ticket_count');
  const max_ticket_count_str = url.searchParams.get('max_ticket_count');
  const min_ticket_count = min_ticket_count_str ? parseInt(min_ticket_count_str, 10) : undefined;
  const max_ticket_count = max_ticket_count_str ? parseInt(max_ticket_count_str, 10) : undefined;

  // Global search with pagination
  const result = await SiteService.globalSearch({
    q,
    page,
    limit,
    company_id,
    min_ticket_count,
    max_ticket_count,
  });

  return successWithPagination(result.data, result.pagination);
}

