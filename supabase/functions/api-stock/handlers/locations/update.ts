import { success, error } from '../../../_shared/response.ts';
import { handleError } from '../../../_shared/error.ts';
import { requireMinLevel } from '../../../_shared/auth.ts';
import { updateLocation } from '../../services/stockLocationService.ts';
import type { Employee } from '../../../_shared/auth.ts';
import type { UpdateLocationInput } from '../../types.ts';

export async function updateLocationHandler(req: Request, employee: Employee, id: string): Promise<Response> {
  try {
    await requireMinLevel(employee, 2);

    // Check content-type and body
    const contentType = req.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      return error('ต้องระบุ Content-Type: application/json', 400);
    }

    // Clone request and get text first to check if body exists
    const bodyText = await req.text();
    if (!bodyText || bodyText.trim() === '') {
      return error('ต้องระบุข้อมูลที่ต้องการอัปเดต', 400);
    }

    let body: UpdateLocationInput;
    try {
      body = JSON.parse(bodyText) as UpdateLocationInput;
    } catch {
      return error('รูปแบบ JSON ไม่ถูกต้อง', 400);
    }

    const location = await updateLocation(id, body);
    return success(location);
  } catch (err) {
    const { message, statusCode } = handleError(err);
    return error(message, statusCode);
  }
}

export { updateLocationHandler as updateLocation };
