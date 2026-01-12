/**
 * Comment handlers for site comments CRUD
 */

import { success, successWithPagination } from '../../_shared/response.ts';
import { requireMinLevel, isAdmin } from '../../_shared/auth.ts';
import { validateUUID, parsePaginationParams, parseRequestBody } from '../../_shared/validation.ts';
import { CommentService, CommentCreateInput, CommentUpdateInput } from '../services/commentService.ts';
import type { Employee } from '../../_shared/auth.ts';

/**
 * GET /sites/:siteId/comments
 * List all comments for a site
 */
export async function getComments(req: Request, employee: Employee, siteId: string): Promise<Response> {
  await requireMinLevel(employee, 0);
  validateUUID(siteId, 'Site ID');

  const url = new URL(req.url);
  const { page, limit } = parsePaginationParams(url);

  const result = await CommentService.getBySiteId(siteId, { page, limit });

  return successWithPagination(result.data, result.pagination);
}

/**
 * POST /sites/:siteId/comments
 * Create a new comment
 */
export async function createComment(req: Request, employee: Employee, siteId: string): Promise<Response> {
  await requireMinLevel(employee, 0); // All authenticated users can comment
  validateUUID(siteId, 'Site ID');

  const body = await parseRequestBody<CommentCreateInput>(req);

  const comment = await CommentService.create(siteId, body, employee.id);

  return success(comment, 201);
}

/**
 * PUT /sites/:siteId/comments/:commentId
 * Update a comment (author only)
 */
export async function updateComment(
  req: Request,
  employee: Employee,
  siteId: string,
  commentId: string
): Promise<Response> {
  await requireMinLevel(employee, 0);
  validateUUID(siteId, 'Site ID');
  validateUUID(commentId, 'Comment ID');

  const body = await parseRequestBody<CommentUpdateInput>(req);

  const comment = await CommentService.update(commentId, body, employee.id);

  return success(comment);
}

/**
 * DELETE /sites/:siteId/comments/:commentId
 * Delete a comment (author or admin)
 */
export async function deleteComment(
  _req: Request,
  employee: Employee,
  siteId: string,
  commentId: string
): Promise<Response> {
  await requireMinLevel(employee, 0);
  validateUUID(siteId, 'Site ID');
  validateUUID(commentId, 'Comment ID');

  await CommentService.delete(commentId, employee.id, isAdmin(employee));

  return success({ message: 'ลบความคิดเห็นสำเร็จ' });
}
