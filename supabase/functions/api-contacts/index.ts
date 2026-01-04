/**
 * Contacts API Edge Function
 * Handles all contact CRUD operations
 */

import { handleCORS } from '../_shared/cors.ts';
import { error } from '../_shared/response.ts';
import { authenticate } from '../_shared/auth.ts';
import { handleError } from '../_shared/error.ts';
import { list } from './handlers/list.ts';
import { get } from './handlers/get.ts';
import { getBySite } from './handlers/getBySite.ts';
import { search } from './handlers/search.ts';
import { create } from './handlers/create.ts';
import { update } from './handlers/update.ts';
import { deleteContact } from './handlers/delete.ts';

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
    const functionIndex = pathParts.indexOf('api-contacts');
    const relativePath = functionIndex >= 0 ? pathParts.slice(functionIndex + 1) : [];
    const method = req.method;

    // GET /list - List contacts (explicit path)
    if (method === 'GET' && relativePath.length === 1 && relativePath[0] === 'list') {
      return await list(req, employee);
    }

    // GET /search - Search contacts
    if (method === 'GET' && relativePath.length === 1 && relativePath[0] === 'search') {
      return await search(req, employee);
    }

    // GET /site/:siteId - Get contacts by site
    if (method === 'GET' && relativePath.length === 2 && relativePath[0] === 'site') {
      const siteId = relativePath[1];
      return await getBySite(req, employee, siteId);
    }

    // GET /:id - Get single contact by ID (must be UUID format)
    // This should come after all other specific routes
    if (method === 'GET' && relativePath.length === 1) {
      const id = relativePath[0];
      // Validate it looks like a UUID to avoid conflicts
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const isUUID = uuidRegex.test(id);
      
      if (isUUID) {
        return await get(req, employee, id);
      }
      // If not a UUID, fall through to 404
    }

    // GET / - List contacts (fallback for backward compatibility)
    if (method === 'GET' && relativePath.length === 0) {
      return await list(req, employee);
    }

    // POST / - Create contact
    if (method === 'POST' && relativePath.length === 0) {
      return await create(req, employee);
    }

    // PUT /:id - Update contact
    if (method === 'PUT' && relativePath.length === 1) {
      const id = relativePath[0];
      return await update(req, employee, id);
    }

    // DELETE /:id - Delete contact
    if (method === 'DELETE' && relativePath.length === 1) {
      const id = relativePath[0];
      return await deleteContact(req, employee, id);
    }

    return error('Not found', 404);
  } catch (err) {
    const { message, statusCode } = handleError(err);
    return error(message, statusCode);
  }
});
