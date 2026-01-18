/**
 * Get serial item by ID or serial number
 * GET /serials/:id
 * GET /serials/by-serial/:serialNo
 */

import { success } from '../../../_shared/response.ts';
import { validateUUID } from '../../../_shared/validation.ts';
import type { Employee } from '../../../_shared/auth.ts';
import * as SerialService from '../../services/serialStockService.ts';

export async function getSerial(_req: Request, _employee: Employee, id: string): Promise<Response> {
  validateUUID(id, 'Serial item ID');
  const item = await SerialService.getSerialItemById(id);
  return success(item);
}

export async function getSerialBySerialNo(_req: Request, _employee: Employee, serialNo: string): Promise<Response> {
  const item = await SerialService.getSerialItemBySerialNo(serialNo);
  return success(item);
}
