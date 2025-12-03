/**
 * Search work results handler
 */

import { success } from '../_shared/response.ts';
import { requireMinLevel } from '../_shared/auth.ts';
import { WorkResultService } from '../services/workResultService.ts';
import type { Employee } from '../_shared/auth.ts';

export async function search(req: Request, employee: Employee) {
  // Check permissions - Level 0 and above can search work results
  await requireMinLevel(employee, 0);

  // Parse query parameters
  const url = new URL(req.url);
  const query = url.searchParams.get('q') || '';

  // Search work results
  const results = await WorkResultService.search(query);

  return success(results);
}

