/**
 * Hint merchandise handler
 * Returns up to 5 merchandise hints based on query string
 */

import { success } from '../_shared/response.ts';
import { requireMinLevel } from '../_shared/auth.ts';
import { MerchandiseService } from '../services/merchandiseService.ts';
import type { Employee } from '../_shared/auth.ts';

export async function hint(req: Request, employee: Employee) {
  // Check permissions - Level 0 and above can get merchandise hints
  await requireMinLevel(employee, 0);

  // Parse query parameters
  const url = new URL(req.url);
  const q = url.searchParams.get('q') || '';
  const siteId = url.searchParams.get('site_id') || undefined;

  // Get merchandise hints
  const merchandise = await MerchandiseService.hint(q, siteId);

  return success(merchandise);
}

