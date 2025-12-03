/**
 * Create ticket handler - Comprehensive ticket creation with all related data
 */

import { success } from '../_shared/response.ts';
import { requireMinLevel } from '../_shared/auth.ts';
import { ValidationError } from '../_shared/error.ts';
import { TicketService } from '../services/ticketService.ts';
import type { Employee } from '../_shared/auth.ts';
import type { MasterTicketCreateInput } from '../services/ticketService.ts';

export async function create(req: Request, employee: Employee) {
  // Check permissions - Level 1 and above can create tickets
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

  // Create comprehensive ticket
  const result = await TicketService.create(body, employee.id);

  return success(result, 201);
}

