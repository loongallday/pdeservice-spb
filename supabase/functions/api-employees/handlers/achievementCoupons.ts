/**
 * Get employee's coupons handler
 * Returns coupons earned from achievements
 */

import { success } from '../../_shared/response.ts';
import { requireMinLevel } from '../../_shared/auth.ts';
import { AchievementService } from '../services/achievementService.ts';
import type { Employee } from '../../_shared/auth.ts';

export async function achievementCoupons(req: Request, employee: Employee) {
  // Any authenticated employee can view their own coupons
  await requireMinLevel(employee, 0);

  // Get optional status filter from query params
  const url = new URL(req.url);
  const statusParam = url.searchParams.get('status');

  // Validate status if provided
  let status: 'available' | 'redeemed' | 'expired' | undefined;
  if (statusParam) {
    if (!['available', 'redeemed', 'expired'].includes(statusParam)) {
      // Invalid status, ignore filter
      status = undefined;
    } else {
      status = statusParam as 'available' | 'redeemed' | 'expired';
    }
  }

  // Get coupons for current employee
  const coupons = await AchievementService.getCoupons(employee.id, status);

  return success(coupons);
}

