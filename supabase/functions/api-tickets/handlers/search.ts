/**
 * Search tickets handler - supports filtering by all ticket fields with pagination
 */

import { successWithPagination } from '../_shared/response.ts';
import { requireMinLevel } from '../_shared/auth.ts';
import { parsePaginationParams } from '../_shared/validation.ts';
import { TicketService } from '../services/ticketService.ts';
import type { Employee } from '../_shared/auth.ts';

export async function search(req: Request, employee: Employee) {
  // Check permissions - Level 0 and above can search tickets
  await requireMinLevel(employee, 0);

  // Parse query parameters
  const url = new URL(req.url);
  const { page, limit } = parsePaginationParams(url);

  // Parse all filter parameters
  // Handle department_id - support both single value and array (percent-separated)
  const departmentIdParam = url.searchParams.get('department_id');
  let department_id: string | string[] | undefined = undefined;
  if (departmentIdParam) {
    // Check if it's percent-separated (array) or single value
    const departmentIds = departmentIdParam.split('%').map(id => id.trim()).filter(Boolean);
    department_id = departmentIds.length === 1 ? departmentIds[0] : departmentIds;
  }

  // Handle employee_id - support both single value and array (percent-separated)
  const employeeIdParam = url.searchParams.get('employee_id');
  let employee_id: string | string[] | undefined = undefined;
  if (employeeIdParam) {
    // Check if it's percent-separated (array) or single value
    const employeeIds = employeeIdParam.split('%').map(id => id.trim()).filter(Boolean);
    employee_id = employeeIds.length === 1 ? employeeIds[0] : employeeIds;
  }

  // Parse sorting parameters
  const sort = url.searchParams.get('sort') || undefined;
  const orderParam = url.searchParams.get('order');
  const order = (orderParam === 'asc' || orderParam === 'desc') ? orderParam : undefined;

  // Parse appointment_is_approved (boolean parameter)
  const appointmentIsApprovedParam = url.searchParams.get('appointment_is_approved');
  let appointment_is_approved: boolean | undefined = undefined;
  if (appointmentIsApprovedParam === 'true') {
    appointment_is_approved = true;
  } else if (appointmentIsApprovedParam === 'false') {
    appointment_is_approved = false;
  }

  const filters: Record<string, string | string[] | boolean | undefined> = {
    id: url.searchParams.get('id') || undefined,
    details: url.searchParams.get('details') || undefined,
    work_type_id: url.searchParams.get('work_type_id') || undefined,
    assigner_id: url.searchParams.get('assigner_id') || undefined,
    status_id: url.searchParams.get('status_id') || undefined,
    additional: url.searchParams.get('additional') || undefined,
    site_id: url.searchParams.get('site_id') || undefined,
    contact_id: url.searchParams.get('contact_id') || undefined,
    work_result_id: url.searchParams.get('work_result_id') || undefined,
    appointment_id: url.searchParams.get('appointment_id') || undefined,
    created_at: url.searchParams.get('created_at') || undefined,
    updated_at: url.searchParams.get('updated_at') || undefined,
    start_date: url.searchParams.get('start_date') || undefined,
    end_date: url.searchParams.get('end_date') || undefined,
    exclude_backlog: url.searchParams.get('exclude_backlog') === 'true',
    appointment_is_approved,
    department_id,
    employee_id,
  };

  // Remove undefined values
  const cleanFilters = Object.fromEntries(
    Object.entries(filters).filter(([_, v]) => v !== undefined)
  ) as Record<string, string | string[] | boolean>;

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

