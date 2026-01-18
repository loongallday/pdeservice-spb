/**
 * Receive new serialized items into inventory
 * POST /serials/receive
 */

import { success } from '../../../_shared/response.ts';
import { requireMinLevel } from '../../../_shared/auth.ts';
import { ValidationError } from '../../../_shared/error.ts';
import type { Employee } from '../../../_shared/auth.ts';
import * as SerialService from '../../services/serialStockService.ts';

interface ReceiveInput {
  location_id: string;
  items: Array<{
    model_id: string;
    serial_no: string;
    notes?: string;
  }>;
}

export async function receiveSerials(req: Request, employee: Employee): Promise<Response> {
  await requireMinLevel(employee, 1);

  const body = await req.json() as ReceiveInput;

  if (!body.location_id) {
    throw new ValidationError('กรุณาระบุตำแหน่งรับสินค้า');
  }

  if (!body.items || body.items.length === 0) {
    throw new ValidationError('กรุณาระบุรายการสินค้า');
  }

  // Validate items
  for (const item of body.items) {
    if (!item.model_id) {
      throw new ValidationError('กรุณาระบุประเภทสินค้า');
    }
    if (!item.serial_no || item.serial_no.trim().length === 0) {
      throw new ValidationError('กรุณาระบุหมายเลขซีเรียล');
    }
  }

  const result = await SerialService.receiveSerialItems({
    location_id: body.location_id,
    items: body.items.map(i => ({
      ...i,
      serial_no: i.serial_no.trim().toUpperCase(),
    })),
    received_by: employee.id,
  });

  return success(result);
}
