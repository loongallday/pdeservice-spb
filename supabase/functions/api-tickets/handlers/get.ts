/**
 * @fileoverview Get single ticket by ID handler
 * @endpoint GET /api-tickets/:id
 * @auth Required - Level 0+ (all authenticated users)
 *
 * @param {string} id - Ticket UUID (path parameter)
 *
 * @returns {Ticket} Full ticket object with all related data
 * @throws {ValidationError} 400 - Invalid UUID format
 * @throws {AuthenticationError} 401 - If not authenticated
 * @throws {NotFoundError} 404 - Ticket not found
 *
 * @description
 * Retrieves a single ticket with all associated data including:
 * - Ticket core data (work_type, status, assigner, details)
 * - Site and company information
 * - Contact details
 * - Appointment scheduling
 * - Assigned employees/technicians
 * - Equipment (UPS) information
 *
 * Includes defensive checks to ensure the response is a single ticket
 * object and not a paginated response.
 */

import { success } from '../../_shared/response.ts';
import { requireMinLevel } from '../../_shared/auth.ts';
import { validateUUID } from '../../_shared/validation.ts';
import { TicketService } from '../services/ticketService.ts';
import type { Employee } from '../../_shared/auth.ts';

export async function get(req: Request, employee: Employee, id: string) {
  
  // Check permissions - Level 0 and above can view tickets
  await requireMinLevel(employee, 0);

  // Validate ID
  validateUUID(id, 'Ticket ID');

  // Get ticket from service
  const ticket = await TicketService.getById(id);
  
  // Defensive check: ensure we got a single ticket, not a paginated response
  if (ticket && typeof ticket === 'object' && 'data' in ticket && Array.isArray((ticket as { data: unknown[] }).data) && 'pagination' in ticket) {
    console.error('Get handler: TicketService.getById returned paginated response instead of single ticket', { ticket, id });
    throw new Error('Internal error: received paginated response instead of single ticket');
  }
  
  // Defensive check: ensure ticket has an id
  if (!ticket || typeof ticket !== 'object' || !('id' in ticket) || !ticket.id) {
    console.error('Get handler: TicketService.getById returned invalid ticket', { ticket, id });
    throw new Error('Internal error: ticket missing id');
  }
  

  return success(ticket);
}

