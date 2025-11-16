/**
 * Get leave types handler
 */

import { success } from '../../_shared/response.ts';
import { requireMinLevel } from '../../_shared/auth.ts';
import { ReferenceService } from '../services/referenceService.ts';
import type { Employee } from '../../_shared/auth.ts';

export async function getLeaveTypes(req: Request, employee: Employee) {
  // Check permissions - Level 0 (all authenticated users) and above can read reference data
  await requireMinLevel(employee, 0);

  // Fetch leave types
  const leaveTypes = await ReferenceService.getLeaveTypes();

  // Log for debugging

  return success(leaveTypes);
}

