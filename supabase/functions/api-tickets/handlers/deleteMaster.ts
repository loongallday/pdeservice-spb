/**
 * Delete master ticket handler - Delete ticket and optionally related data
 */

import { success } from '../_shared/response.ts';
import { requireMinLevel } from '../_shared/auth.ts';
import { MasterTicketService } from '../services/masterTicketService.ts';
import type { Employee } from '../_shared/auth.ts';

export async function deleteMaster(req: Request, employee: Employee, ticketId: string) {
  // Check permissions - Level 2 and above can delete master tickets
  await requireMinLevel(employee, 2);

  // Parse query parameters for options
  const url = new URL(req.url);
  const deleteAppointment = url.searchParams.get('delete_appointment') === 'true';
  const deleteContact = url.searchParams.get('delete_contact') === 'true';

  // Delete master ticket
  await MasterTicketService.deleteMaster(ticketId, {
    deleteAppointment,
    deleteContact,
  });

  return success({ message: 'ลบตั๋วงานสำเร็จ' });
}

