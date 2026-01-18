import { success, error } from '../../../_shared/response.ts';
import { handleError, ValidationError } from '../../../_shared/error.ts';
import { requireMinLevel } from '../../../_shared/auth.ts';
import { createLocation } from '../../services/stockLocationService.ts';
import type { Employee } from '../../../_shared/auth.ts';
import type { CreateLocationInput } from '../../types.ts';

export async function createLocationHandler(req: Request, employee: Employee): Promise<Response> {
  try {
    await requireMinLevel(employee, 2);

    const body = await req.json() as CreateLocationInput;

    if (!body.name || body.name.trim().length === 0) {
      throw new ValidationError('กรุณาระบุชื่อตำแหน่ง');
    }
    if (!body.code || body.code.trim().length === 0) {
      throw new ValidationError('กรุณาระบุรหัสตำแหน่ง');
    }
    if (!body.location_type_id) {
      throw new ValidationError('กรุณาระบุประเภทตำแหน่ง');
    }

    const location = await createLocation(body);
    return success(location, 201);
  } catch (err) {
    const { message, statusCode } = handleError(err);
    return error(message, statusCode);
  }
}

export { createLocationHandler as createLocation };
