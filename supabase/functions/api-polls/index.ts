/**
 * Polls API Edge Function
 * Handles all poll CRUD operations and voting
 */

import { handleCORS } from './_shared/cors.ts';
import { error } from './_shared/response.ts';
import { authenticate } from './_shared/auth.ts';
import { handleError } from './_shared/error.ts';
import { list } from './handlers/list.ts';
import { get } from './handlers/get.ts';
import { create } from './handlers/create.ts';
import { update } from './handlers/update.ts';
import { deletePoll } from './handlers/delete.ts';
import { vote } from './handlers/vote.ts';

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
    const functionIndex = pathParts.indexOf('api-polls');
    const relativePath = functionIndex >= 0 ? pathParts.slice(functionIndex + 1) : [];
    const method = req.method;

    // GET / - List polls
    if (method === 'GET' && relativePath.length === 0) {
      return await list(req, employee);
    }

    // GET /:id - Get single poll
    if (method === 'GET' && relativePath.length === 1 && relativePath[0] !== 'results') {
      const id = relativePath[0];
      return await get(req, employee, id);
    }

    // POST / - Create poll
    if (method === 'POST' && relativePath.length === 0) {
      return await create(req, employee);
    }

    // POST /:id/vote - Vote on poll
    if (method === 'POST' && relativePath.length === 2 && relativePath[1] === 'vote') {
      const pollId = relativePath[0];
      return await vote(req, employee, pollId);
    }

    // PUT /:id - Update poll
    if (method === 'PUT' && relativePath.length === 1) {
      const id = relativePath[0];
      return await update(req, employee, id);
    }

    // DELETE /:id - Delete poll
    if (method === 'DELETE' && relativePath.length === 1) {
      const id = relativePath[0];
      return await deletePoll(req, employee, id);
    }

    return error('Not found', 404);
  } catch (err) {
    const { message, statusCode } = handleError(err);
    return error(message, statusCode);
  }
});
