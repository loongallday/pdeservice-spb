/**
 * @fileoverview Ticket customer rating handlers
 * @module api-tickets/handlers/ratings
 *
 * Provides rating functionality for tickets:
 * - GET /:id/rating - Get rating (Level 0+)
 * - POST /:id/rating - Create rating (Level 1+)
 * - PUT /:id/rating - Update rating (Level 1+)
 * - DELETE /:id/rating - Delete rating (Level 2+)
 *
 * @description
 * Customer ratings capture feedback after ticket completion.
 * Each ticket can have at most one rating. Ratings include
 * score (1-5) and optional feedback text.
 */

import { success } from '../../_shared/response.ts';
import { requireMinLevel } from '../../_shared/auth.ts';
import { validateUUID, parseRequestBody } from '../../_shared/validation.ts';
import { RatingService, RatingInput } from '../services/ratingService.ts';
import type { Employee } from '../../_shared/auth.ts';

/**
 * GET /tickets/:id/rating - Get rating for a ticket
 */
export async function getRating(req: Request, employee: Employee, ticketId: string) {
  // Check permissions - Level 0 and above can view ratings
  await requireMinLevel(employee, 0);

  // Validate ticket ID
  validateUUID(ticketId, 'Ticket ID');

  // Get rating
  const rating = await RatingService.getRating(ticketId);

  return success({
    rating,
    hasRating: rating !== null,
  });
}

/**
 * POST /tickets/:id/rating - Create rating for a ticket
 */
export async function createRating(req: Request, employee: Employee, ticketId: string) {
  // Check permissions - Level 1 and above can create ratings
  await requireMinLevel(employee, 1);

  // Validate ticket ID
  validateUUID(ticketId, 'Ticket ID');

  // Parse request body
  const body = await parseRequestBody<RatingInput>(req);

  // Create rating
  const rating = await RatingService.createRating(ticketId, employee.id, body);

  return success({ rating }, 201);
}

/**
 * PUT /tickets/:id/rating - Update rating for a ticket
 */
export async function updateRating(req: Request, employee: Employee, ticketId: string) {
  // Check permissions - Level 1 and above can update ratings
  await requireMinLevel(employee, 1);

  // Validate ticket ID
  validateUUID(ticketId, 'Ticket ID');

  // Parse request body
  const body = await parseRequestBody<RatingInput>(req);

  // Update rating
  const rating = await RatingService.updateRating(ticketId, body);

  return success({ rating });
}

/**
 * DELETE /tickets/:id/rating - Delete rating for a ticket
 */
export async function deleteRating(req: Request, employee: Employee, ticketId: string) {
  // Check permissions - Level 2 and above can delete ratings
  await requireMinLevel(employee, 2);

  // Validate ticket ID
  validateUUID(ticketId, 'Ticket ID');

  // Delete rating
  await RatingService.deleteRating(ticketId);

  return success({ message: 'ลบคะแนนสำเร็จ' });
}
