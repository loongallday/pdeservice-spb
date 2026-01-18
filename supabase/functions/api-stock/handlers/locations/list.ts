import { success, error } from '../../../_shared/response.ts';
import { handleError } from '../../../_shared/error.ts';
import { listLocations } from '../../services/stockLocationService.ts';
import type { Employee } from '../../../_shared/auth.ts';

export async function listLocationsHandler(req: Request, _employee: Employee): Promise<Response> {
  try {
    const url = new URL(req.url);
    const type_id = url.searchParams.get('type_id') || undefined;
    const site_id = url.searchParams.get('site_id') || undefined;
    const employee_id = url.searchParams.get('employee_id') || undefined;
    const is_active = url.searchParams.get('is_active');

    const locations = await listLocations({
      type_id,
      site_id,
      employee_id,
      is_active: is_active === null ? undefined : is_active === 'true',
    });

    return success(locations);
  } catch (err) {
    const { message, statusCode } = handleError(err);
    return error(message, statusCode);
  }
}

export { listLocationsHandler as listLocations };
