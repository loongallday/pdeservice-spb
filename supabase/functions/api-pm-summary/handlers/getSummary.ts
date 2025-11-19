/**
 * Get PM summary handler
 */

import { success } from '../_shared/response.ts';
import { requireMinLevel } from '../_shared/auth.ts';
import { parsePaginationParams } from '../_shared/validation.ts';
import { PMSummaryService } from '../services/pmSummaryService.ts';
import type { Employee } from '../_shared/auth.ts';

export async function getSummary(req: Request, employee: Employee) {
  // Check permissions - Level 0 and above can view PM summary
  await requireMinLevel(employee, 0);

  // Parse query parameters
  const url = new URL(req.url);
  const { page, limit } = parsePaginationParams(url);
  const siteId = url.searchParams.get('site_id') || undefined;
  const merchandiseId = url.searchParams.get('merchandise_id') || undefined;
  const needsRenewal = url.searchParams.get('needs_renewal') === 'true' ? true : 
                       url.searchParams.get('needs_renewal') === 'false' ? false : undefined;

  // Get PM summary from service
  const result = await PMSummaryService.getSummary({ 
    page, 
    limit, 
    siteId, 
    merchandiseId,
    needsRenewal 
  });

  return success(result);
}

