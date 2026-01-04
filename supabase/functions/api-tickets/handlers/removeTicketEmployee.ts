/**
 * Remove ticket-employee assignment handler
 */

import { success } from '../../_shared/response.ts';
import { requireMinLevel } from '../../_shared/auth.ts';
import { ValidationError } from '../../_shared/error.ts';
import { TicketService } from '../services/ticketService.ts';
import type { Employee } from '../../_shared/auth.ts';

export async function removeTicketEmployee(req: Request, employee: Employee) {
  // Check permissions - Level 2 and above can remove ticket-employee assignments
  await requireMinLevel(employee, 2);

  // Parse request body
  const body = await req.json();

  // Validate required fields
  if (!body.ticket_id) {
    throw new ValidationError('กรุณาระบุ ticket_id');
  }

  if (!body.employee_id) {
    throw new ValidationError('กรุณาระบุ employee_id');
  }

  if (!body.date) {
    throw new ValidationError('กรุณาระบุ date');
  }

  // Remove ticket-employee assignment
  await TicketService.removeTicketEmployee(
    body.ticket_id,
    body.employee_id,
    body.date,
    employee.id
  );

  return success({ message: 'ลบการมอบหมายพนักงานสำเร็จ' });
}

