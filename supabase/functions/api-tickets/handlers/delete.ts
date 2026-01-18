/**
 * @fileoverview Delete ticket handler with configurable cleanup options
 * @endpoint DELETE /api-tickets/:id
 * @auth Required - Level 1+ (Assigner, PM, Sales, Admin, Superadmin)
 *
 * @param {string} id - Ticket UUID (path parameter)
 *
 * @queryParam {boolean} [delete_appointment=false] - Also delete associated appointment
 * @queryParam {boolean} [delete_contact=false] - Also delete associated contact
 *
 * @returns {object} { message: "ลบตั๋วงานสำเร็จ" }
 * @throws {ValidationError} 400 - Invalid UUID format
 * @throws {AuthenticationError} 401 - If not authenticated
 * @throws {ForbiddenError} 403 - Insufficient permissions (Level < 1)
 * @throws {NotFoundError} 404 - Ticket not found
 *
 * @description
 * Deletes a ticket and cleans up all directly related data:
 * - Always deleted: employee assignments, watchers, attachments, comments
 * - Optional: appointment (delete_appointment=true)
 * - Optional: contact (delete_contact=true)
 *
 * Note: This is a hard delete, not a soft delete. The ticket and selected
 * related data are permanently removed from the database.
 */

import { success } from '../../_shared/response.ts';
import { requireMinLevel } from '../../_shared/auth.ts';
import { validateUUID } from '../../_shared/validation.ts';
import { TicketService } from '../services/ticketService.ts';
import type { Employee } from '../../_shared/auth.ts';

export async function deleteTicket(req: Request, employee: Employee, id: string) {
  // Check permissions - Level 1 and above can delete tickets
  await requireMinLevel(employee, 1);

  // Validate ID
  validateUUID(id, 'Ticket ID');

  // Parse query parameters for options
  const url = new URL(req.url);
  const deleteAppointment = url.searchParams.get('delete_appointment') === 'true';
  const deleteContact = url.searchParams.get('delete_contact') === 'true';

  // Delete comprehensive ticket (includes cleanup of all related data)
  await TicketService.deleteTicket(id, employee.id, {
    deleteAppointment,
    deleteContact,
  });

  return success({ message: 'ลบตั๋วงานสำเร็จ' });
}

