import { success, error } from '../../../_shared/response.ts';
import { handleError, ValidationError } from '../../../_shared/error.ts';
import { searchItems } from '../../services/stockItemService.ts';
import type { Employee } from '../../../_shared/auth.ts';

export async function searchItemsHandler(req: Request, _employee: Employee): Promise<Response> {
  try {
    const url = new URL(req.url);
    const query = url.searchParams.get('q');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 50);

    if (!query || query.trim().length === 0) {
      throw new ValidationError('กรุณาระบุคำค้นหา');
    }

    const items = await searchItems(query.trim(), limit);
    return success(items);
  } catch (err) {
    const { message, statusCode } = handleError(err);
    return error(message, statusCode);
  }
}

export { searchItemsHandler as searchItems };
