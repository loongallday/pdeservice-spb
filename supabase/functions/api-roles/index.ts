/**
 * @fileoverview Roles API Edge Function - Permission role management
 * @module api-roles
 *
 * @description
 * Manages organizational roles with permission levels for access control.
 * Roles define what actions employees can perform in the system.
 *
 * Permission Levels:
 * - 0: Technician L1 (Read-only)
 * - 1: Assigner, PM, Sales (Create/Update)
 * - 2: Admin (User management)
 * - 3: Superadmin (Full access)
 *
 * @endpoints
 * ## Role Operations
 * - GET    /search        - Search roles
 * - GET    /role-summary  - Get all roles with employee counts
 * - GET    /:id           - Get role by ID
 * - POST   /              - Create new role
 * - PUT    /:id           - Update role
 * - DELETE /:id           - Delete role
 *
 * @auth All endpoints require JWT authentication
 * @table main_org_roles - Role data with permission levels
 * @table main_employees - Employee assignments (role_id)
 */

import { handleCORS } from '../_shared/cors.ts';
import { error } from '../_shared/response.ts';
import { authenticate } from '../_shared/auth.ts';
import { handleError } from '../_shared/error.ts';
import { getById } from './handlers/getById.ts';
import { create } from './handlers/create.ts';
import { update } from './handlers/update.ts';
import { deleteRole } from './handlers/delete.ts';
import { search } from './handlers/search.ts';
import { getRoleSummary } from './handlers/roleSummary.ts';

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
    const functionIndex = pathParts.indexOf('api-roles');
    const relativePath = functionIndex >= 0 ? pathParts.slice(functionIndex + 1) : [];
    const method = req.method;

    switch (method) {
      case "GET":
        // GET /search - Search roles
        if (relativePath.length === 1 && relativePath[0] === "search") {
          return await search(req, employee);
        }

        // GET /role-summary - Get role summary with employee counts
        if (relativePath.length === 1 && relativePath[0] === "role-summary") {
          return await getRoleSummary(req, employee);
        }

        // GET /:id - Get single role
        if (relativePath.length === 1) {
          const id = relativePath[0];
          return await getById(req, employee, id);
        }
        break;

      case "POST":
        // POST / - Create role
        if (relativePath.length === 0) {
          return await create(req, employee);
        }
        break;

      case "PUT":
        // PUT /:id - Update role
        if (relativePath.length === 1) {
          const id = relativePath[0];
          return await update(req, employee, id);
        }
        break;

      case "DELETE":
        // DELETE /:id - Delete role
        if (relativePath.length === 1) {
          const id = relativePath[0];
          return await deleteRole(req, employee, id);
        }
        break;
    }

    return error("Not found", 404);
  } catch (err) {
    const { message, statusCode } = handleError(err);
    return error(message, statusCode);
  }
});
