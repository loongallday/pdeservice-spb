/**
 * Get PM logs by merchandise handler
 */

import { success, error } from '../_shared/response.ts';
import { requireMinLevel } from '../_shared/auth.ts';
import { parsePaginationParams } from '../_shared/validation.ts';
import { PMLogService } from '../services/pmlogService.ts';
import type { Employee } from '../_shared/auth.ts';

export async function getByMerchandise(req: Request, employee: Employee, merchandiseId: string) {
  // Check permissions - Level 0 and above can view PM logs
  await requireMinLevel(employee, 0);

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(merchandiseId)) {
    return error('Not found', 404);
  }

  // Parse query parameters
  const url = new URL(req.url);
  const { page, limit } = parsePaginationParams(url);

  // Get PM logs by merchandise
  const result = await PMLogService.getByMerchandise(merchandiseId, { page, limit });

  return success(result);
}

