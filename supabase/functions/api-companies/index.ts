/**
 * Companies API Edge Function
 * Handles all company CRUD operations
 */

import { handleCORS } from './_shared/cors.ts';
import { error, success } from './_shared/response.ts';
import { authenticate } from './_shared/auth.ts';
import { handleError } from './_shared/error.ts';
import { list } from './handlers/list.ts';
import { get } from './handlers/get.ts';
import { search } from './handlers/search.ts';
import { create } from './handlers/create.ts';
import { update } from './handlers/update.ts';
import { deleteCompany } from './handlers/delete.ts';
import { findOrCreate } from './handlers/findOrCreate.ts';
import { CompanyService } from './services/companyService.ts';

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

    // GET /search - Search companies
    if (method === 'GET' && relativePath.length === 1 && relativePath[0] === 'search') {
      return await search(req, employee);
    }

    // GET /recent - Get recent companies
    if (method === 'GET' && relativePath.length === 1 && relativePath[0] === 'recent') {
      const limit = parseInt(url.searchParams.get('limit') || '5');
      const companies = await CompanyService.getRecent(limit);
      return success(companies);
    }

    // GET / - List companies
    if (method === 'GET' && relativePath.length === 0) {
      return await list(req, employee);
    }

    // GET /:taxId - Get single company
    if (method === 'GET' && relativePath.length === 1) {
      const taxId = relativePath[0];
      return await get(req, employee, taxId);
    }

    // POST /find-or-create - Find or create company
    if (method === 'POST' && relativePath.length === 1 && relativePath[0] === 'find-or-create') {
      return await findOrCreate(req, employee);
    }

    // POST / - Create company
    if (method === 'POST' && relativePath.length === 0) {
      return await create(req, employee);
    }

    // PUT /:taxId - Update company
    if (method === 'PUT' && relativePath.length === 1) {
      const taxId = relativePath[0];
      // Validate it's not a special route
      if (taxId === 'search' || taxId === 'recent' || taxId === 'find-or-create') {
        return error('Not found', 404);
      }
      return await update(req, employee, taxId);
    }

    // DELETE /:taxId - Delete company
    if (method === 'DELETE' && relativePath.length === 1) {
      const taxId = relativePath[0];
      return await deleteCompany(req, employee, taxId);
    }

    return error('Not found', 404);
  } catch (err) {
    const { message, statusCode } = handleError(err);
    return error(message, statusCode);
  }
});

