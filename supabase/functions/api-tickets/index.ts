/**
 * @fileoverview Tickets API Edge Function - Core ticket management system
 * @module api-tickets
 *
 * Central API for field service ticket operations including work orders,
 * technician assignments, scheduling, comments, attachments, and ratings.
 *
 * @endpoints
 *
 * ## Core Ticket Operations
 * - GET    /search                    - Search tickets with filters and pagination
 * - GET    /search-duration           - Search tickets by duration/time range
 * - GET    /summaries                 - Get ticket summaries grouped by technician
 * - GET    /:id                       - Get single ticket by ID
 * - POST   /                          - Create new ticket
 * - PUT    /:id                       - Update ticket
 * - DELETE /:id                       - Delete ticket
 *
 * ## Technician Management
 * - GET    /:id/confirmed-technicians - Get confirmed technicians for ticket
 * - POST   /:id/confirm-technicians   - Confirm technician assignments
 * - DELETE /employees                 - Remove technician from ticket
 *
 * ## Comments
 * - GET    /:id/comments              - Get all comments for ticket
 * - POST   /:id/comments              - Add comment to ticket
 * - PUT    /:id/comments/:commentId   - Update a comment
 * - DELETE /:id/comments/:commentId   - Delete a comment
 *
 * ## Watchers
 * - GET    /:id/watchers              - Get watchers for ticket
 * - POST   /:id/watch                 - Add current user as watcher
 * - DELETE /:id/watch                 - Remove current user from watchers
 *
 * ## Attachments
 * - GET    /:id/attachments           - Get attachments for ticket
 * - POST   /:id/attachments           - Add attachments to ticket
 * - DELETE /:id/attachments/:id       - Delete an attachment
 *
 * ## Ratings
 * - GET    /:id/rating                - Get rating for ticket
 * - POST   /:id/rating                - Create rating
 * - PUT    /:id/rating                - Update rating
 * - DELETE /:id/rating                - Delete rating
 *
 * ## Extra Fields (Custom Fields)
 * - GET    /:id/extra-fields          - Get extra fields for ticket
 * - POST   /:id/extra-fields          - Create extra field
 * - POST   /:id/extra-fields/bulk     - Bulk upsert extra fields
 * - PUT    /:id/extra-fields/:id      - Update extra field
 * - DELETE /:id/extra-fields/:id      - Delete extra field
 *
 * ## Audit & Admin
 * - GET    /audit                     - Get recent audit logs (admin)
 * - GET    /:id/audit                 - Get audit logs for specific ticket
 * - GET    /backfill-summaries        - Check backfill job status
 * - POST   /backfill-summaries        - Regenerate AI summaries
 *
 * ## Utility
 * - GET    /warmup                    - Keep function warm (no auth)
 *
 * @auth JWT required for all endpoints except /warmup
 */

import { handleCORS } from '../_shared/cors.ts';
import { error } from '../_shared/response.ts';
import { authenticate } from '../_shared/auth.ts';
import { handleError } from '../_shared/error.ts';
import { get } from './handlers/get.ts';
import { create } from './handlers/create.ts';
import { update } from './handlers/update.ts';
import { deleteTicket } from './handlers/delete.ts';
import { search } from './handlers/search.ts';
import { searchDuration } from './handlers/searchDuration.ts';
import { removeTicketEmployee } from './handlers/removeTicketEmployee.ts';
import { confirmTechnicians } from './handlers/confirmTechnicians.ts';
import { getSummaries } from './handlers/getSummaries.ts';
import { getConfirmedTechnicians } from './handlers/getConfirmedTechnicians.ts';
import { getAuditLogs, getRecentAuditLogs } from './handlers/getAuditLogs.ts';
import { getComments, createComment, updateComment, deleteComment } from './handlers/comments.ts';
import { getWatchers, addWatch, removeWatch } from './handlers/watchers.ts';
import { getAttachments, addAttachments, deleteAttachment } from './handlers/attachments.ts';
import { backfillSummaries } from './handlers/backfillSummaries.ts';
import { getRating, createRating, updateRating, deleteRating } from './handlers/ratings.ts';
import { getExtraFields, createExtraField, updateExtraField, deleteExtraField, bulkUpsertExtraFields } from './handlers/extraFields.ts';

