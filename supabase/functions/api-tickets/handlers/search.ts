/**
 * @fileoverview Search tickets handler with comprehensive filtering
 * @endpoint GET /api-tickets/search
 * @auth Required - Level 0+ (all authenticated users)
 *
 * @queryParam {number} [page=1] - Page number
 * @queryParam {number} [limit=50] - Items per page (max 100)
 * @queryParam {string} [id] - Filter by ticket ID (exact match)
 * @queryParam {string} [details] - Text search in ticket details
 * @queryParam {string} [work_type_id] - Filter by work type UUID
 * @queryParam {string} [assigner_id] - Filter by assigner employee UUID
 * @queryParam {string} [status_id] - Filter by status UUID
 * @queryParam {string} [site_id] - Filter by site UUID
 * @queryParam {string} [contact_id] - Filter by contact UUID
 * @queryParam {string} [appointment_id] - Filter by appointment UUID
 * @queryParam {string} [department_id] - Filter by department (%-separated for multiple)
 * @queryParam {string} [employee_id] - Filter by assigned employee (%-separated for multiple)
 * @queryParam {string} [start_date] - Filter tickets from this date (YYYY-MM-DD)
 * @queryParam {string} [end_date] - Filter tickets to this date (YYYY-MM-DD)
 * @queryParam {string} [date_type=appointed] - Date field for filtering: create|update|appointed
 * @queryParam {boolean} [exclude_backlog] - Exclude backlog tickets
 * @queryParam {boolean} [appointment_is_approved] - Filter by appointment approval status
 * @queryParam {boolean} [watching] - Only return tickets user is watching
 * @queryParam {string} [include=full] - Data mode: minimal|full
 * @queryParam {string} [sort] - Sort field
 * @queryParam {string} [order=desc] - Sort order: asc|desc
 *
 * @returns {PaginatedResponse<Ticket[]>} Tickets with pagination metadata
 * @throws {AuthenticationError} 401 - If not authenticated
 *
 * @description
 * Powerful ticket search with multiple filter options and pagination.
 *
 * Include Modes:
 * - full (default): Returns complete ticket data with all relations
 * - minimal: Returns lightweight ticket data for list views
 *
 * Multi-value Filters:
 * - department_id and employee_id support %-separated lists
 * - Example: ?department_id=uuid1%uuid2 filters by multiple departments
 *
 * Watching Filter:
 * - When watching=true, only returns tickets the current user is watching
 * - Useful for "My Watched Tickets" views
 */

import { successWithPagination } from '../../_shared/response.ts';
import { requireMinLevel } from '../../_shared/auth.ts';
import { parsePaginationParams } from '../../_shared/validation.ts';
import { TicketService } from '../services/ticketService.ts';
import type { Employee } from '../../_shared/auth.ts';
import type { IncludeMode } from '../services/ticketDisplayTypes.ts';

export async function search(req: Request, employee: Employee) {
  // Check permissions - Level 0 and above can search tickets
  await requireMinLevel(employee, 0);

  // Parse query parameters
  const url = new URL(req.url);
  const { page, limit } = parsePaginationParams(url);

  // Parse watching parameter - filter to only watched tickets
  const watching = url.searchParams.get('watching') === 'true';

  // Parse include parameter (minimal or full)
  const includeParam = url.searchParams.get('include');
  const include: IncludeMode = (includeParam === 'minimal') ? 'minimal' : 'full';

  // Parse department_id - support both single value and array (percent-separated)
  const departmentIdParam = url.searchParams.get('department_id');
  let department_id: string | string[] | undefined = undefined;
  if (departmentIdParam) {
    const departmentIds = departmentIdParam.split('%').map(id => id.trim()).filter(Boolean);
    department_id = departmentIds.length === 1 ? departmentIds[0] : departmentIds;
  }

  // Parse employee_id - support both single value and array (percent-separated)
  const employeeIdParam = url.searchParams.get('employee_id');
  let employee_id: string | string[] | undefined = undefined;
  if (employeeIdParam) {
    const employeeIds = employeeIdParam.split('%').map(id => id.trim()).filter(Boolean);
    employee_id = employeeIds.length === 1 ? employeeIds[0] : employeeIds;
  }

  // Parse sorting parameters
  const sort = url.searchParams.get('sort') || undefined;
  const orderParam = url.searchParams.get('order');
  const order = (orderParam === 'asc' || orderParam === 'desc') ? orderParam : undefined;

  // Parse date_type for duration filtering (default: appointed)
  const dateTypeParam = url.searchParams.get('date_type');
  const date_type = dateTypeParam && ['create', 'update', 'appointed'].includes(dateTypeParam)
    ? dateTypeParam
    : undefined;

  // Parse appointment_is_approved (boolean parameter)
  const appointmentIsApprovedParam = url.searchParams.get('appointment_is_approved');
  let appointment_is_approved: boolean | undefined = undefined;
  if (appointmentIsApprovedParam === 'true') {
    appointment_is_approved = true;
  } else if (appointmentIsApprovedParam === 'false') {
    appointment_is_approved = false;
  }

  const filters: Record<string, string | string[] | boolean | IncludeMode | undefined> = {
    id: url.searchParams.get('id') || undefined,
    details: url.searchParams.get('details') || undefined,
    work_type_id: url.searchParams.get('work_type_id') || undefined,
    assigner_id: url.searchParams.get('assigner_id') || undefined,
    status_id: url.searchParams.get('status_id') || undefined,
    additional: url.searchParams.get('additional') || undefined,
    site_id: url.searchParams.get('site_id') || undefined,
    contact_id: url.searchParams.get('contact_id') || undefined,
    appointment_id: url.searchParams.get('appointment_id') || undefined,
    created_at: url.searchParams.get('created_at') || undefined,
    updated_at: url.searchParams.get('updated_at') || undefined,
    start_date: url.searchParams.get('start_date') || undefined,
    end_date: url.searchParams.get('end_date') || undefined,
    date_type,
    exclude_backlog: url.searchParams.get('exclude_backlog') === 'true',
    appointment_is_approved,
    department_id,
    employee_id,
    include,
    // Watching filter - pass employee ID when watching=true
    watching,
    watcher_employee_id: watching ? employee.id : undefined,
  };

  // Remove undefined values
  const cleanFilters = Object.fromEntries(
    Object.entries(filters).filter(([_, v]) => v !== undefined)
  ) as Record<string, string | string[] | boolean | IncludeMode>;

  // Search tickets with filters, pagination, and sorting
  const result = await TicketService.search({
    page,
    limit,
    ...cleanFilters,
    sort,
    order: order as 'asc' | 'desc' | undefined,
  });

  return successWithPagination(result.data, result.pagination);
}
