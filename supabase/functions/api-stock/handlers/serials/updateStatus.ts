/**
 * Update serial item status
 * POST /serials/:id/status
 * POST /serials/:id/defective
 */

import { success } from '../../../_shared/response.ts';
import { requireMinLevel } from '../../../_shared/auth.ts';
import { validateUUID } from '../../../_shared/validation.ts';
import { ValidationError } from '../../../_shared/error.ts';
import type { Employee } from '../../../_shared/auth.ts';
import * as SerialService from '../../services/serialStockService.ts';

interface UpdateStatusInput {
  status: SerialService.SerialStatus;
  location_id?: string;
  notes?: string;
}

export async function updateSerialStatus(req: Request, employee: Employee, id: string): Promise<Response> {
  await requireMinLevel(employee, 2);
  validateUUID(id, 'Serial item ID');

  const body = await req.json() as UpdateStatusInput;

  if (!body.status) {
    throw new ValidationError('กรุณาระบุสถานะ');
  }

  const validStatuses: SerialService.SerialStatus[] = ['in_stock', 'reserved', 'deployed', 'defective', 'returned', 'scrapped'];
  if (!validStatuses.includes(body.status)) {
    throw new ValidationError(`สถานะไม่ถูกต้อง: ${body.status}`);
  }

  const item = await SerialService.updateSerialStatus({
    serial_item_id: id,
    status: body.status,
    location_id: body.location_id,
    performed_by: employee.id,
    notes: body.notes,
  });

  return success(item);
}

export async function markSerialDefective(req: Request, employee: Employee, id: string): Promise<Response> {
  await requireMinLevel(employee, 1);
  validateUUID(id, 'Serial item ID');

  const body = await req.json().catch(() => ({})) as { notes?: string };

  const item = await SerialService.markDefective({
    serial_item_id: id,
    performed_by: employee.id,
    notes: body.notes,
  });

  return success(item);
}
