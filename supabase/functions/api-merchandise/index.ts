/**
 * Merchandise API Edge Function
 * Handles all merchandise CRUD operations and queries
 */

import { handleCORS } from './_shared/cors.ts';
import { error } from './_shared/response.ts';
import { authenticate } from './_shared/auth.ts';
import { handleError } from './_shared/error.ts';
import { list } from './handlers/list.ts';
import { get } from './handlers/get.ts';
import { create } from './handlers/create.ts';
import { update } from './handlers/update.ts';
import { deleteMerchandise } from './handlers/delete.ts';
import { getBySite } from './handlers/getBySite.ts';
import { getByModel } from './handlers/getByModel.ts';

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
    const functionIndex = pathParts.indexOf('api-merchandise');
    const relativePath = functionIndex >= 0 ? pathParts.slice(functionIndex + 1) : [];
    const method = req.method;

    // GET /site/:siteId - Get merchandise by site
    if (method === 'GET' && relativePath[0] === 'site' && relativePath[1]) {
      const siteId = relativePath[1];
      return await getBySite(req, employee, siteId);
    }

    // GET /model/:modelId - Get merchandise by model
    if (method === 'GET' && relativePath[0] === 'model' && relativePath[1]) {
      const modelId = relativePath[1];
      return await getByModel(req, employee, modelId);
    }

    // GET / - List merchandise
    if (method === 'GET' && relativePath.length === 0) {
      return await list(req, employee);
    }

    // GET /:id - Get single merchandise
    if (method === 'GET' && relativePath.length === 1) {
      const id = relativePath[0];
      return await get(req, employee, id);
    }

    // POST / - Create merchandise
    if (method === 'POST' && relativePath.length === 0) {
      return await create(req, employee);
    }

    // PUT /:id - Update merchandise
    if (method === 'PUT' && relativePath.length === 1) {
      const id = relativePath[0];
      return await update(req, employee, id);
    }

    // DELETE /:id - Delete merchandise
    if (method === 'DELETE' && relativePath.length === 1) {
      const id = relativePath[0];
      return await deleteMerchandise(req, employee, id);
    }

    return error('Not found', 404);
  } catch (err) {
    const { message, statusCode } = handleError(err);
    return error(message, statusCode);
  }
});

