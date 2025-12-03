/**
 * Merchandise API Edge Function
 * Handles merchandise CRUD operations and search
 */

import { handleCORS } from './_shared/cors.ts';
import { error } from './_shared/response.ts';
import { authenticate } from './_shared/auth.ts';
import { handleError } from './_shared/error.ts';
import { get } from './handlers/get.ts';
import { create } from './handlers/create.ts';
import { update } from './handlers/update.ts';
import { deleteMerchandise } from './handlers/delete.ts';
import { search } from './handlers/search.ts';
import { hint } from './handlers/hint.ts';
import { checkDuplicate } from './handlers/checkDuplicate.ts';

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

    // Route based on method and path
    switch (method) {
      case 'GET':
        // GET /check-duplicate - Check for duplicate serial number
        if (relativePath.length === 1 && relativePath[0] === 'check-duplicate') {
          return await checkDuplicate(req, employee);
        }
        // GET /hint - Get merchandise hints (up to 5 merchandise)
        if (relativePath.length === 1 && relativePath[0] === 'hint') {
          return await hint(req, employee);
        }
        // GET /search - Search merchandise
        if (relativePath.length === 1 && relativePath[0] === 'search') {
          return await search(req, employee);
        }
        // GET /:id - Get single merchandise by ID
        if (relativePath.length === 1) {
          const id = relativePath[0];
          // Prevent special keywords from being treated as IDs
          if (['hint', 'search', 'check-duplicate'].includes(id)) {
            return error('Not found', 404);
          }
          return await get(req, employee, id);
        }
        break;

      case 'POST':
        // POST / - Create merchandise
        if (relativePath.length === 0) {
          return await create(req, employee);
        }
        break;

      case 'PUT':
        // PUT /:id - Update merchandise
        if (relativePath.length === 1) {
          const id = relativePath[0];
          return await update(req, employee, id);
        }
        break;

      case 'DELETE':
        // DELETE /:id - Delete merchandise
        if (relativePath.length === 1) {
          const id = relativePath[0];
          return await deleteMerchandise(req, employee, id);
        }
        break;
    }

    return error('Not found', 404);
  } catch (err) {
    const { message, statusCode } = handleError(err);
    return error(message, statusCode);
  }
});

