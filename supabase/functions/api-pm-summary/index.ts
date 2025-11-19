/**
 * PM Summary API Edge Function
 * Provides PM summary and analysis for merchandise
 */

import { handleCORS } from './_shared/cors.ts';
import { error } from './_shared/response.ts';
import { authenticate } from './_shared/auth.ts';
import { handleError } from './_shared/error.ts';
import { getSummary } from './handlers/getSummary.ts';
import { getMerchandiseSummary } from './handlers/getMerchandiseSummary.ts';
import { getPMLogs } from './handlers/getPMLogs.ts';

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
    const functionIndex = pathParts.indexOf('api-pm-summary');
    const relativePath = functionIndex >= 0 ? pathParts.slice(functionIndex + 1) : [];
    const method = req.method;

    // GET /:merchandiseId/logs - Get PM logs for specific merchandise
    if (method === 'GET' && relativePath.length === 2 && relativePath[1] === 'logs') {
      const merchandiseId = relativePath[0];
      return await getPMLogs(req, employee, merchandiseId);
    }

    // GET /:id - Get single merchandise summary
    if (method === 'GET' && relativePath.length === 1) {
      const id = relativePath[0];
      return await getMerchandiseSummary(req, employee, id);
    }

    // GET / - Get PM summary (all merchandise with filters)
    if (method === 'GET' && relativePath.length === 0) {
      return await getSummary(req, employee);
    }

    return error('Not found', 404);
  } catch (err) {
    const { message, statusCode } = handleError(err);
    return error(message, statusCode);
  }
});

