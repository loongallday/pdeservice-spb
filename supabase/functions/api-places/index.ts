/**
 * Places API Edge Function
 * Proxy for Google Places API with location code matching
 */

import { handleCORS } from '../_shared/cors.ts';
import { error } from '../_shared/response.ts';
import { authenticate } from '../_shared/auth.ts';
import { handleError } from '../_shared/error.ts';
import { autocomplete } from './handlers/autocomplete.ts';
import { details } from './handlers/details.ts';

Deno.serve(async (req) => {
  try {
    // Handle CORS preflight
    const corsResponse = handleCORS(req);
    if (corsResponse) return corsResponse;

    // Authenticate user
    const { employee } = await authenticate(req);

    // Route to appropriate handler
    let url: URL;
    try {
      url = new URL(req.url);
    } catch (_err) {
      return error('Invalid URL', 400);
    }

    const pathParts = url.pathname.split('/').filter(Boolean);
    const functionIndex = pathParts.indexOf('api-places');
    const relativePath = functionIndex >= 0 ? pathParts.slice(functionIndex + 1) : [];
    const method = req.method;

    // Only POST methods allowed
    if (method !== 'POST') {
      return error('Method not allowed', 405);
    }

    // Route based on path
    switch (relativePath[0]) {
      case 'autocomplete':
        return await autocomplete(req, employee);

      case 'details':
        return await details(req, employee);

      default:
        return error('ไม่พบ endpoint', 404);
    }
  } catch (err) {
    console.error('api-places error:', err);
    const { message, statusCode } = handleError(err);
    return error(message, statusCode);
  }
});
