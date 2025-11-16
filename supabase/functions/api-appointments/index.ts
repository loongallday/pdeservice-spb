/**
 * Appointments API Edge Function
 * Handles all appointment CRUD operations
 */

import { handleCORS } from './_shared/cors.ts';
import { error } from './_shared/response.ts';
import { authenticate } from './_shared/auth.ts';
import { handleError } from './_shared/error.ts';
import { list } from './handlers/list.ts';
import { get } from './handlers/get.ts';
import { getByTicket } from './handlers/getByTicket.ts';
import { create } from './handlers/create.ts';
import { update } from './handlers/update.ts';
import { deleteAppointment } from './handlers/delete.ts';

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
    const functionIndex = pathParts.indexOf('api-appointments');
    const relativePath = functionIndex >= 0 ? pathParts.slice(functionIndex + 1) : [];
    const method = req.method;

    // GET /ticket/:ticketId - Get appointment by ticket ID
    if (method === 'GET' && relativePath[0] === 'ticket' && relativePath[1]) {
      const ticketId = relativePath[1];
      return await getByTicket(req, employee, ticketId);
    }

    // GET / - List appointments
    if (method === 'GET' && relativePath.length === 0) {
      return await list(req, employee);
    }

    // GET /:id - Get single appointment
    if (method === 'GET' && relativePath.length === 1) {
      const id = relativePath[0];
      return await get(req, employee, id);
    }

    // POST / - Create appointment
    if (method === 'POST' && relativePath.length === 0) {
      return await create(req, employee);
    }

    // PUT /:id - Update appointment
    if (method === 'PUT' && relativePath.length === 1) {
      const id = relativePath[0];
      return await update(req, employee, id);
    }

    // DELETE /:id - Delete appointment
    if (method === 'DELETE' && relativePath.length === 1) {
      const id = relativePath[0];
      return await deleteAppointment(req, employee, id);
    }

    return error('Not found', 404);
  } catch (err) {
    const { message, statusCode } = handleError(err);
    return error(message, statusCode);
  }
});

