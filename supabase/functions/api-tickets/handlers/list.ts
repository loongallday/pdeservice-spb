/**
 * List tickets handler
 */

import { success } from '../_shared/response.ts';
import { requireMinLevel } from '../_shared/auth.ts';
import { parsePaginationParams } from '../_shared/validation.ts';
import { TicketService } from '../services/ticketService.ts';
import type { Employee } from '../_shared/auth.ts';

export async function list(req: Request, employee: Employee) {
  // Check permissions - Level 0 and above can list tickets
  await requireMinLevel(employee, 0);

  // Parse query parameters
  const url = new URL(req.url);
  const { page, limit } = parsePaginationParams(url);
  
  const status_id = url.searchParams.get('status_id') || undefined;
  const work_type_id = url.searchParams.get('work_type_id') || undefined;
  const employee_id = url.searchParams.get('employee_id') || undefined;
  const site_id = url.searchParams.get('site_id') || undefined;
  const start_date = url.searchParams.get('start_date') || undefined;
  const end_date = url.searchParams.get('end_date') || undefined;
  const exclude_backlog = url.searchParams.get('exclude_backlog') === 'true';
  const only_backlog = url.searchParams.get('only_backlog') === 'true';

  // Get tickets from service
  const result = await TicketService.getAll({
    page,
    limit,
    status_id,
    work_type_id,
    employee_id,
    site_id,
    start_date,
    end_date,
    exclude_backlog,
    only_backlog,
  });

  return success(result);
}

