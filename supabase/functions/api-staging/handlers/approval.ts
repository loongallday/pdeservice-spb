/**
 * Approval handlers - Approve/reject staged files
 */

import { success } from '../../_shared/response.ts';
import { requireCanApproveAppointments } from '../../_shared/auth.ts';
import { validateUUID } from '../../_shared/validation.ts';
import { ApprovalService } from '../services/approvalService.ts';
import type { Employee } from '../../_shared/auth.ts';
import type { ApproveFileInput, RejectFileInput, BulkApproveInput, BulkDeleteInput } from '../types.ts';

/**
 * POST /files/:id/approve - Approve a staged file
 */
export async function approveFile(
  req: Request,
  employee: Employee,
  id: string
): Promise<Response> {
  // Check permission
  await requireCanApproveAppointments(employee);

  validateUUID(id, 'File ID');

  const body = await req.json().catch(() => ({})) as ApproveFileInput;
  const file = await ApprovalService.approve(id, employee.id, body);

  return success(file);
}

/**
 * POST /files/:id/reject - Reject a staged file
 */
export async function rejectFile(
  req: Request,
  employee: Employee,
  id: string
): Promise<Response> {
  // Check permission
  await requireCanApproveAppointments(employee);

  validateUUID(id, 'File ID');

  const body = await req.json() as RejectFileInput;
  const file = await ApprovalService.reject(id, employee.id, body);

  return success(file);
}

/**
 * POST /files/bulk-approve - Bulk approve multiple files
 */
export async function bulkApproveFiles(
  req: Request,
  employee: Employee
): Promise<Response> {
  // Check permission
  await requireCanApproveAppointments(employee);

  const body = await req.json() as BulkApproveInput;
  const result = await ApprovalService.bulkApprove(employee.id, body);

  return success(result);
}

/**
 * POST /files/bulk-delete - Bulk delete multiple files
 */
export async function bulkDeleteFiles(
  req: Request,
  employee: Employee
): Promise<Response> {
  // Check permission
  await requireCanApproveAppointments(employee);

  const body = await req.json() as BulkDeleteInput;
  const result = await ApprovalService.bulkDelete(body);

  return success(result);
}
