/**
 * Hint sites handler
 * Returns up to 5 site hints based on query string
 */

import { success } from '../_shared/response.ts';
import { requireMinLevel } from '../_shared/auth.ts';
import { SiteService } from '../services/siteService.ts';
import type { Employee } from '../_shared/auth.ts';

export async function hint(req: Request, employee: Employee) {
  // Check permissions - Level 0 and above can get site hints
  await requireMinLevel(employee, 0);

  // Parse query parameters
  const url = new URL(req.url);
  const q = url.searchParams.get('q') || '';
  const company_id = url.searchParams.get('company_id') || undefined;

  // Get site hints
  const sites = await SiteService.hint(q, company_id);

  return success(sites);
}

