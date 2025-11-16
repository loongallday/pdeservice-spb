/**
 * Update poll handler
 */

import { success } from '../../_shared/response.ts';
import { requireMinLevel } from '../../_shared/auth.ts';
import { parseRequestBody, validateUUID } from '../../_shared/validation.ts';
import { PollService } from '../services/pollService.ts';
import type { Employee } from '../../_shared/auth.ts';

export async function update(req: Request, employee: Employee, id: string) {
  // Check permissions - Level 0 (all authenticated users) and above can update polls
  await requireMinLevel(employee, 0);

  // Validate ID
  validateUUID(id, 'Poll ID');

  // Parse request body
  const body = await parseRequestBody<Record<string, unknown>>(req);

  // Update poll
  const poll = await PollService.update(id, body);

  return success(poll);
}

