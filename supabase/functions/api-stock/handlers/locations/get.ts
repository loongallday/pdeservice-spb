import { success, error } from '../../../_shared/response.ts';
import { handleError } from '../../../_shared/error.ts';
import { getLocationById } from '../../services/stockLocationService.ts';
import type { Employee } from '../../../_shared/auth.ts';

export async function getLocationHandler(_req: Request, _employee: Employee, id: string): Promise<Response> {
  try {
    const location = await getLocationById(id);
    return success(location);
  } catch (err) {
    const { message, statusCode } = handleError(err);
    return error(message, statusCode);
  }
}

export { getLocationHandler as getLocation };
