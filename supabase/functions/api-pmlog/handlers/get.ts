/**
 * Get single PM log handler
 */

import { success, error } from '../_shared/response.ts';
import { requireMinLevel } from '../_shared/auth.ts';
import { PMLogService } from '../services/pmlogService.ts';
import type { Employee } from '../_shared/auth.ts';

export async function get(req: Request, employee: Employee, id: string) {
  // Check permissions - Level 0 and above can view PM logs
  await requireMinLevel(employee, 0);

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    return error('Not found', 404);
  }

  // Get PM log from service
  const result = await PMLogService.getById(id);

  return success(result);
}

