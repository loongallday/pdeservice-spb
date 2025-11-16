/**
 * Search sites handler
 */

import { success } from '../_shared/response.ts';
import { requireMinLevel } from '../_shared/auth.ts';
import { SiteService } from '../services/siteService.ts';
import type { Employee } from '../_shared/auth.ts';

export async function search(req: Request, employee: Employee) {
  // Check permissions - Level 0 and above can search sites
  await requireMinLevel(employee, 0);

  // Parse query parameters
  const url = new URL(req.url);
  const query = url.searchParams.get('q') || '';
  const company_id = url.searchParams.get('company_id') || undefined;

  // Search sites
  const sites = await SiteService.search(query, company_id);

  return success(sites);
}

