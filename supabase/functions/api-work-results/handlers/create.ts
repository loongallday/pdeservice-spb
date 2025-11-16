/**
 * Create work result handler
 */

import { success } from '../../_shared/response.ts';
import { requireMinLevel } from '../../_shared/auth.ts';
import { parseRequestBody, validateRequired } from '../../_shared/validation.ts';
import { WorkResultService } from '../services/workResultService.ts';
import { HTTP_STATUS } from '../../_shared/constants.ts';
import type { Employee } from '../../_shared/auth.ts';

export async function create(req: Request, employee: Employee) {
  // Check permissions - Level 0 (all authenticated users) and above can create work results
  await requireMinLevel(employee, 0);

  // Parse request body
  const body = await parseRequestBody<Record<string, unknown>>(req);

  // Validate required fields
  validateRequired(body.ticket_id, 'Ticket ID');

  // Create work result
  const workResult = await WorkResultService.create(body);

  return success(workResult, HTTP_STATUS.CREATED);
}

