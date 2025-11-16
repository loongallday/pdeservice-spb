/**
 * Employees API Edge Function
 * Handles all employee CRUD operations
 */

import { handleCORS } from './_shared/cors.ts';
import { error } from './_shared/response.ts';
import { authenticate } from './_shared/auth.ts';
import { handleError } from './_shared/error.ts';
import { list } from './handlers/list.ts';
import { get } from './handlers/get.ts';
import { getByCode } from './handlers/getByCode.ts';
import { getByRole } from './handlers/getByRole.ts';
import { create } from './handlers/create.ts';
import { update } from './handlers/update.ts';
import { deleteEmployee } from './handlers/delete.ts';
import { linkAuth } from './handlers/linkAuth.ts';
import { linkExistingAuth } from './handlers/linkExistingAuth.ts';
import { unlinkAuth } from './handlers/unlinkAuth.ts';

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
    const functionIndex = pathParts.indexOf('api-employees');
    const relativePath = functionIndex >= 0 ? pathParts.slice(functionIndex + 1) : [];
    const method = req.method;

    // GET / - List employees
    if (method === 'GET' && relativePath.length === 0) {
      return await list(req, employee);
    }

    // GET /code/:code - Get employee by code
    if (method === 'GET' && relativePath.length === 2 && relativePath[0] === 'code') {
      const code = relativePath[1];
      return await getByCode(req, employee, code);
    }

    // GET /role/:role - Get employees by role
    if (method === 'GET' && relativePath.length === 2 && relativePath[0] === 'role') {
      const role = relativePath[1];
      return await getByRole(req, employee, role);
    }

    // GET /:id - Get single employee
    if (method === 'GET' && relativePath.length === 1) {
      const id = relativePath[0];
      return await get(req, employee, id);
    }

    // POST / - Create employee
    if (method === 'POST' && relativePath.length === 0) {
      return await create(req, employee);
    }

    // POST /:id/link-auth - Link auth account
    if (method === 'POST' && relativePath.length === 2 && relativePath[1] === 'link-auth') {
      const id = relativePath[0];
      return await linkAuth(req, employee, id);
    }

    // POST /:id/link-existing-auth - Link existing auth account
    if (method === 'POST' && relativePath.length === 2 && relativePath[1] === 'link-existing-auth') {
      const id = relativePath[0];
      return await linkExistingAuth(req, employee, id);
    }

    // POST /:id/unlink-auth - Unlink auth account
    if (method === 'POST' && relativePath.length === 2 && relativePath[1] === 'unlink-auth') {
      const id = relativePath[0];
      return await unlinkAuth(req, employee, id);
    }

    // PUT /:id - Update employee
    if (method === 'PUT' && relativePath.length === 1) {
      const id = relativePath[0];
      return await update(req, employee, id);
    }

    // DELETE /:id - Delete employee
    if (method === 'DELETE' && relativePath.length === 1) {
      const id = relativePath[0];
      return await deleteEmployee(req, employee, id);
    }

    return error('Not found', 404);
  } catch (err) {
    const { message, statusCode } = handleError(err);
    return error(message, statusCode);
  }
});

