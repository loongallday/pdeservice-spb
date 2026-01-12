/**
 * Replacement chain handler - Get the full replacement graph for a merchandise
 */

import { success } from '../../_shared/response.ts';
import { requireMinLevel } from '../../_shared/auth.ts';
import { validateUUID } from '../../_shared/validation.ts';
import { MerchandiseService } from '../services/merchandiseService.ts';
import type { Employee } from '../../_shared/auth.ts';

/**
 * GET /merchandise/:merchandiseId/replacement-chain
 * Get the full replacement chain for a merchandise
 * Traverses both directions: predecessors and successors
 */
export async function getReplacementChain(
  _req: Request,
  employee: Employee,
  merchandiseId: string
): Promise<Response> {
  await requireMinLevel(employee, 0);
  validateUUID(merchandiseId, 'Merchandise ID');

  const result = await MerchandiseService.getReplacementChain(merchandiseId);

  return success(result);
}
