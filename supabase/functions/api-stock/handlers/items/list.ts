import { successWithPagination, calculatePagination, error } from '../../../_shared/response.ts';
import { handleError } from '../../../_shared/error.ts';
import { parsePaginationParams } from '../../../_shared/validation.ts';
import { listItems } from '../../services/stockItemService.ts';
import type { Employee } from '../../../_shared/auth.ts';

export async function listItemsHandler(req: Request, _employee: Employee): Promise<Response> {
  try {
    const url = new URL(req.url);
    const { page, limit } = parsePaginationParams(url);
    const location_id = url.searchParams.get('location_id') || undefined;
    const model_id = url.searchParams.get('model_id') || undefined;

    const { items, total } = await listItems({
      location_id,
      model_id,
      page,
      limit,
    });

    const pagination = calculatePagination(page, limit, total);
    return successWithPagination(items, pagination);
  } catch (err) {
    const { message, statusCode } = handleError(err);
    return error(message, statusCode);
  }
}

export { listItemsHandler as listItems };
