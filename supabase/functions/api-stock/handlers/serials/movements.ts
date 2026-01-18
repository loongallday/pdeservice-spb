/**
 * Get movement history for a serial item
 * GET /serials/:id/movements
 */

import { success } from '../../../_shared/response.ts';
import { validateUUID } from '../../../_shared/validation.ts';
import type { Employee } from '../../../_shared/auth.ts';
import * as SerialService from '../../services/serialStockService.ts';

export async function getSerialMovements(req: Request, _employee: Employee, id: string): Promise<Response> {
  validateUUID(id, 'Serial item ID');

  const url = new URL(req.url);
  const limit = parseInt(url.searchParams.get('limit') || '50');

  const movements = await SerialService.getSerialMovements(id, limit);
  return success(movements);
}
