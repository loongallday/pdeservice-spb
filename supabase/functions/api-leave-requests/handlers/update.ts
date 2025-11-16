/**
 * Update leave request handler
 */

import { success } from '../../_shared/response.ts';
import { requireMinLevel } from '../../_shared/auth.ts';
import { parseRequestBody, validateUUID } from '../../_shared/validation.ts';
import { LeaveService } from '../services/leaveService.ts';
import type { Employee } from '../../_shared/auth.ts';

export async function update(req: Request, employee: Employee, id: string) {
  // Check permissions - Level 0 (all authenticated users) and above can update leave requests
  await requireMinLevel(employee, 0);

  // Validate ID
  validateUUID(id, 'Leave Request ID');

  // Parse request body
  const body = await parseRequestBody<Record<string, unknown>>(req);

  // Update leave request
  const leaveRequest = await LeaveService.update(id, body);

  return success(leaveRequest);
}

