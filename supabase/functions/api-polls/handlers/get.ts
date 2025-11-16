/**
 * Get single poll handler
 */

import { success } from '../../_shared/response.ts';
import { requireMinLevel } from '../../_shared/auth.ts';
import { validateUUID } from '../../_shared/validation.ts';
import { PollService } from '../services/pollService.ts';
import type { Employee } from '../../_shared/auth.ts';

export async function get(req: Request, employee: Employee, id: string) {
  // Check permissions - Level 0 (all authenticated users) and above can view polls
  await requireMinLevel(employee, 0);

  // Validate ID
  validateUUID(id, 'Poll ID');

  // Fetch poll
  const poll = await PollService.getById(id);

  return success(poll);
}

