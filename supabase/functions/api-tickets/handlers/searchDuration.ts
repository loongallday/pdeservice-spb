/**
 * @fileoverview Search tickets by date range handler
 * @endpoint GET /api-tickets/search-duration
 * @auth Required - Level 0+ (all authenticated users)
 *
 * @queryParam {string} startDate - Required: Start date (YYYY-MM-DD)
 * @queryParam {string} endDate - Required: End date (YYYY-MM-DD)
 * @queryParam {string} [date_type=create] - Date field: create|update|appointed
 * @queryParam {number} [page=1] - Page number
 * @queryParam {number} [limit=50] - Items per page
 * @queryParam {string} [include=full] - Data mode: minimal|full
 * @queryParam {string} [sort] - Sort field
 * @queryParam {string} [order=desc] - Sort order: asc|desc
 *
 * @returns {PaginatedResponse<Ticket[]>} Tickets within date range
 * @throws {ValidationError} 400 - Missing startDate or endDate
 * @throws {ValidationError} 400 - Invalid date_type value
 * @throws {AuthenticationError} 401 - If not authenticated
 *
 * @description
 * Searches tickets within a specific date range. The date field used for
 * filtering is configurable via date_type parameter:
 *
 * - create: Filter by ticket creation date (created_at)
 * - update: Filter by last update date (updated_at)
 * - appointed: Filter by appointment date (default)
 *
 * Returns display-ready data with pre-resolved location names, employee
 * details, and pre-formatted appointment strings.
 */

import { successWithPagination } from '../../_shared/response.ts';
import { requireMinLevel } from '../../_shared/auth.ts';
import { parsePaginationParams } from '../../_shared/validation.ts';
import { ValidationError } from '../../_shared/error.ts';
import { TicketService } from '../services/ticketService.ts';
import type { Employee } from '../../_shared/auth.ts';
import type { IncludeMode } from '../services/ticketDisplayTypes.ts';

export async function searchDuration(req: Request, employee: Employee) {
  // Check permissions - Level 0 and above can search tickets
  await requireMinLevel(employee, 0);

  // Parse query parameters
  const url = new URL(req.url);
  const { page, limit } = parsePaginationParams(url);

  // Parse include parameter (minimal or full)
  const includeParam = url.searchParams.get('include');
  const include: IncludeMode = (includeParam === 'minimal') ? 'minimal' : 'full';

  // Get required parameters
  const startDate = url.searchParams.get('startDate');
  const endDate = url.searchParams.get('endDate');
  const dateType = url.searchParams.get('date_type') || 'create';

  // Parse sorting parameters
  const sort = url.searchParams.get('sort') || undefined;
  const orderParam = url.searchParams.get('order');
  const order = (orderParam === 'asc' || orderParam === 'desc') ? orderParam : undefined;

  // Validate required parameters
  if (!startDate) {
    throw new ValidationError('กรุณาระบุ startDate');
  }
  if (!endDate) {
    throw new ValidationError('กรุณาระบุ endDate');
  }

  // Validate date_type
  if (!['create', 'update', 'appointed'].includes(dateType)) {
    throw new ValidationError('date_type ต้องเป็น create, update, หรือ appointed');
  }

  // Search tickets by duration
  const result = await TicketService.searchByDuration({
    page,
    limit,
    startDate,
    endDate,
    dateType: dateType as 'create' | 'update' | 'appointed',
    sort,
    order: order as 'asc' | 'desc' | undefined,
    include,
  });

  return successWithPagination(result.data, result.pagination);
}
