import { success, error } from '../../../_shared/response.ts';
import { handleError, ValidationError } from '../../../_shared/error.ts';
import { requireMinLevel } from '../../../_shared/auth.ts';
import { transferStock } from '../../services/stockMovementService.ts';
import type { Employee } from '../../../_shared/auth.ts';
import type { TransferStockInput } from '../../types.ts';

export async function transferStockHandler(req: Request, employee: Employee): Promise<Response> {
  try {
    await requireMinLevel(employee, 1);

    const body = await req.json() as TransferStockInput;

    if (!body.from_location_id) {
      throw new ValidationError('กรุณาระบุตำแหน่งต้นทาง');
    }
    if (!body.to_location_id) {
      throw new ValidationError('กรุณาระบุตำแหน่งปลายทาง');
    }
    if (!body.model_id) {
      throw new ValidationError('กรุณาระบุรายการสินค้า');
    }
    if (!body.quantity || body.quantity <= 0) {
      throw new ValidationError('จำนวนต้องมากกว่า 0');
    }

    const result = await transferStock(body, employee.id);
    return success(result);
  } catch (err) {
    const { message, statusCode } = handleError(err);
    return error(message, statusCode);
  }
}

export { transferStockHandler as transferStock };
