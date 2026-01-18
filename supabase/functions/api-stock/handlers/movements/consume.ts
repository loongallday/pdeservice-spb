import { success, error } from '../../../_shared/response.ts';
import { handleError, ValidationError } from '../../../_shared/error.ts';
import { requireMinLevel } from '../../../_shared/auth.ts';
import { consumeStockForTicket } from '../../services/stockMovementService.ts';
import type { Employee } from '../../../_shared/auth.ts';
import type { ConsumeStockInput } from '../../types.ts';

export async function consumeStockHandler(req: Request, employee: Employee, ticketId: string): Promise<Response> {
  try {
    await requireMinLevel(employee, 1);

    const body = await req.json() as ConsumeStockInput;

    if (!body.items || body.items.length === 0) {
      throw new ValidationError('กรุณาระบุรายการสต็อกที่ต้องการใช้');
    }

    for (const item of body.items) {
      if (!item.stock_item_id) {
        throw new ValidationError('กรุณาระบุรหัสสต็อก');
      }
      if (!item.quantity || item.quantity <= 0) {
        throw new ValidationError('จำนวนต้องมากกว่า 0');
      }
    }

    const result = await consumeStockForTicket(ticketId, body, employee.id);
    return success(result);
  } catch (err) {
    const { message, statusCode } = handleError(err);
    return error(message, statusCode);
  }
}

export { consumeStockHandler as consumeStock };
