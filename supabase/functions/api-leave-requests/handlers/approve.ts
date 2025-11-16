/**
 * Approve leave request handler
 */

import { success } from '../../_shared/response.ts';
import { requireMinLevel } from '../../_shared/auth.ts';
import { validateUUID } from '../../_shared/validation.ts';
import { LeaveService } from '../services/leaveService.ts';
import type { Employee } from '../../_shared/auth.ts';

export async function approve(req: Request, employee: Employee, id: string) {
  // Check permissions - Level 2 (admin) and above can approve leave requests
  await requireMinLevel(employee, 2);

  // Validate ID
  validateUUID(id, 'Leave Request ID');

  // Approve leave request
  const leaveRequest = await LeaveService.approve(id, employee.id);

  return success(leaveRequest);
}

