import { success, error } from '../../../_shared/response.ts';
import { handleError } from '../../../_shared/error.ts';
import { requireMinLevel } from '../../../_shared/auth.ts';
import { deleteLocation } from '../../services/stockLocationService.ts';
import type { Employee } from '../../../_shared/auth.ts';

export async function deleteLocationHandler(_req: Request, employee: Employee, id: string): Promise<Response> {
  try {
    await requireMinLevel(employee, 3);

    await deleteLocation(id);
    return success({ deleted: true });
  } catch (err) {
    const { message, statusCode } = handleError(err);
    return error(message, statusCode);
  }
}

export { deleteLocationHandler as deleteLocation };
