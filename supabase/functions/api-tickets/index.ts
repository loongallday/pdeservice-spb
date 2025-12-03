/**
 * Tickets API Edge Function
 * Handles all ticket CRUD operations
 */

import { handleCORS } from './_shared/cors.ts';
import { error } from './_shared/response.ts';
import { authenticate } from './_shared/auth.ts';
import { handleError } from './_shared/error.ts';
import { get } from './handlers/get.ts';
import { create } from './handlers/create.ts';
import { update } from './handlers/update.ts';
import { deleteTicket } from './handlers/delete.ts';
import { search } from './handlers/search.ts';
import { searchDuration } from './handlers/searchDuration.ts';
import { removeTicketEmployee } from './handlers/removeTicketEmployee.ts';

Deno.serve(async (req) => {
  // Handle CORS preflight
  const corsResponse = handleCORS(req);
  if (corsResponse) return corsResponse;

  try {
    // Authenticate user
    const { employee } = await authenticate(req);

    // Route to appropriate handler
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    // Find the function name in the path and slice after it
    const functionIndex = pathParts.indexOf('api-tickets');
    const relativePath = functionIndex >= 0 ? pathParts.slice(functionIndex + 1) : [];
    const method = req.method;

    switch (method) {
      case 'GET':
        // GET /search - Search tickets
        if (relativePath.length === 1 && relativePath[0] === 'search') {
          return await search(req, employee);
        }

        // GET /search-duration - Search tickets by duration
        if (relativePath.length === 1 && relativePath[0] === 'search-duration') {
          return await searchDuration(req, employee);
        }

        // GET /:id - Get single ticket
        if (relativePath.length === 1) {
          const id = relativePath[0];
          // Validate it's not a special route
          if (id === 'search' || id === 'search-duration') {
            return error('Not found', 404);
          }
          return await get(req, employee, id);
        }
        break;

      case 'POST':
        // POST / - Create ticket
        if (relativePath.length === 0) {
          return await create(req, employee);
        }
        break;

      case 'PUT':
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

