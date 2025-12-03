/**
 * Sites API Edge Function
 * Handles all site CRUD operations
 */

import { handleCORS } from './_shared/cors.ts';
import { error } from './_shared/response.ts';
import { authenticate } from './_shared/auth.ts';
import { handleError } from './_shared/error.ts';
import { getById } from './handlers/getById.ts';
import { globalSearch } from './handlers/globalSearch.ts';
import { hint } from './handlers/hint.ts';
import { create } from './handlers/create.ts';
import { createOrReplace } from './handlers/createOrReplace.ts';
import { update } from './handlers/update.ts';
import { deleteSite } from './handlers/delete.ts';

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

    switch (method) {
      case "GET":
        // GET /global-search - Global search sites (paginated)
        if (relativePath.length === 1 && relativePath[0] === "global-search") {
          return await globalSearch(req, employee);
        }

        // GET /hint - Get site hints (up to 5 sites)
        if (relativePath.length === 1 && relativePath[0] === "hint") {
          return await hint(req, employee);
        }

        // GET /:id - Get single site
        if (relativePath.length === 1) {
          const id = relativePath[0];
          // Validate it's not a special route
          if (id === 'global-search' || id === 'hint' || id === 'create-or-replace') {
            return error('Not found', 404);
          }
          return await getById(req, employee, id);
        }
        break;

      case "POST":
        // POST /create-or-replace - Create or replace site
        if (relativePath.length === 1 && relativePath[0] === "create-or-replace") {
          return await createOrReplace(req, employee);
        }

        // POST / - Create site
        if (relativePath.length === 0) {
          return await create(req, employee);
        }
        break;

      case "PUT":
        // PUT /:id - Update site
        if (relativePath.length === 1) {
          const id = relativePath[0];
          // Validate it's not a special route
          if (id === 'global-search' || id === 'hint' || id === 'create-or-replace') {
            return error('Not found', 404);
          }
          return await update(req, employee, id);
        }
        break;

      case "DELETE":
        // DELETE /:id - Delete site
        if (relativePath.length === 1) {
          const id = relativePath[0];
          // Validate it's not a special route
          if (id === 'global-search' || id === 'hint' || id === 'create-or-replace') {
            return error('Not found', 404);
          }
          return await deleteSite(req, employee, id);
        }
        break;
    }

    return error('Not found', 404);
  } catch (err) {
    const { message, statusCode } = handleError(err);
    return error(message, statusCode);
  }
});

