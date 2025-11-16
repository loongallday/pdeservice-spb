/**
 * Vote on poll handler
 */

import { success } from '../../_shared/response.ts';
import { requireMinLevel } from '../../_shared/auth.ts';
import { parseRequestBody, validateUUID } from '../../_shared/validation.ts';
import { PollService } from '../services/pollService.ts';
import { HTTP_STATUS } from '../../_shared/constants.ts';
import type { Employee } from '../../_shared/auth.ts';

export async function vote(req: Request, employee: Employee, pollId: string) {
  // Check permissions - Level 0 (all authenticated users) and above can vote
  await requireMinLevel(employee, 0);

  // Validate poll ID
  validateUUID(pollId, 'Poll ID');

  // Parse request body
  const body = await parseRequestBody<Record<string, unknown>>(req);

  // Create vote
  const voteResult = await PollService.vote(pollId, employee.id, body);

  return success(voteResult, HTTP_STATUS.CREATED);
}

