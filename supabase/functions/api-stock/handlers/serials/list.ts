/**
 * List serial items with filters
 * GET /serials?location_id=...&status=...&search=...
 */

import { successWithPagination, calculatePagination } from '../../../_shared/response.ts';
import type { Employee } from '../../../_shared/auth.ts';
import * as SerialService from '../../services/serialStockService.ts';

export async function listSerials(req: Request, _employee: Employee): Promise<Response> {
  const url = new URL(req.url);

  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = parseInt(url.searchParams.get('limit') || '20');
  const offset = (page - 1) * limit;

  const filters = {
    location_id: url.searchParams.get('location_id') || undefined,
    model_id: url.searchParams.get('model_id') || undefined,
    status: url.searchParams.get('status') as SerialService.SerialStatus | undefined,
    ticket_id: url.searchParams.get('ticket_id') || undefined,
    search: url.searchParams.get('search') || undefined,
    limit,
    offset,
  };

  const result = await SerialService.listSerialItems(filters);
  const pagination = calculatePagination(page, limit, result.total);

  return successWithPagination(result.data, pagination);
}
