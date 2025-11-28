/**
 * Handler: Update prize
 * PUT /api-prizes/:id
 * Body: { name?: string, image_url?: string }
 */

import { authenticate, requireMinLevel } from '../_shared/auth.ts';
import { parseRequestBody, validateUUID } from '../_shared/validation.ts';
import { success } from '../_shared/response.ts';
import { update } from '../services/prizeService.ts';

interface UpdatePrizeRequest {
  name?: string;
  image_url?: string;
}

export async function handleUpdate(req: Request, id: string): Promise<Response> {
  // Authenticate user (level 2+ required)
  const { employee } = await authenticate(req);
  await requireMinLevel(employee, 2);

  // Validate ID
  validateUUID(id, 'Prize ID');

  // Parse request body
  const body = await parseRequestBody<UpdatePrizeRequest>(req);

  // Update prize
  const prize = await update(id, body);

  return success(prize);
}
