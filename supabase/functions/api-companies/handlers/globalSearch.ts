/**
 * Global search companies handler
 * Supports text search with pagination
 */

import { successWithPagination } from '../_shared/response.ts';
import { requireMinLevel } from '../_shared/auth.ts';
import { parsePaginationParams } from '../_shared/validation.ts';
import { CompanyService } from '../services/companyService.ts';
import type { Employee } from '../_shared/auth.ts';

export async function globalSearch(req: Request, employee: Employee) {
  // Check permissions - Level 0 and above can search companies
  await requireMinLevel(employee, 0);

  // Parse query parameters
  const url = new URL(req.url);
  const { page, limit } = parsePaginationParams(url);
  
  // Text search query (optional) - searches name and tax_id
  const q = url.searchParams.get('q') || undefined;

  // Global search with pagination
  const result = await CompanyService.globalSearch({
    q,
    page,
    limit,
  });

  return successWithPagination(result.data, result.pagination);
}

