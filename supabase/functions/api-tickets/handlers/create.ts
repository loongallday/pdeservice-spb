/**
 * Create ticket handler
 */

import { success } from '../_shared/response.ts';
import { requireLevelGreaterThanZero } from '../_shared/auth.ts';
import { parseRequestBody, validateRequired } from '../_shared/validation.ts';
import { TicketService } from '../services/ticketService.ts';
import { HTTP_STATUS } from '../_shared/constants.ts';
import type { Employee } from '../_shared/auth.ts';

export async function create(req: Request, employee: Employee) {
  // Check permissions - Level > 0 can create tickets
  await requireLevelGreaterThanZero(employee);

  // Parse request body
  const body = await parseRequestBody<{
    ticketData: Record<string, unknown>;
    employeeIds: string[];
    appointmentData?: Record<string, unknown> | null;
  }>(req);

  // Validate required fields
  validateRequired(body.ticketData, 'ข้อมูลตั๋วงาน');
  validateRequired(body.ticketData.site_id, 'สถานที่');
  validateRequired(body.ticketData.work_type_id, 'ประเภทงาน');
  validateRequired(body.ticketData.status_id, 'สถานะ');
  validateRequired(body.ticketData.assigner_id, 'ผู้มอบหมายงาน');

  // Create ticket (appointment will be created inside if provided)
  const ticket = await TicketService.create(
    body.ticketData, 
    body.employeeIds || [],
    body.appointmentData || null
  );

  return success(ticket, HTTP_STATUS.CREATED);
}

