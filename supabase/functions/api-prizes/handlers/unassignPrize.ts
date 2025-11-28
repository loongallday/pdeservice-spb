/**
 * Handler: Unassign prize from user
 * DELETE /api-prizes/:prizeId/unassign/:userId
 */

import { authenticate, requireMinLevel } from '../_shared/auth.ts';
import { validateUUID } from '../_shared/validation.ts';
import { success } from '../_shared/response.ts';
import { unassignPrize } from '../services/prizeService.ts';

export async function handleUnassignPrize(
  req: Request,
  prizeId: string,
  userId: string
): Promise<Response> {
  // Authenticate user (level 2+ required)
  const { employee } = await authenticate(req);
  await requireMinLevel(employee, 2);

  // Validate IDs
  validateUUID(prizeId, 'Prize ID');
  validateUUID(userId, 'User ID');

  // Unassign prize
  await unassignPrize(prizeId, userId);

  return success({ message: 'ยกเลิกการมอบรางวัลสำเร็จ' });
}
