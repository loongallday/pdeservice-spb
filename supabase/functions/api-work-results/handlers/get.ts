/**
 * Get work result by ID handler
 */

import { success } from '../../_shared/response.ts';
import { requireMinLevel } from '../../_shared/auth.ts';
import { validateUUID } from '../../_shared/validation.ts';
import { WorkResultService } from '../services/workResultService.ts';
import type { Employee } from '../../_shared/auth.ts';

export async function get(req: Request, employee: Employee, id: string) {
  // Check permissions - Level 0 (all authenticated users) and above can view work results
  await requireMinLevel(employee, 0);

  // Validate ID
  validateUUID(id, 'Work Result ID');

  // Fetch work result
  const workResult = await WorkResultService.getById(id);

  return success(workResult);
}

