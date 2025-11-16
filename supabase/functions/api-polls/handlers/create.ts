/**
 * Create poll handler
 */

import { success } from '../../_shared/response.ts';
import { requireMinLevel } from '../../_shared/auth.ts';
import { parseRequestBody, validateRequired } from '../../_shared/validation.ts';
import { PollService } from '../services/pollService.ts';
import { HTTP_STATUS } from '../../_shared/constants.ts';
import type { Employee } from '../../_shared/auth.ts';

export async function create(req: Request, employee: Employee) {
  // Check permissions - Level 0 (all authenticated users) and above can create polls
  await requireMinLevel(employee, 0);

  // Parse request body
  const body = await parseRequestBody<Record<string, unknown>>(req);

  // Validate required fields
  validateRequired(body.question, 'คำถาม');

  // Set creator
  body.created_by = employee.id;

  // Create poll
  const poll = await PollService.create(body);

  return success(poll, HTTP_STATUS.CREATED);
}

