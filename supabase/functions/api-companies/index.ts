/**
 * Companies API Edge Function
 * Handles all company CRUD operations
 */

import { handleCORS } from '../_shared/cors.ts';
import { error } from '../_shared/response.ts';
import { authenticate } from '../_shared/auth.ts';
import { handleError } from '../_shared/error.ts';
import { getById } from './handlers/getById.ts';
import { globalSearch } from './handlers/globalSearch.ts';
import { hint } from './handlers/hint.ts';
import { create } from './handlers/create.ts';
import { update } from './handlers/update.ts';
import { deleteCompany } from './handlers/delete.ts';
import { createOrUpdate } from './handlers/createOrUpdate.ts';
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
    const functionIndex = pathParts.indexOf('api-companies');
    const relativePath = functionIndex >= 0 ? pathParts.slice(functionIndex + 1) : [];
    const method = req.method;

    switch (method) {
      case "GET":
        // GET /global-search - Global search companies (paginated)
        if (relativePath.length === 1 && relativePath[0] === "global-search") {
          return await globalSearch(req, employee);
        }

        // GET /hint - Get company hints (up to 5 companies)
        if (relativePath.length === 1 && relativePath[0] === "hint") {
          return await hint(req, employee);
        }

        // GET /:id/comments - Get comments for a company
        if (relativePath.length === 2 && relativePath[1] === 'comments') {
          const id = relativePath[0];
          return await getComments(req, employee, id);
        }

        // GET /:id - Get single company
        if (relativePath.length === 1) {
          const id = relativePath[0];
          // Validate it's not a special route
          if (id === 'global-search' || id === 'hint' || id === 'create-or-update') {
            return error('Not found', 404);
          }
          return await getById(req, employee, id);
        }
        break;

      case "POST":
        // POST /create-or-update - Create or update company
        if (relativePath.length === 1 && relativePath[0] === "create-or-update") {
          return await createOrUpdate(req, employee);
        }

        // POST /:id/comments - Create a comment for a company
        if (relativePath.length === 2 && relativePath[1] === 'comments') {
          const id = relativePath[0];
          return await createComment(req, employee, id);
        }

        // POST / - Create company
        if (relativePath.length === 0) {
          return await create(req, employee);
        }
        break;

      case "PUT":
        // PUT /:id/comments/:commentId - Update a comment
        if (relativePath.length === 3 && relativePath[1] === 'comments') {
          const companyId = relativePath[0];
          const commentId = relativePath[2];
          return await updateComment(req, employee, companyId, commentId);
        }

        // PUT /:id - Update company
        if (relativePath.length === 1) {
          const id = relativePath[0];
          // Validate it's not a special route
          if (id === 'global-search' || id === 'hint' || id === 'create-or-update') {
            return error('Not found', 404);
          }
          return await update(req, employee, id);
        }
        break;

      case "DELETE":
        // DELETE /:id/comments/:commentId - Delete a comment
        if (relativePath.length === 3 && relativePath[1] === 'comments') {
          const companyId = relativePath[0];
          const commentId = relativePath[2];
          return await deleteComment(req, employee, companyId, commentId);
        }

        // DELETE /:id - Delete company
        if (relativePath.length === 1) {
          const id = relativePath[0];
          // Validate it's not a special route
          if (id === 'global-search' || id === 'hint' || id === 'create-or-update') {
            return error('Not found', 404);
          }
          return await deleteCompany(req, employee, id);
        }
        break;
    }

    return error('Not found', 404);
  } catch (err) {
    const { message, statusCode } = handleError(err);
    return error(message, statusCode);
  }
});

