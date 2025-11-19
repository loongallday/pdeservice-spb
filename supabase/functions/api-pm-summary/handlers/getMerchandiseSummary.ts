/**
 * Get single merchandise summary handler
 */

import { success } from '../_shared/response.ts';
import { requireMinLevel } from '../_shared/auth.ts';
import { PMSummaryService } from '../services/pmSummaryService.ts';
import type { Employee } from '../_shared/auth.ts';

export async function getMerchandiseSummary(req: Request, employee: Employee, id: string) {
  // Check permissions - Level 0 and above can view merchandise summary
  await requireMinLevel(employee, 0);

  // Get merchandise summary from service
  const result = await PMSummaryService.getMerchandiseSummary(id);

  return success(result);
}

