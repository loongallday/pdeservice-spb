/**
 * Get single leave request handler
 */

import { success } from '../../_shared/response.ts';
import { requireMinLevel } from '../../_shared/auth.ts';
import { validateUUID } from '../../_shared/validation.ts';
import { LeaveService } from '../services/leaveService.ts';
import type { Employee } from '../../_shared/auth.ts';

export async function get(req: Request, employee: Employee, id: string) {
  // Check permissions - Level 0 (all authenticated users) and above can view leave requests
  await requireMinLevel(employee, 0);

  // Validate ID
  validateUUID(id, 'Leave Request ID');

  // Fetch leave request
  const leaveRequest = await LeaveService.getById(id);

  return success(leaveRequest);
}

