/**
 * List PM logs handler
 */

import { success } from '../_shared/response.ts';
import { requireMinLevel } from '../_shared/auth.ts';
import { parsePaginationParams } from '../_shared/validation.ts';
import { PMLogService } from '../services/pmlogService.ts';
import type { Employee } from '../_shared/auth.ts';

export async function list(req: Request, employee: Employee) {
  // Check permissions - Level 0 and above can list PM logs
  await requireMinLevel(employee, 0);

  // Parse query parameters
  const url = new URL(req.url);
  const { page, limit } = parsePaginationParams(url);

  // Get PM logs from service
  const result = await PMLogService.getAll({ page, limit });

  return success(result);
}

