/**
 * Sites API Edge Function
 * Handles all site CRUD operations
 */

import { handleCORS } from './_shared/cors.ts';
import { error } from './_shared/response.ts';
import { authenticate } from './_shared/auth.ts';
import { handleError } from './_shared/error.ts';
import { list } from './handlers/list.ts';
import { get } from './handlers/get.ts';
import { search } from './handlers/search.ts';
import { recent } from './handlers/recent.ts';
import { create } from './handlers/create.ts';
import { update } from './handlers/update.ts';
import { deleteSite } from './handlers/delete.ts';
import { findOrCreate } from './handlers/findOrCreate.ts';

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
    const functionIndex = pathParts.indexOf('api-sites');
    const relativePath = functionIndex >= 0 ? pathParts.slice(functionIndex + 1) : [];
    const method = req.method;

    // GET /search - Search sites
    if (method === 'GET' && relativePath.length === 1 && relativePath[0] === 'search') {
      return await search(req, employee);
    }

    // GET /recent - Get recent sites
    if (method === 'GET' && relativePath.length === 1 && relativePath[0] === 'recent') {
      return await recent(req, employee);
    }

    // GET / - List sites
    if (method === 'GET' && relativePath.length === 0) {
      return await list(req, employee);
    }

    // GET /:id - Get single site
    if (method === 'GET' && relativePath.length === 1) {
      const id = relativePath[0];
      return await get(req, employee, id);
    }

    // POST /find-or-create - Find or create site
    if (method === 'POST' && relativePath.length === 1 && relativePath[0] === 'find-or-create') {
      return await findOrCreate(req, employee);
    }

    // POST / - Create site
    if (method === 'POST' && relativePath.length === 0) {
      return await create(req, employee);
    }

    // PUT /:id - Update site
    if (method === 'PUT' && relativePath.length === 1) {
      const id = relativePath[0];
      return await update(req, employee, id);
    }

    // DELETE /:id - Delete site
    if (method === 'DELETE' && relativePath.length === 1) {
      const id = relativePath[0];
      return await deleteSite(req, employee, id);
    }

    return error('Not found', 404);
  } catch (err) {
    const { message, statusCode } = handleError(err);
    return error(message, statusCode);
  }
});

