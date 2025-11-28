/**
 * Handler: Get prize by ID
 * GET /api-prizes/:id
 */

import { authenticate, requireMinLevel } from '../_shared/auth.ts';
import { validateUUID } from '../_shared/validation.ts';
import { success } from '../_shared/response.ts';
import { getById } from '../services/prizeService.ts';

export async function handleGet(req: Request, id: string): Promise<Response> {
  // Authenticate user (level 0+)
  const { employee } = await authenticate(req);
  await requireMinLevel(employee, 0);

  // Validate ID
  validateUUID(id, 'Prize ID');

  // Get prize
  const prize = await getById(id);

  return success(prize);
}
