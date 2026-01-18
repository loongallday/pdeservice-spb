import { success, error } from '../../../_shared/response.ts';
import { handleError } from '../../../_shared/error.ts';
import { getItemById } from '../../services/stockItemService.ts';
import type { Employee } from '../../../_shared/auth.ts';

export async function getItemHandler(_req: Request, _employee: Employee, id: string): Promise<Response> {
  try {
    const item = await getItemById(id);
    return success(item);
  } catch (err) {
    const { message, statusCode } = handleError(err);
    return error(message, statusCode);
  }
}

export { getItemHandler as getItem };
