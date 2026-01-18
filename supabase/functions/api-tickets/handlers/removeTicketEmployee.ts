/**
 * @fileoverview Remove technician assignment from ticket handler
 * @endpoint DELETE /api-tickets/employees
 * @auth Required - Level 2+ (Admin, Superadmin)
 *
 * @bodyParam {string} ticket_id - Required: Ticket UUID
 * @bodyParam {string} employee_id - Required: Employee UUID to remove
 * @bodyParam {string} date - Required: Assignment date (YYYY-MM-DD)
 *
 * @returns {object} { message: "ลบการมอบหมายพนักงานสำเร็จ" }
 * @throws {ValidationError} 400 - Missing required fields
 * @throws {AuthenticationError} 401 - If not authenticated
 * @throws {ForbiddenError} 403 - Insufficient permissions (Level < 2)
 *
 * @description
 * Removes a specific technician assignment from a ticket for a given date.
 * This is an admin-only operation used to correct scheduling mistakes
 * or reassign work.
 *
 * Note: This endpoint uses DELETE method but accepts a body with the
 * assignment details to identify the specific record to remove.
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

