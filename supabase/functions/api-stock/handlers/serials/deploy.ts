/**
 * Deploy serial item to ticket/site
 * POST /serials/:id/deploy
 */

import { success } from '../../../_shared/response.ts';
import { requireMinLevel } from '../../../_shared/auth.ts';
import { validateUUID } from '../../../_shared/validation.ts';
import { ValidationError } from '../../../_shared/error.ts';
import type { Employee } from '../../../_shared/auth.ts';
import * as SerialService from '../../services/serialStockService.ts';

interface DeployInput {
  ticket_id: string;
  site_id?: string;
  notes?: string;
}

export async function deploySerial(req: Request, employee: Employee, id: string): Promise<Response> {
  await requireMinLevel(employee, 1);
  validateUUID(id, 'Serial item ID');

  const body = await req.json() as DeployInput;

  if (!body.ticket_id) {
    throw new ValidationError('กรุณาระบุตั๋วงาน');
  }

  const item = await SerialService.deploySerialItem({
    serial_item_id: id,
    ticket_id: body.ticket_id,
    site_id: body.site_id,
    performed_by: employee.id,
    notes: body.notes,
  });

  return success(item);
}
