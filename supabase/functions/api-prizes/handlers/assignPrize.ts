/**
 * Handler: Assign prize to user
 * POST /api-prizes/:prizeId/assign
 * Body: { user_id: string }
 */

import { authenticate, requireMinLevel } from '../_shared/auth.ts';
import { parseRequestBody, validateUUID, validateRequired } from '../_shared/validation.ts';
import { success } from '../_shared/response.ts';
import { assignPrize } from '../services/prizeService.ts';

interface AssignPrizeRequest {
  user_id: string;
}

export async function handleAssignPrize(req: Request, prizeId: string): Promise<Response> {
  // Authenticate user (level 2+ required)
  const { employee } = await authenticate(req);
  await requireMinLevel(employee, 2);

  // Validate prize ID
  validateUUID(prizeId, 'Prize ID');

  // Parse and validate request body
  const body = await parseRequestBody<AssignPrizeRequest>(req);
  validateRequired(body.user_id, 'User ID');
  validateUUID(body.user_id, 'User ID');

  // Assign prize
  const assignment = await assignPrize(prizeId, body.user_id);

  return success(assignment, 201);
}
