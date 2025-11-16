/**
 * Create leave request handler
 */

import { success } from '../../_shared/response.ts';
import { requireMinLevel } from '../../_shared/auth.ts';
import { parseRequestBody, validateRequired } from '../../_shared/validation.ts';
import { LeaveService } from '../services/leaveService.ts';
import { HTTP_STATUS } from '../../_shared/constants.ts';
import type { Employee } from '../../_shared/auth.ts';

export async function create(req: Request, employee: Employee) {
  // Check permissions - Level 0 (all authenticated users) and above can create leave requests
  await requireMinLevel(employee, 0);

  // Parse request body
  const body = await parseRequestBody<Record<string, unknown>>(req);

  // Validate required fields
  validateRequired(body.employee_id, 'Employee ID');
  validateRequired(body.leave_type_id, 'Leave Type ID');
  validateRequired(body.start_date, 'Start Date');
  validateRequired(body.end_date, 'End Date');

  // Prepare data for insertion - only include half_day_type if it has a valid value
  // This helps avoid schema cache issues with PostgREST
  const insertData: Record<string, unknown> = {
    employee_id: body.employee_id,
    leave_type_id: body.leave_type_id,
    start_date: body.start_date,
    end_date: body.end_date,
    total_days: body.total_days,
    reason: body.reason || null,
    status: body.status || 'pending',
  };

  // Only include half_day_type if it's a valid value (morning or afternoon)
  // Exclude if null, undefined, empty string, or "full"
  if (
    body.half_day_type && 
    body.half_day_type !== null && 
    body.half_day_type !== undefined && 
    body.half_day_type !== '' &&
    body.half_day_type !== 'full' &&
    (body.half_day_type === 'morning' || body.half_day_type === 'afternoon')
  ) {
    insertData.half_day_type = body.half_day_type;
  }

  // Create leave request
  const leaveRequest = await LeaveService.create(insertData);

  return success(leaveRequest, HTTP_STATUS.CREATED);
}

