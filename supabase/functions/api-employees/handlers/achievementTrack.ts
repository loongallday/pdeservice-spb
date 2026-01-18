/**
 * @fileoverview Track achievement action handler
 * @endpoint POST /api-employees/achievements/track
 * @auth Required - Level 0+ (all authenticated users)
 *
 * @bodyParam {string} action_type - Required: Type of action (currently only "ticket_create")
 *
 * @returns {TrackActionResponse} Updated progress with goals_updated, coupons_earned, and progress array
 * @throws {AuthenticationError} 401 - If not authenticated
 * @throws {ValidationError} 400 - If action_type is missing or invalid
 *
 * @description
 * Called when an employee performs a trackable action (e.g., creates a ticket).
 * Updates achievement progress for all active goals matching the action type.
 *
 * Currently supported action types:
 * - ticket_create: Tracked when creating tickets
 *
 * For each matching goal:
 * - Counts actual tickets created in the current period
 * - Updates or creates achievement progress record
 * - Issues coupon if goal is completed
 *
 * Period types:
 * - daily: Resets every day
 * - weekly: Monday to Sunday
 * - monthly: First to last day of month
 *
 * @example
 * POST /api-employees/achievements/track
 * { "action_type": "ticket_create" }
 *
 * Response:
 * {
 *   "data": {
 *     "goals_updated": 2,
 *     "coupons_earned": 1,
 *     "progress": [...]
 *   }
 * }
 */

import { success } from '../../_shared/response.ts';
import { requireMinLevel } from '../../_shared/auth.ts';
import { ValidationError } from '../../_shared/error.ts';
import { AchievementService } from '../services/achievementService.ts';
import type { Employee } from '../../_shared/auth.ts';

export async function achievementTrack(req: Request, employee: Employee) {
  // Any authenticated employee can track their own actions
  await requireMinLevel(employee, 0);

  // Parse request body
  const body = await req.json();

  // Validate action_type
  const actionType = body.action_type;
  if (!actionType || typeof actionType !== 'string') {
    throw new ValidationError('กรุณาระบุ action_type');
  }

  // Currently only support ticket_create
  if (actionType !== 'ticket_create') {
    throw new ValidationError('action_type ไม่ถูกต้อง (รองรับเฉพาะ ticket_create)');
  }

  // Track action for the current employee
  const result = await AchievementService.trackAction(employee.id, actionType);

  return success(result);
}

