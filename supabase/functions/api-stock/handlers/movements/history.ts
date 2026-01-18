import { successWithPagination, calculatePagination, error } from '../../../_shared/response.ts';
import { handleError } from '../../../_shared/error.ts';
import { parsePaginationParams } from '../../../_shared/validation.ts';
import { getMovementHistory } from '../../services/stockMovementService.ts';
import type { Employee } from '../../../_shared/auth.ts';

export async function getMovementHistoryHandler(req: Request, _employee: Employee, stockItemId: string): Promise<Response> {
  try {
    const url = new URL(req.url);
    const { page, limit } = parsePaginationParams(url);

    const { movements, total } = await getMovementHistory(stockItemId, { page, limit });
    const pagination = calculatePagination(page, limit, total);
    return successWithPagination(movements, pagination);
  } catch (err) {
    const { message, statusCode } = handleError(err);
    return error(message, statusCode);
  }
}

export { getMovementHistoryHandler as getMovementHistory };
