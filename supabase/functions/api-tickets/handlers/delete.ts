/**
 * Delete ticket handler - Comprehensive ticket deletion with cleanup of related data
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

