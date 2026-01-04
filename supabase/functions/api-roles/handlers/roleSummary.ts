/**
 * Get role summary handler
 * Returns employee counts grouped by role
 */

import { success } from '../../_shared/response.ts';
import { requireMinLevel } from '../../_shared/auth.ts';
import { RoleService } from '../services/roleService.ts';
import type { Employee } from '../../_shared/auth.ts';

export async function getRoleSummary(_req: Request, employee: Employee) {
  // Check permissions - Level 0 and above can view role summary
  await requireMinLevel(employee, 0);

  // Get role summary from service
  const summary = await RoleService.getRoleSummary();

  return success(summary);
}

