/**
 * Delete PM log handler
 */

import { success, error } from '../_shared/response.ts';
import { requireMinLevel } from '../_shared/auth.ts';
import { PMLogService } from '../services/pmlogService.ts';
import type { Employee } from '../_shared/auth.ts';

export async function deletePMLog(req: Request, employee: Employee, id: string) {
  // Check permissions - Level 2 and above can delete PM logs
  await requireMinLevel(employee, 2);

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    return error('Not found', 404);
  }

  // Delete PM log
  await PMLogService.delete(id);

  return success({ message: 'ลบข้อมูลสำเร็จ' });
}

