/**
 * @fileoverview Update ticket handler for comprehensive ticket modifications
 * @endpoint PUT /api-tickets/:id
 * @auth Required - Level 1+ (Assigner, PM, Sales, Admin, Superadmin)
 *
 * @param {string} id - Ticket UUID (path parameter)
 *
 * @bodyParam {object} [ticket] - Core ticket updates
 * @bodyParam {string} [ticket.work_type_id] - Work type UUID
 * @bodyParam {string} [ticket.assigner_id] - Assigner employee UUID
 * @bodyParam {string} [ticket.status_id] - Status UUID
 * @bodyParam {string} [ticket.details] - Ticket description
 * @bodyParam {object} [contact] - Contact updates
 * @bodyParam {object} [appointment] - Appointment updates
 * @bodyParam {object[]} [employees] - Employee assignment updates (full replace)
 * @bodyParam {object[]} [upses] - Equipment updates (full replace)
 *
 * @returns {Ticket} Updated ticket object
 * @throws {ValidationError} 400 - Invalid UUID format
 * @throws {AuthenticationError} 401 - If not authenticated
 * @throws {ForbiddenError} 403 - Insufficient permissions (Level < 1)
 * @throws {NotFoundError} 404 - Ticket not found
 *
 * @description
 * Updates a ticket and all associated data. Only provided fields are updated.
 *
 * Update Behavior:
 * - ticket: Merges with existing data (partial update)
 * - contact: Updates existing or creates new
 * - appointment: Updates existing or creates new
 * - employees: Full replacement (removes old, adds new)
 * - upses: Full replacement (removes old, adds new)
 *
 * Audit logging is performed for all changes.
 */

import { success } from '../../_shared/response.ts';
import { requireMinLevel } from '../../_shared/auth.ts';
import { validateUUID } from '../../_shared/validation.ts';
import { TicketService } from '../services/ticketService.ts';
import type { Employee } from '../../_shared/auth.ts';
import type { MasterTicketUpdateInput } from '../services/ticketService.ts';

export async function update(req: Request, employee: Employee, id: string) {
  // Check permissions - Level 1 and above can update tickets
  await requireMinLevel(employee, 1);

  // Validate ID
  validateUUID(id, 'Ticket ID');

  // Parse request body
  const body = await req.json() as MasterTicketUpdateInput;

  // Update comprehensive ticket
  const result = await TicketService.update(id, body, employee.id);

  return success(result);
}

