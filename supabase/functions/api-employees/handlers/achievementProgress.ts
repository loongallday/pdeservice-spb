/**
 * @fileoverview Get employee's achievement progress handler
 * @endpoint GET /api-employees/achievements/progress
 * @auth Required - Level 0+ (all authenticated users)
 *
 * @returns {AchievementProgressItem[]} Array of progress items for all active goals
 * @throws {AuthenticationError} 401 - If not authenticated
 *
 * @description
 * Returns the current employee's progress toward all active achievement goals.
 * Each progress item includes:
 * - Goal details (name, description, period_type, target_count, reward info)
 * - Current count (tickets created in this period)
 * - Period boundaries (start/end dates)
 * - Status (in_progress/completed)
 * - Percentage completion
 *
 * Progress is calculated in real-time:
 * - If an achievement record exists, uses stored current_count
 * - If no record, counts tickets directly from main_tickets
 *
 * @example
 * GET /api-employees/achievements/progress
 *
 * Response:
 * {
 *   "data": [
 *     {
 *       "goal": { "id": "uuid", "name": "Daily Creator", ... },
 *       "current_count": 3,
 *       "target_count": 5,
 *       "period_start": "2026-01-18",
 *       "period_end": "2026-01-18",
 *       "status": "in_progress",
 *       "percentage": 60
 *     }
 *   ]
 * }
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

