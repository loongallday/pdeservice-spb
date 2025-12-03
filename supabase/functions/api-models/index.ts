/**
 * Models API Edge Function
 * Handles model search and creation operations
 */

import { handleCORS } from './_shared/cors.ts';
import { error } from './_shared/response.ts';
import { authenticate } from './_shared/auth.ts';
import { handleError } from './_shared/error.ts';
import { search } from './handlers/search.ts';
import { create } from './handlers/create.ts';

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
    const functionIndex = pathParts.indexOf('api-models');
    const relativePath = functionIndex >= 0 ? pathParts.slice(functionIndex + 1) : [];
    const method = req.method;

    // Route based on method and path
    switch (method) {
      case 'GET':
        // GET /search - Search models by description and code
        if (relativePath.length === 1 && relativePath[0] === 'search') {
          return await search(req, employee);
        }
        break;

      case 'POST':
        // POST / - Create model
        if (relativePath.length === 0) {
          return await create(req, employee);
        }
        break;
    }

    return error('Not found', 404);
  } catch (err) {
    const { message, statusCode } = handleError(err);
    return error(message, statusCode);
  }
});

