/**
 * Carousel handlers - Get tickets for LINE carousel
 */

import { success } from '../../_shared/response.ts';
import { ValidationError } from '../../_shared/error.ts';
import { CarouselService } from '../services/carouselService.ts';

/**
 * GET /tickets/carousel?line_user_id=xxx - Get tickets for LINE carousel
 * Called by n8n (service_role auth)
 */
export async function getCarouselTickets(
  req: Request
): Promise<Response> {
  const url = new URL(req.url);
  const lineUserId = url.searchParams.get('line_user_id');
  const limitParam = url.searchParams.get('limit');

  if (!lineUserId) {
    throw new ValidationError('กรุณาระบุ line_user_id');
  }

  const limit = limitParam ? parseInt(limitParam, 10) : 10;

  const tickets = await CarouselService.getTicketsForEmployee(lineUserId, { limit });

  return success({
    tickets,
    count: tickets.length,
  });
}

/**
 * GET /tickets/by-code/:code - Get ticket by code (for verification)
 * Called by n8n (service_role auth)
 */
export async function getTicketByCode(
  _req: Request,
  code: string
): Promise<Response> {
  if (!code) {
    throw new ValidationError('กรุณาระบุรหัสตั๋ว');
  }

  const ticket = await CarouselService.getTicketByCode(code);

  if (!ticket) {
    return success({ found: false, ticket: null });
  }

  return success({ found: true, ticket });
}
