/**
 * Prize Lottery API
 * Main entry point for prize management and assignment operations
 */

import { handleCORS } from './_shared/cors.ts';
import { handleError } from './_shared/error.ts';
import { error } from './_shared/response.ts';

// Import handlers
import { handleList } from './handlers/list.ts';
import { handleGet } from './handlers/get.ts';
import { handleCreate } from './handlers/create.ts';
import { handleUpdate } from './handlers/update.ts';
import { handleDelete } from './handlers/delete.ts';
import { handleListWinners } from './handlers/listWinners.ts';
import { handleAssignPrize } from './handlers/assignPrize.ts';
import { handleUnassignPrize } from './handlers/unassignPrize.ts';

Deno.serve(async (req) => {
  // Handle CORS preflight
  const corsResponse = handleCORS(req);
  if (corsResponse) return corsResponse;

  try {
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    // Find the function name in the path and slice after it
    const functionIndex = pathParts.indexOf('api-prizes');
    const relativePath = functionIndex >= 0 ? pathParts.slice(functionIndex + 1) : [];
    const method = req.method;

    // GET /api-prizes - List all prizes
    if (method === 'GET' && relativePath.length === 0) {
      return await handleList(req);
    }

    // GET /api-prizes/winners - List winners (prize assignments)
    if (method === 'GET' && relativePath.length === 1 && relativePath[0] === 'winners') {
      return await handleListWinners(req);
    }

    // GET /api-prizes/:id - Get prize by ID
    if (method === 'GET' && relativePath.length === 1) {
      return await handleGet(req, relativePath[0]);
    }

    // POST /api-prizes - Create new prize
    if (method === 'POST' && relativePath.length === 0) {
      return await handleCreate(req);
    }

    // POST /api-prizes/:prizeId/assign - Assign prize to user
    if (method === 'POST' && relativePath.length === 2 && relativePath[1] === 'assign') {
      return await handleAssignPrize(req, relativePath[0]);
    }

    // PUT /api-prizes/:id - Update prize
    if (method === 'PUT' && relativePath.length === 1) {
      return await handleUpdate(req, relativePath[0]);
    }

    // DELETE /api-prizes/:id - Delete prize
    if (method === 'DELETE' && relativePath.length === 1) {
      return await handleDelete(req, relativePath[0]);
    }

    // DELETE /api-prizes/:prizeId/unassign/:userId - Unassign prize from user
    if (method === 'DELETE' && relativePath.length === 3 && relativePath[1] === 'unassign') {
      return await handleUnassignPrize(req, relativePath[0], relativePath[2]);
    }

    // No matching route
    return error('ไม่พบ API endpoint ที่ระบุ', 404);
  } catch (err) {
    console.error('Unhandled error:', err);
    const { message, statusCode } = handleError(err);
    return error(message, statusCode);
  }
});
