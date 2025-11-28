/**
 * Handler: Create new prize
 * POST /api-prizes
 * Body: { name: string, image_url?: string }
 */

import { authenticate, requireMinLevel } from '../_shared/auth.ts';
import { parseRequestBody, validateRequired } from '../_shared/validation.ts';
import { success } from '../_shared/response.ts';
import { create } from '../services/prizeService.ts';

interface CreatePrizeRequest {
  name: string;
  image_url?: string;
}

export async function handleCreate(req: Request): Promise<Response> {
  // Authenticate user (level 2+ required for creating prizes)
  const { employee } = await authenticate(req);
  await requireMinLevel(employee, 2);

  // Parse and validate request body
  const body = await parseRequestBody<CreatePrizeRequest>(req);
  validateRequired(body.name, 'ชื่อรางวัล');

  // Create prize
  const prize = await create(body);

  return success(prize, 201);
}
