/**
 * Comment handlers for company comments CRUD
 */

import { success, successWithPagination } from '../../_shared/response.ts';
import { requireMinLevel, isAdmin } from '../../_shared/auth.ts';
import { validateUUID, parsePaginationParams, parseRequestBody } from '../../_shared/validation.ts';
import { CommentService, CommentCreateInput, CommentUpdateInput } from '../services/commentService.ts';
import type { Employee } from '../../_shared/auth.ts';

/**
 * GET /companies/:companyId/comments
 * List all comments for a company
 */
export async function getComments(req: Request, employee: Employee, companyId: string): Promise<Response> {
  await requireMinLevel(employee, 0);
  validateUUID(companyId, 'Company ID');

  const url = new URL(req.url);
  const { page, limit } = parsePaginationParams(url);

  const result = await CommentService.getByCompanyId(companyId, { page, limit });

  return successWithPagination(result.data, result.pagination);
}

/**
 * POST /companies/:companyId/comments
 * Create a new comment
 */
export async function createComment(req: Request, employee: Employee, companyId: string): Promise<Response> {
  await requireMinLevel(employee, 0); // All authenticated users can comment
  validateUUID(companyId, 'Company ID');

  const body = await parseRequestBody<CommentCreateInput>(req);

  const comment = await CommentService.create(companyId, body, employee.id);

  return success(comment, 201);
}

/**
 * PUT /companies/:companyId/comments/:commentId
 * Update a comment (author only)
 */
export async function updateComment(
  req: Request,
  employee: Employee,
  companyId: string,
  commentId: string
): Promise<Response> {
  await requireMinLevel(employee, 0);
  validateUUID(companyId, 'Company ID');
  validateUUID(commentId, 'Comment ID');

  const body = await parseRequestBody<CommentUpdateInput>(req);

  const comment = await CommentService.update(commentId, body, employee.id);

  return success(comment);
}

/**
 * DELETE /companies/:companyId/comments/:commentId
 * Delete a comment (author or admin)
 */
export async function deleteComment(
  _req: Request,
  employee: Employee,
  companyId: string,
  commentId: string
): Promise<Response> {
  await requireMinLevel(employee, 0);
  validateUUID(companyId, 'Company ID');
  validateUUID(commentId, 'Comment ID');

  await CommentService.delete(commentId, employee.id, isAdmin(employee));

  return success({ message: 'ลบความคิดเห็นสำเร็จ' });
}
