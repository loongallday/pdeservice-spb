/**
 * Create master ticket handler - Create ticket with all related data
 */

import { success } from '../_shared/response.ts';
import { requireMinLevel } from '../_shared/auth.ts';
import { ValidationError } from '../_shared/error.ts';
import { MasterTicketService } from '../services/masterTicketService.ts';
import type { Employee } from '../_shared/auth.ts';
import type { MasterTicketCreateInput } from '../services/masterTicketService.ts';

export async function createMaster(req: Request, employee: Employee) {
  // Check permissions - Level 1 and above can create master tickets
  await requireMinLevel(employee, 1);

  // Parse request body
  const body = await req.json() as MasterTicketCreateInput;

  // Validate required fields
  if (!body.ticket) {
    throw new ValidationError('กรุณาระบุข้อมูลตั๋วงาน');
  }

  if (!body.ticket.work_type_id) {
    throw new ValidationError('กรุณาระบุประเภทงาน');
  }

  if (!body.ticket.assigner_id) {
    throw new ValidationError('กรุณาระบุผู้มอบหมายงาน');
  }

  if (!body.ticket.status_id) {
    throw new ValidationError('กรุณาระบุสถานะตั๋วงาน');
  }

  // Create master ticket
  const result = await MasterTicketService.createMaster(body);

  return success(result, 201);
}

