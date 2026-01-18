/**
 * Transfer serial item to another location
 * POST /serials/:id/transfer
 */

import { success } from '../../../_shared/response.ts';
import { requireMinLevel } from '../../../_shared/auth.ts';
import { validateUUID } from '../../../_shared/validation.ts';
import { ValidationError } from '../../../_shared/error.ts';
import type { Employee } from '../../../_shared/auth.ts';
import * as SerialService from '../../services/serialStockService.ts';

interface TransferInput {
  to_location_id: string;
  notes?: string;
}

export async function transferSerial(req: Request, employee: Employee, id: string): Promise<Response> {
  await requireMinLevel(employee, 1);
  validateUUID(id, 'Serial item ID');

  const body = await req.json() as TransferInput;

  if (!body.to_location_id) {
    throw new ValidationError('กรุณาระบุตำแหน่งปลายทาง');
  }

  const item = await SerialService.transferSerialItem({
    serial_item_id: id,
    to_location_id: body.to_location_id,
    performed_by: employee.id,
    notes: body.notes,
  });

  return success(item);
}
