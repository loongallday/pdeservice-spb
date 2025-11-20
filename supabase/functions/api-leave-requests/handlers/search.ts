/**
 * Search leave requests handler
 */

import { success } from '../_shared/response.ts';
import { requireMinLevel } from '../_shared/auth.ts';
import { LeaveService } from '../services/leaveService.ts';
import type { Employee } from '../_shared/auth.ts';

export async function search(req: Request, employee: Employee) {
  // Check permissions - Level 0 and above can search leave requests
  await requireMinLevel(employee, 0);

  // Parse query parameters
  const url = new URL(req.url);
  const query = url.searchParams.get('q') || '';

  // Search leave requests
  const results = await LeaveService.search(query);

  return success(results);
}

