/**
 * Get Work Estimate Handlers
 */

import { success, error } from '../../_shared/response.ts';
import { NotFoundError } from '../../_shared/error.ts';
import { getById, getByTicketId } from '../services/workEstimateService.ts';

interface Employee {
  id: string;
}

/**
 * GET /:id - Get work estimate by ID
 */
export async function handleGetById(req: Request, employee: Employee, id: string): Promise<Response> {
  const data = await getById(id);
  return success(data);
}

/**
 * GET /ticket/:ticketId - Get work estimate by ticket ID
 */
export async function handleGetByTicket(req: Request, employee: Employee, ticketId: string): Promise<Response> {
  const data = await getByTicketId(ticketId);

  if (!data) {
    throw new NotFoundError('ไม่พบข้อมูลเวลาทำงานสำหรับ ticket นี้');
  }

  return success(data);
}
