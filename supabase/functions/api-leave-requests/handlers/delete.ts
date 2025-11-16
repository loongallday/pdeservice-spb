/**
 * Delete leave request handler
 */

import { success } from '../../_shared/response.ts';
import { requireMinLevel } from '../../_shared/auth.ts';
import { validateUUID } from '../../_shared/validation.ts';
import { LeaveService } from '../services/leaveService.ts';
import type { Employee } from '../../_shared/auth.ts';

export async function deleteLeaveRequest(req: Request, employee: Employee, id: string) {
  // Check permissions - Level 0 (all authenticated users) and above can delete leave requests
  await requireMinLevel(employee, 0);

  // Validate ID
  validateUUID(id, 'Leave Request ID');

  // Delete leave request
  await LeaveService.delete(id);

  return success({ message: 'ลบคำขอลาสำเร็จ' });
}

