import { success, error } from '../../../_shared/response.ts';
import { handleError, ValidationError } from '../../../_shared/error.ts';
import { requireMinLevel } from '../../../_shared/auth.ts';
import { receiveStock } from '../../services/stockMovementService.ts';
import type { Employee } from '../../../_shared/auth.ts';
import type { ReceiveStockInput } from '../../types.ts';

export async function receiveStockHandler(req: Request, employee: Employee): Promise<Response> {
  try {
    await requireMinLevel(employee, 1);

    const body = await req.json() as ReceiveStockInput;

    if (!body.location_id) {
      throw new ValidationError('กรุณาระบุตำแหน่งจัดเก็บ');
    }
    if (!body.model_id) {
      throw new ValidationError('กรุณาระบุรายการสินค้า');
    }
    if (!body.quantity || body.quantity <= 0) {
      throw new ValidationError('จำนวนต้องมากกว่า 0');
    }

    const result = await receiveStock(body, employee.id);
    return success(result, 201);
  } catch (err) {
    const { message, statusCode } = handleError(err);
    return error(message, statusCode);
  }
}

export { receiveStockHandler as receiveStock };
