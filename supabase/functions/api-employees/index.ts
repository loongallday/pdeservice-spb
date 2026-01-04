/**
 * Employees API Edge Function
 * Handles all employee CRUD operations
 */

import { handleCORS } from '../_shared/cors.ts';
import { error } from '../_shared/response.ts';
import { authenticate } from '../_shared/auth.ts';
import { handleError } from '../_shared/error.ts';
import { getById } from './handlers/getById.ts';
import { create } from './handlers/create.ts';
import { update } from './handlers/update.ts';
import { deleteEmployee } from './handlers/delete.ts';
import { linkAuth } from './handlers/linkAuth.ts';
import { linkExistingAuth } from './handlers/linkExistingAuth.ts';
import { unlinkAuth } from './handlers/unlinkAuth.ts';
import { networkSearch } from './handlers/networkSearch.ts';
import { getEmployeeSummary } from './handlers/employeeSummary.ts';
import { getTechnicianAvailability } from './handlers/technicianAvailability.ts';

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

    switch (method) {
      case "GET":
        // GET /technicians/availability - Get technicians with availability
        if (relativePath.length === 2 && relativePath[0] === "technicians" && relativePath[1] === "availability") {
          return await getTechnicianAvailability(req, employee);
        }

        // GET /network-search - Network search employees (for employee management)
        if (relativePath.length === 1 && relativePath[0] === "network-search") {
          return await networkSearch(req, employee);
        }

        // GET /employee-summary - Get employee summary
        if (relativePath.length === 1 && relativePath[0] === "employee-summary") {
          return await getEmployeeSummary(req, employee);
        }

        // GET /:id - Get single employee
        if (relativePath.length === 1) {
          const id = relativePath[0];
          return await getById(req, employee, id);
        }
        break;

      case "POST":
        // POST / - Create employee
        if (relativePath.length === 0) {
          return await create(req, employee);
        }

        // POST /:id/link-auth - Link auth account
        if (relativePath.length === 2 && relativePath[1] === "link-auth") {
          const id = relativePath[0];
          return await linkAuth(req, employee, id);
        }

        // POST /:id/link-existing-auth - Link existing auth account
        if (relativePath.length === 2 && relativePath[1] === "link-existing-auth") {
          const id = relativePath[0];
          return await linkExistingAuth(req, employee, id);
        }

        // POST /:id/unlink-auth - Unlink auth account
        if (relativePath.length === 2 && relativePath[1] === "unlink-auth") {
          const id = relativePath[0];
          return await unlinkAuth(req, employee, id);
        }
        break;

      case "PUT":
        // PUT /:id - Update employee
        if (relativePath.length === 1) {
          const id = relativePath[0];
          return await update(req, employee, id);
        }
        break;

      case "DELETE":
        // DELETE /:id - Delete employee
        if (relativePath.length === 1) {
          const id = relativePath[0];
          return await deleteEmployee(req, employee, id);
        }
        break;
    }

    return error("Not found", 404);
  } catch (err) {
    const { message, statusCode } = handleError(err);
    return error(message, statusCode);
  }
});

