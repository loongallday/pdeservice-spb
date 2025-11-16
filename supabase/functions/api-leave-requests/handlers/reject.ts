/**
 * Reject leave request handler
 */

import { success } from '../../_shared/response.ts';
import { requireMinLevel } from '../../_shared/auth.ts';
import { parseRequestBody, validateUUID } from '../../_shared/validation.ts';
import { LeaveService } from '../services/leaveService.ts';
import type { Employee } from '../../_shared/auth.ts';

export async function reject(req: Request, employee: Employee, id: string) {
  // Check permissions - Level 2 (admin) and above can reject leave requests
  await requireMinLevel(employee, 2);

  // Validate ID
  validateUUID(id, 'Leave Request ID');

  // Parse request body
  const body = await parseRequestBody<{ reason?: string }>(req);

  // Reject leave request
  const leaveRequest = await LeaveService.reject(id, employee.id, body.reason);

  return success(leaveRequest);
}

