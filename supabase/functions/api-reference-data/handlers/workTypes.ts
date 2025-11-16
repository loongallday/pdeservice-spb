/**
 * Get work types handler
 */

import { success } from '../../_shared/response.ts';
import { requireMinLevel } from '../../_shared/auth.ts';
import { ReferenceService } from '../services/referenceService.ts';
import type { Employee } from '../../_shared/auth.ts';

export async function getWorkTypes(req: Request, employee: Employee) {
  // Check permissions - Level 0 (all authenticated users) and above can read reference data
  await requireMinLevel(employee, 0);

  // Fetch work types
  const workTypes = await ReferenceService.getWorkTypes();

  return success(workTypes);
}

