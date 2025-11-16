/**
 * List leave requests handler
 */

import { success } from '../../_shared/response.ts';
import { requireMinLevel } from '../../_shared/auth.ts';
import { parsePaginationParams } from '../../_shared/validation.ts';
import { LeaveService } from '../services/leaveService.ts';
import type { Employee } from '../../_shared/auth.ts';

export async function list(req: Request, employee: Employee) {
  // Check permissions - Level 0 (all authenticated users) and above can view leave requests
  await requireMinLevel(employee, 0);

  // Parse pagination and filters
  const url = new URL(req.url);
  const { page, limit } = parsePaginationParams(url);
  const status = url.searchParams.get('status') || undefined;
  const leave_type_id = url.searchParams.get('leave_type_id') || undefined;
  const employee_id = url.searchParams.get('employee_id') || undefined;
  const start_date = url.searchParams.get('start_date') || undefined;
  const end_date = url.searchParams.get('end_date') || undefined;

  // Fetch leave requests
  const result = await LeaveService.getAll({ 
    page, 
    limit, 
    status, 
    leave_type_id, 
    employee_id, 
    start_date, 
    end_date 
  });

  return success(result);
}

