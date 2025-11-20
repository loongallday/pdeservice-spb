/**
 * PM Log API Edge Function
 * Handles all PM log CRUD operations
 */

import { handleCORS } from './_shared/cors.ts';
import { error } from './_shared/response.ts';
import { authenticate } from './_shared/auth.ts';
import { handleError } from './_shared/error.ts';
import { list } from './handlers/list.ts';
import { get } from './handlers/get.ts';
import { create } from './handlers/create.ts';
import { update } from './handlers/update.ts';
import { deletePMLog } from './handlers/delete.ts';
import { getByMerchandise } from './handlers/getByMerchandise.ts';
import { search } from './handlers/search.ts';

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
    const functionIndex = pathParts.indexOf('api-pmlog');
    const relativePath = functionIndex >= 0 ? pathParts.slice(functionIndex + 1) : [];
    const method = req.method;

    // GET /merchandise/:merchandiseId - Get PM logs by merchandise
    if (method === 'GET' && relativePath[0] === 'merchandise' && relativePath[1]) {
      const merchandiseId = relativePath[1];
      return await getByMerchandise(req, employee, merchandiseId);
    }

    // GET / - List PM logs
    if (method === 'GET' && relativePath.length === 0) {
      return await list(req, employee);
    }

    // GET /search - Search PM logs
    if (method === 'GET' && relativePath.length === 1 && relativePath[0] === 'search') {
      return await search(req, employee);
    }

    // GET /:id - Get single PM log
    if (method === 'GET' && relativePath.length === 1) {
      const id = relativePath[0];
      return await get(req, employee, id);
    }

    // POST / - Create PM log
    if (method === 'POST' && relativePath.length === 0) {
      return await create(req, employee);
    }

    // PUT /:id - Update PM log
    if (method === 'PUT' && relativePath.length === 1) {
      const id = relativePath[0];
      return await update(req, employee, id);
    }

    // DELETE /:id - Delete PM log
    if (method === 'DELETE' && relativePath.length === 1) {
      const id = relativePath[0];
      return await deletePMLog(req, employee, id);
    }

    return error('Not found', 404);
  } catch (err) {
    const { message, statusCode } = handleError(err);
    return error(message, statusCode);
  }
});

