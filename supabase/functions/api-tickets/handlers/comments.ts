/**
 * @fileoverview Ticket comments CRUD handlers
 * @module api-tickets/handlers/comments
 *
 * Provides comment functionality for tickets including:
 * - GET /:id/comments - List comments with pagination
 * - POST /:id/comments - Create new comment
 * - PUT /:id/comments/:commentId - Update comment (author only)
 * - DELETE /:id/comments/:commentId - Delete comment (author or admin)
 *
 * @auth All operations require Level 0+ authentication
 */

import { success, successWithPagination } from '../../_shared/response.ts';
import { requireMinLevel, isAdmin } from '../../_shared/auth.ts';
import { validateUUID, parsePaginationParams, parseRequestBody } from '../../_shared/validation.ts';
import { CommentService, CommentCreateInput, CommentUpdateInput } from '../services/commentService.ts';
import type { Employee } from '../../_shared/auth.ts';

/**
 * GET /tickets/:ticketId/comments
 * List all comments for a ticket
 */
export async function getComments(req: Request, employee: Employee, ticketId: string): Promise<Response> {
  await requireMinLevel(employee, 0);
  validateUUID(ticketId, 'Ticket ID');

  const url = new URL(req.url);
  const { page, limit } = parsePaginationParams(url);

  const result = await CommentService.getByTicketId(ticketId, { page, limit });

  return successWithPagination(result.data, result.pagination);
}

/**
 * POST /tickets/:ticketId/comments
 * Create a new comment
 */
export async function createComment(req: Request, employee: Employee, ticketId: string): Promise<Response> {
  await requireMinLevel(employee, 0); // All authenticated users can comment
  validateUUID(ticketId, 'Ticket ID');

  const body = await parseRequestBody<CommentCreateInput>(req);

  const comment = await CommentService.create(ticketId, body, employee.id);

  return success(comment, 201);
}

/**
 * PUT /tickets/:ticketId/comments/:commentId
 * Update a comment (author only)
 */
export async function updateComment(
  req: Request,
  employee: Employee,
  ticketId: string,
  commentId: string
): Promise<Response> {
  await requireMinLevel(employee, 0);
  validateUUID(ticketId, 'Ticket ID');
  validateUUID(commentId, 'Comment ID');

  const body = await parseRequestBody<CommentUpdateInput>(req);

  const comment = await CommentService.update(commentId, body, employee.id);

  return success(comment);
}

/**
 * DELETE /tickets/:ticketId/comments/:commentId
 * Delete a comment (author or admin)
 */
export async function deleteComment(
  _req: Request,
  employee: Employee,
  ticketId: string,
  commentId: string
): Promise<Response> {
  await requireMinLevel(employee, 0);
  validateUUID(ticketId, 'Ticket ID');
  validateUUID(commentId, 'Comment ID');

  await CommentService.delete(commentId, employee.id, isAdmin(employee));

  return success({ message: 'ลบความคิดเห็นสำเร็จ' });
}
