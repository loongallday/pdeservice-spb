/**
 * @fileoverview Get employee's coupons handler
 * @endpoint GET /api-employees/achievements/coupons
 * @auth Required - Level 0+ (all authenticated users)
 *
 * @queryParam {string} [status] - Filter by status: "available", "redeemed", or "expired"
 *
 * @returns {EmployeeCoupon[]} Array of coupon records
 * @throws {AuthenticationError} 401 - If not authenticated
 *
 * @description
 * Returns coupons earned by the current employee from completing achievements.
 * Coupons are automatically issued when achievement goals are completed.
 *
 * Coupon statuses:
 * - available: Can be redeemed
 * - redeemed: Already used
 * - expired: Past expiration date (30 days from issuance)
 *
 * Note: Expired coupons are automatically updated when fetched.
 * If a coupon's expires_at has passed and status is "available",
 * it will be updated to "expired" before returning.
 *
 * @example
 * GET /api-employees/achievements/coupons
 * GET /api-employees/achievements/coupons?status=available
 *
 * Response:
 * {
 *   "data": [
 *     {
 *       "id": "uuid",
 *       "coupon_type": "coffee",
 *       "coupon_description": "Free coffee at cafeteria",
 *       "status": "available",
 *       "issued_at": "2026-01-15T10:00:00Z",
 *       "expires_at": "2026-02-14T10:00:00Z"
 *     }
 *   ]
 * }
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

