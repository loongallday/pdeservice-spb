/**
 * Search PM logs handler
 */

import { success } from '../_shared/response.ts';
import { requireMinLevel } from '../_shared/auth.ts';
import { PMLogService } from '../services/pmlogService.ts';
import type { Employee } from '../_shared/auth.ts';

export async function search(req: Request, employee: Employee) {
  // Check permissions - Level 0 and above can search PM logs
  await requireMinLevel(employee, 0);

  // Parse query parameters
  const url = new URL(req.url);
  const query = url.searchParams.get('q') || '';

  // Search PM logs
  const results = await PMLogService.search(query);

  return success(results);
}

