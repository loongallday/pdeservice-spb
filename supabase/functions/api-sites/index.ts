/**
 * @fileoverview Sites API Edge Function - Customer location management
 * @module api-sites
 *
 * @description
 * Manages customer sites (locations) including CRUD operations, search, and comments.
 * Sites are linked to companies and contain Thai administrative location data
 * (province, district, sub-district codes).
 *
 * @endpoints
 * ## Site Operations
 * - GET    /global-search              - Search sites (paginated)
 * - GET    /hint                       - Quick search (up to 5 results)
 * - GET    /:id                        - Get site by ID
 * - POST   /                           - Create new site
 * - POST   /create-or-replace          - Upsert site
 * - PUT    /:id                        - Update site
 * - DELETE /:id                        - Delete site
 *
 * ## Comments
 * - GET    /:id/comments               - Get site comments
 * - POST   /:id/comments               - Add comment
 * - PUT    /:id/comments/:commentId    - Update comment
 * - DELETE /:id/comments/:commentId    - Delete comment
 *
 * @auth All endpoints require JWT authentication
 * @table main_sites - Primary site data
 * @table child_site_comments - Site comments (1:N)
 * @table child_site_contacts - Site contacts (1:N)
 */

import { handleCORS } from '../_shared/cors.ts';
import { error } from '../_shared/response.ts';
import { authenticate } from '../_shared/auth.ts';
import { handleError } from '../_shared/error.ts';
import { getById } from './handlers/getById.ts';
import { globalSearch } from './handlers/globalSearch.ts';
import { hint } from './handlers/hint.ts';
import { create } from './handlers/create.ts';
import { createOrReplace } from './handlers/createOrReplace.ts';
import { update } from './handlers/update.ts';
import { deleteSite } from './handlers/delete.ts';
import { getComments, createComment, updateComment, deleteComment } from './handlers/comments.ts';

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

        // GET /:id/comments - Get comments for a site
        if (relativePath.length === 2 && relativePath[1] === 'comments') {
          const id = relativePath[0];
          return await getComments(req, employee, id);
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

        // POST /:id/comments - Create a comment for a site
        if (relativePath.length === 2 && relativePath[1] === 'comments') {
          const id = relativePath[0];
          return await createComment(req, employee, id);
        }

        // POST / - Create site
        if (relativePath.length === 0) {
          return await create(req, employee);
        }
        break;

      case "PUT":
        // PUT /:id/comments/:commentId - Update a comment
        if (relativePath.length === 3 && relativePath[1] === 'comments') {
          const siteId = relativePath[0];
          const commentId = relativePath[2];
          return await updateComment(req, employee, siteId, commentId);
        }

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
        // DELETE /:id/comments/:commentId - Delete a comment
        if (relativePath.length === 3 && relativePath[1] === 'comments') {
          const siteId = relativePath[0];
          const commentId = relativePath[2];
          return await deleteComment(req, employee, siteId, commentId);
        }

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

