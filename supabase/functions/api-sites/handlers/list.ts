/**
 * List sites handler
 */

import { success } from '../_shared/response.ts';
import { requireMinLevel } from '../_shared/auth.ts';
import { parsePaginationParams } from '../_shared/validation.ts';
import { SiteService } from '../services/siteService.ts';
import type { Employee } from '../_shared/auth.ts';

export async function list(req: Request, employee: Employee) {
  // Check permissions - Level 0 and above can list sites
  await requireMinLevel(employee, 0);

  // Parse query parameters
  const url = new URL(req.url);
  const { page, limit } = parsePaginationParams(url);
  
  const company_id = url.searchParams.get('company_id') || undefined;

  // Get sites from service
  const result = await SiteService.getAll({
    page,
    limit,
    company_id,
  });

  return success(result);
}

