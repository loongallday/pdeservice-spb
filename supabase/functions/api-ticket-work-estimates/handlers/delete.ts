/**
 * Delete Work Estimate Handler
 */

import { success } from '../../_shared/response.ts';
import { deleteById, deleteByTicketId } from '../services/workEstimateService.ts';

interface Employee {
  id: string;
}

/**
 * DELETE /:id - Delete work estimate by ID
 */
export async function handleDelete(req: Request, employee: Employee, id: string): Promise<Response> {
  await deleteById(id);
  return success({ message: 'ลบข้อมูลสำเร็จ' });
}

/**
 * DELETE /ticket/:ticketId - Delete work estimate by ticket ID
 */
export async function handleDeleteByTicket(req: Request, employee: Employee, ticketId: string): Promise<Response> {
  await deleteByTicketId(ticketId);
  return success({ message: 'ลบข้อมูลสำเร็จ' });
}
