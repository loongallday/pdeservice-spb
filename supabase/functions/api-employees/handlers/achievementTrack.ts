/**
 * Track achievement action handler
 * Called when employee performs an action that should be tracked
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

