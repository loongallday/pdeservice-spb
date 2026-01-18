import { success, error } from '../../../_shared/response.ts';
import { handleError } from '../../../_shared/error.ts';
import { requireMinLevel } from '../../../_shared/auth.ts';
import { getLowStockItems } from '../../services/stockItemService.ts';
import type { Employee } from '../../../_shared/auth.ts';

export async function getLowStockHandler(_req: Request, employee: Employee): Promise<Response> {
  try {
    await requireMinLevel(employee, 1);

    const items = await getLowStockItems();
    return success(items);
  } catch (err) {
    const { message, statusCode } = handleError(err);
    return error(message, statusCode);
  }
}

export { getLowStockHandler as getLowStock };
