/**
 * Get all constants handler
 */

import { success } from '../_shared/response.ts';
import { requireMinLevel } from '../_shared/auth.ts';
import { ReferenceService } from '../services/referenceService.ts';
import type { Employee } from '../_shared/auth.ts';

export async function getAllConstants(req: Request, employee: Employee) {
  // Check permissions - Level 0 and above can view constants
  await requireMinLevel(employee, 0);

  // Get all constants from service
  const constants = await ReferenceService.getAllConstants();

  return success(constants);
}

