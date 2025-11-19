/**
 * Get PM logs for merchandise handler
 */

import { success } from '../_shared/response.ts';
import { requireMinLevel } from '../_shared/auth.ts';
import { parsePaginationParams } from '../_shared/validation.ts';
import { PMSummaryService } from '../services/pmSummaryService.ts';
import type { Employee } from '../_shared/auth.ts';

export async function getPMLogs(req: Request, employee: Employee, merchandiseId: string) {
  // Check permissions - Level 0 and above can view PM logs
  await requireMinLevel(employee, 0);

  // Parse query parameters
  const url = new URL(req.url);
  const { page, limit } = parsePaginationParams(url);

  // Get PM logs for merchandise
  const result = await PMSummaryService.getPMLogs(merchandiseId, { page, limit });

  return success(result);
}

