/**
 * Tickets API Edge Function
 * Handles all ticket CRUD operations
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

Deno.serve(async (req) => {
  // Handle CORS preflight
  const corsResponse = handleCORS(req);
  if (corsResponse) return corsResponse;

  try {
    // Authenticate user
    const { employee } = await authenticate(req);

    // Route to appropriate handler
    let url: URL;
    try {
      url = new URL(req.url);
    } catch (err) {
      return error('Invalid URL', 400);
    }
    
    const pathParts = url.pathname.split('/').filter(Boolean);
    // Find the function name in the path and slice after it
    const functionIndex = pathParts.indexOf('api-tickets');
    const relativePath = functionIndex >= 0 ? pathParts.slice(functionIndex + 1) : [];
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
    const { message, statusCode } = handleError(err);
    return error(message, statusCode);
  }
});

