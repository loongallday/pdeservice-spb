/**
 * Update work result handler
 */

import { success } from '../../_shared/response.ts';
import { requireMinLevel } from '../../_shared/auth.ts';
import { parseRequestBody, validateUUID } from '../../_shared/validation.ts';
import { WorkResultService } from '../services/workResultService.ts';
import type { Employee } from '../../_shared/auth.ts';

export async function update(req: Request, employee: Employee, id: string) {
  // Check permissions - Level 0 (all authenticated users) and above can update work results
  await requireMinLevel(employee, 0);

  // Validate ID
  validateUUID(id, 'Work Result ID');

  // Parse request body
  const body = await parseRequestBody<Record<string, unknown>>(req);

  // Update work result
  const workResult = await WorkResultService.update(id, body);

  return success(workResult);
}