import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  // Handle CORS preflight
  const corsResponse = handleCORS(req);
  if (corsResponse) return corsResponse;

  // Parse URL early for warmup check
  let url: URL;
  try {
    url = new URL(req.url);
  } catch {
    return error('Invalid URL', 400);
  }

  const pathParts = url.pathname.split('/').filter(Boolean);
  const functionIndex = pathParts.indexOf('api-tickets');
  const relativePath = functionIndex >= 0 ? pathParts.slice(functionIndex + 1) : [];

  // GET /warmup - Keep function warm (no auth required)
  if (req.method === 'GET' && relativePath.length === 1 && relativePath[0] === 'warmup') {
    return new Response(
      JSON.stringify({ status: 'warm', timestamp: new Date().toISOString() }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }

  try {
    // Authenticate user
    const { employee } = await authenticate(req);
    const method = req.method;

    switch (method) {
      case 'GET':
        // GET /summaries - Get summaries grouped by technicians
        if (relativePath.length === 1 && relativePath[0] === 'summaries') {
          return await getSummaries(req, employee);
        }

        // GET /search - Search tickets
        if (relativePath.length === 1 && relativePath[0] === 'search') {
          return await search(req, employee);
        }

        // GET /search-duration - Search tickets by duration
        if (relativePath.length === 1 && relativePath[0] === 'search-duration') {
          return await searchDuration(req, employee);
        }

        // GET /audit - Get recent audit logs (admin only)
        if (relativePath.length === 1 && relativePath[0] === 'audit') {
          return await getRecentAuditLogs(req, employee);
        }

        // GET /backfill-summaries?job_id=xxx - Check backfill job status
        if (relativePath.length === 1 && relativePath[0] === 'backfill-summaries') {
          return await backfillSummaries(req, employee);
        }

        // GET /:id/confirmed-technicians - Get confirmed technicians for a ticket
        if (relativePath.length === 2 && relativePath[1] === 'confirmed-technicians') {
          const id = relativePath[0];
          return await getConfirmedTechnicians(req, employee, id);
        }

        // GET /:id/audit - Get audit logs for a specific ticket
        if (relativePath.length === 2 && relativePath[1] === 'audit') {
          const id = relativePath[0];
          return await getAuditLogs(req, employee, id);
        }

        // GET /:id/comments - Get comments for a ticket
        if (relativePath.length === 2 && relativePath[1] === 'comments') {
          const id = relativePath[0];
          return await getComments(req, employee, id);
        }

        // GET /:id/watchers - Get watchers for a ticket
        if (relativePath.length === 2 && relativePath[1] === 'watchers') {
          const id = relativePath[0];
          return await getWatchers(req, employee, id);
        }

        // GET /:id/attachments - Get attachments for a ticket
        if (relativePath.length === 2 && relativePath[1] === 'attachments') {
          const id = relativePath[0];
          return await getAttachments(req, employee, id);
        }

        // GET /:id/rating - Get rating for a ticket
        if (relativePath.length === 2 && relativePath[1] === 'rating') {
          const id = relativePath[0];
          return await getRating(req, employee, id);
        }

        // GET /:id/extra-fields - Get extra fields for a ticket
        if (relativePath.length === 2 && relativePath[1] === 'extra-fields') {
          const id = relativePath[0];
          return await getExtraFields(req, employee, id);
        }

        // GET /:id - Get single ticket
        if (relativePath.length === 1) {
          const id = relativePath[0];
          // Validate it's not a special route
          if (id === 'search' || id === 'search-duration' || id === 'summaries' || id === 'audit') {
            return error('Not found', 404);
          }
          return await get(req, employee, id);
        }
        break;

      case 'POST':
        // POST /backfill-summaries - Regenerate AI summaries for existing tickets
        if (relativePath.length === 1 && relativePath[0] === 'backfill-summaries') {
          return await backfillSummaries(req, employee);
        }

        // POST /:id/confirm-technicians - Confirm technicians for a ticket
        if (relativePath.length === 2 && relativePath[1] === 'confirm-technicians') {
          const id = relativePath[0];
          return await confirmTechnicians(req, employee, id);
        }

        // POST /:id/comments - Create a comment
        if (relativePath.length === 2 && relativePath[1] === 'comments') {
          const id = relativePath[0];
          return await createComment(req, employee, id);
        }

        // POST /:id/watch - Add current user as watcher
        if (relativePath.length === 2 && relativePath[1] === 'watch') {
          const id = relativePath[0];
          return await addWatch(req, employee, id);
        }

        // POST /:id/attachments - Add attachments to a ticket
        if (relativePath.length === 2 && relativePath[1] === 'attachments') {
          const id = relativePath[0];
          return await addAttachments(req, employee, id);
        }

        // POST /:id/rating - Create rating for a ticket
        if (relativePath.length === 2 && relativePath[1] === 'rating') {
          const id = relativePath[0];
          return await createRating(req, employee, id);
        }

        // POST /:id/extra-fields/bulk - Bulk upsert extra fields
        if (relativePath.length === 3 && relativePath[1] === 'extra-fields' && relativePath[2] === 'bulk') {
          const id = relativePath[0];
          return await bulkUpsertExtraFields(req, employee, id);
        }

        // POST /:id/extra-fields - Create extra field
        if (relativePath.length === 2 && relativePath[1] === 'extra-fields') {
          const id = relativePath[0];
          return await createExtraField(req, employee, id);
        }

        // POST / - Create ticket
        if (relativePath.length === 0) {
          return await create(req, employee);
        }
        break;

      case 'PUT':
        // PUT /:id/comments/:commentId - Update a comment
        if (relativePath.length === 3 && relativePath[1] === 'comments') {
          const ticketId = relativePath[0];
          const commentId = relativePath[2];
          return await updateComment(req, employee, ticketId, commentId);
        }

        // PUT /:id/rating - Update rating for a ticket
        if (relativePath.length === 2 && relativePath[1] === 'rating') {
          const id = relativePath[0];
          return await updateRating(req, employee, id);
        }

        // PUT /:id/extra-fields/:fieldId - Update extra field
        if (relativePath.length === 3 && relativePath[1] === 'extra-fields') {
          const ticketId = relativePath[0];
          const fieldId = relativePath[2];
          return await updateExtraField(req, employee, ticketId, fieldId);
        }

        // PUT /:id - Update ticket
        if (relativePath.length === 1) {
          const id = relativePath[0];
          return await update(req, employee, id);
        }
        break;

      case 'DELETE':
        // DELETE /employees - Remove ticket-employee assignment
        if (relativePath.length === 1 && relativePath[0] === 'employees') {
          return await removeTicketEmployee(req, employee);
        }

        // DELETE /:id/comments/:commentId - Delete a comment
        if (relativePath.length === 3 && relativePath[1] === 'comments') {
          const ticketId = relativePath[0];
          const commentId = relativePath[2];
          return await deleteComment(req, employee, ticketId, commentId);
        }

        // DELETE /:id/watch - Remove current user from watchers
        if (relativePath.length === 2 && relativePath[1] === 'watch') {
          const id = relativePath[0];
          return await removeWatch(req, employee, id);
        }

        // DELETE /:id/attachments/:attachmentId - Delete an attachment
        if (relativePath.length === 3 && relativePath[1] === 'attachments') {
          const ticketId = relativePath[0];
          const attachmentId = relativePath[2];
          return await deleteAttachment(req, employee, ticketId, attachmentId);
        }

        // DELETE /:id/rating - Delete rating for a ticket
        if (relativePath.length === 2 && relativePath[1] === 'rating') {
          const id = relativePath[0];
          return await deleteRating(req, employee, id);
        }

        // DELETE /:id/extra-fields/:fieldId - Delete extra field
        if (relativePath.length === 3 && relativePath[1] === 'extra-fields') {
          const ticketId = relativePath[0];
          const fieldId = relativePath[2];
          return await deleteExtraField(req, employee, ticketId, fieldId);
        }

        // DELETE /:id - Delete ticket
        if (relativePath.length === 1) {
          const id = relativePath[0];
          // Validate it's not a special route
          if (id === 'employees') {
            return error('Not found', 404);
          }
          return await deleteTicket(req, employee, id);
        }
        break;
    }

    return error('Not found', 404);
  } catch (err) {
    const { message, statusCode, code } = handleError(err);
    return error(message, statusCode, code);
  }
});

