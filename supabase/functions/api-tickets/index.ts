/**
 * Tickets API Edge Function
 * Handles all ticket CRUD operations
 */

import { handleCORS } from './_shared/cors.ts';
import { error } from './_shared/response.ts';
import { authenticate } from './_shared/auth.ts';
import { handleError } from './_shared/error.ts';
import { list } from './handlers/list.ts';
import { get } from './handlers/get.ts';
import { create } from './handlers/create.ts';
import { update } from './handlers/update.ts';
import { deleteTicket } from './handlers/delete.ts';
import { listMerchandise } from './handlers/listMerchandise.ts';
import { addMerchandise } from './handlers/addMerchandise.ts';
import { removeMerchandise } from './handlers/removeMerchandise.ts';
import { createMaster } from './handlers/createMaster.ts';
import { updateMaster } from './handlers/updateMaster.ts';
import { deleteMaster } from './handlers/deleteMaster.ts';

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

    // Master ticket operations (handle these FIRST before regular routes)
    
    // DELETE /master/:id - Delete master ticket with all related data
    if (method === 'DELETE' && relativePath.length === 2 && relativePath[0] === 'master') {
      const ticketId = relativePath[1];
      return await deleteMaster(req, employee, ticketId);
    }

    // PUT /master/:id - Update master ticket with all related data
    if (method === 'PUT' && relativePath.length === 2 && relativePath[0] === 'master') {
      const ticketId = relativePath[1];
      return await updateMaster(req, employee, ticketId);
    }

    // POST /master - Create master ticket with all related data
    if (method === 'POST' && relativePath.length === 1 && relativePath[0] === 'master') {
      return await createMaster(req, employee);
    }

    // GET /employee/:employeeId - Get tickets by employee (check this FIRST before single ticket)
    if (method === 'GET' && relativePath.length === 2 && relativePath[0] === 'employee') {
      const employeeId = relativePath[1];
      // TODO: Implement getByEmployee handler
      return error('Not implemented yet', 501);
    }

    // DELETE /:id/merchandise/:merchandiseId - Remove merchandise from ticket
    if (method === 'DELETE' && relativePath.length === 3 && relativePath[1] === 'merchandise') {
      const ticketId = relativePath[0];
      const merchandiseId = relativePath[2];
      // Validate it's not a special route
      if (ticketId === 'employee') {
        return error('Not found', 404);
      }
      return await removeMerchandise(req, employee, ticketId, merchandiseId);
    }

    // POST /:id/merchandise - Add merchandise to ticket
    if (method === 'POST' && relativePath.length === 2 && relativePath[1] === 'merchandise') {
      const ticketId = relativePath[0];
      // Validate it's not a special route
      if (ticketId === 'employee') {
        return error('Not found', 404);
      }
      return await addMerchandise(req, employee, ticketId);
    }

    // GET /:id/merchandise - List merchandise for ticket
    if (method === 'GET' && relativePath.length === 2 && relativePath[1] === 'merchandise') {
      const ticketId = relativePath[0];
      // Validate it's not a special route
      if (ticketId === 'employee') {
        return error('Not found', 404);
      }
      return await listMerchandise(req, employee, ticketId);
    }

    // GET / - List tickets
    if (method === 'GET' && relativePath.length === 0) {
      return await list(req, employee);
    }

    // GET /:id - Get single ticket
    if (method === 'GET' && relativePath.length === 1) {
      const id = relativePath[0];
      // Validate it's not a special route
      if (id === 'employee' || id === 'merchandise') {
        return error('Not found', 404);
      }
      return await get(req, employee, id);
    }

    // POST / - Create ticket
    if (method === 'POST' && relativePath.length === 0) {
      return await create(req, employee);
    }

    // PUT /:id - Update ticket
    if (method === 'PUT' && relativePath.length === 1) {
      const id = relativePath[0];
      return await update(req, employee, id);
    }

    // DELETE /:id - Delete ticket
    if (method === 'DELETE' && relativePath.length === 1) {
      const id = relativePath[0];
      return await deleteTicket(req, employee, id);
    }

    return error('Not found', 404);
  } catch (err) {
    const { message, statusCode } = handleError(err);
    return error(message, statusCode);
  }
});

