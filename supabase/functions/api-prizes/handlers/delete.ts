/**
 * Handler: Delete prize
 * DELETE /api-prizes/:id
 */

import { authenticate, requireMinLevel } from '../_shared/auth.ts';
import { validateUUID } from '../_shared/validation.ts';
import { success } from '../_shared/response.ts';
import { deletePrize } from '../services/prizeService.ts';

export async function handleDelete(req: Request, id: string): Promise<Response> {
  // Authenticate user (level 2+ required)
  const { employee } = await authenticate(req);
  await requireMinLevel(employee, 2);

  // Validate ID
  validateUUID(id, 'Prize ID');

  // Delete prize
  await deletePrize(id);

  return success({ message: 'ลบรางวัลสำเร็จ' });
}
