/**
 * Get recent sites handler
 */

import { success } from '../_shared/response.ts';
import { requireMinLevel } from '../_shared/auth.ts';
import { ValidationError } from '../_shared/error.ts';
import { SiteService } from '../services/siteService.ts';
import type { Employee } from '../_shared/auth.ts';

export async function recent(req: Request, employee: Employee) {
  // Check permissions - Level 0 and above can get recent sites
  await requireMinLevel(employee, 0);

  // Parse query parameters
  const url = new URL(req.url);
  const limitParam = url.searchParams.get('limit');
  const limit = limitParam ? parseInt(limitParam, 10) : 5;
  const companyId = url.searchParams.get('company_id') || undefined;

  // Validate limit
  if (isNaN(limit) || limit < 1 || limit > 100) {
    throw new ValidationError('Limit must be between 1 and 100');
  }

  // Get recent sites
  const sites = await SiteService.getRecent(limit, companyId);

  return success(sites);
}

