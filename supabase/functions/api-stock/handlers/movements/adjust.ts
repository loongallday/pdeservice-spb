import { success, error } from '../../../_shared/response.ts';
import { handleError, ValidationError } from '../../../_shared/error.ts';
import { requireMinLevel } from '../../../_shared/auth.ts';
import { adjustStock } from '../../services/stockMovementService.ts';
import type { Employee } from '../../../_shared/auth.ts';
import type { AdjustStockInput } from '../../types.ts';

export async function adjustStockHandler(req: Request, employee: Employee, stockItemId: string): Promise<Response> {
  try {
    await requireMinLevel(employee, 2);

    const body = await req.json() as AdjustStockInput;

    if (body.adjustment === undefined || body.adjustment === 0) {
      throw new ValidationError('กรุณาระบุจำนวนที่ต้องการปรับปรุง');
    }
    if (!body.reason || body.reason.trim().length === 0) {
      throw new ValidationError('กรุณาระบุเหตุผลในการปรับปรุง');
    }

    const result = await adjustStock(stockItemId, body, employee.id);
    return success(result);
  } catch (err) {
    const { message, statusCode } = handleError(err);
    return error(message, statusCode);
  }
}

export { adjustStockHandler as adjustStock };
