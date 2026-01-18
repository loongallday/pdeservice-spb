import { success, error } from '../../../_shared/response.ts';
import { handleError } from '../../../_shared/error.ts';
import { getItemsByLocation } from '../../services/stockItemService.ts';
import type { Employee } from '../../../_shared/auth.ts';

export async function getItemsByLocationHandler(_req: Request, _employee: Employee, locationId: string): Promise<Response> {
  try {
    const items = await getItemsByLocation(locationId);
    return success(items);
  } catch (err) {
    const { message, statusCode } = handleError(err);
    return error(message, statusCode);
  }
}

export { getItemsByLocationHandler as getItemsByLocation };
