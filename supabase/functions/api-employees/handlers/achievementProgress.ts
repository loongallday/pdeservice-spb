/**
 * Get employee's achievement progress handler
 * Returns current progress for all active achievement goals
 */

import { success } from '../../_shared/response.ts';
import { requireMinLevel } from '../../_shared/auth.ts';
import { AchievementService } from '../services/achievementService.ts';
import type { Employee } from '../../_shared/auth.ts';

export async function achievementProgress(_req: Request, employee: Employee) {
  // Any authenticated employee can view their own progress
  await requireMinLevel(employee, 0);

  // Get progress for current employee
  const progress = await AchievementService.getProgress(employee.id);

  return success(progress);
}

