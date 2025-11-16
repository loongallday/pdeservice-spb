/**
 * List polls handler
 */

import { success } from '../../_shared/response.ts';
import { requireMinLevel } from '../../_shared/auth.ts';
import { parsePaginationParams } from '../../_shared/validation.ts';
import { PollService } from '../services/pollService.ts';
import type { Employee } from '../../_shared/auth.ts';

export async function list(req: Request, employee: Employee) {
  // Check permissions - Level 0 (all authenticated users) and above can view polls
  await requireMinLevel(employee, 0);

  // Parse pagination and filters
  const url = new URL(req.url);
  const { page, limit } = parsePaginationParams(url);
  const filter = url.searchParams.get('filter') as 'all' | 'active' | 'expired' || 'all';

  // Fetch polls
  const result = await PollService.getAll({ page, limit, filter });

  return success(result);
}

