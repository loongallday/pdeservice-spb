/**
 * @fileoverview Employees API Edge Function
 * @module api-employees
 *
 * Handles all employee CRUD operations, authentication linking, search,
 * and gamification features (achievements) for the Field Service Management system.
 *
 * @endpoints
 * GET:
 * - GET    /                              - Search/list employees (paginated, admin-level)
 * - GET    /:id                           - Get single employee by ID
 * - GET    /network-search                - Network search (for user management UI)
 * - GET    /employee-summary              - Lightweight list for dropdowns
 * - GET    /technicians/availability      - Get technician workload for a date
 * - GET    /achievements/progress         - Get current user's achievement progress
 * - GET    /achievements/coupons          - Get current user's earned coupons
 *
 * POST:
 * - POST   /                              - Create new employee
 * - POST   /:id/link-auth                 - Create and link new auth account
 * - POST   /:id/link-existing-auth        - Link existing auth account
 * - POST   /:id/unlink-auth               - Unlink auth account
 * - POST   /achievements/track            - Track an achievement action
 *
 * PUT:
 * - PUT    /:id                           - Update employee
 *
 * DELETE:
 * - DELETE /:id                           - Soft delete employee (set is_active=false)
 *
 * @auth All endpoints require JWT authentication
 * @see types.ts for TypeScript interfaces
 * @see services/employeeService.ts for employee business logic
 * @see services/achievementService.ts for gamification logic
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
import { search } from './handlers/search.ts';
import { networkSearch } from './handlers/networkSearch.ts';
import { getEmployeeSummary } from './handlers/employeeSummary.ts';
import { getTechnicianAvailability } from './handlers/technicianAvailability.ts';
// Achievement add-on handlers
import { achievementTrack } from './handlers/achievementTrack.ts';
import { achievementProgress } from './handlers/achievementProgress.ts';
import { achievementCoupons } from './handlers/achievementCoupons.ts';

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

        // GET /achievements/progress - Get employee's achievement progress
        if (relativePath.length === 2 && relativePath[0] === "achievements" && relativePath[1] === "progress") {
          return await achievementProgress(req, employee);
        }

        // GET /achievements/coupons - Get employee's coupons
        if (relativePath.length === 2 && relativePath[0] === "achievements" && relativePath[1] === "coupons") {
          return await achievementCoupons(req, employee);
        }

        // GET /network-search - Network search employees (for employee management)
        if (relativePath.length === 1 && relativePath[0] === "network-search") {
          return await networkSearch(req, employee);
        }

        // GET /employee-summary - Get employee summary
        if (relativePath.length === 1 && relativePath[0] === "employee-summary") {
          return await getEmployeeSummary(req, employee);
        }

        // GET / - Search/list employees with full filters (admin-level search)
        if (relativePath.length === 0) {
          return await search(req, employee);
        }

        // GET /:id - Get single employee
        if (relativePath.length === 1) {
          const id = relativePath[0];
          return await getById(req, employee, id);
        }
        break;

      case "POST":
        // POST /achievements/track - Track an achievement action
        if (relativePath.length === 2 && relativePath[0] === "achievements" && relativePath[1] === "track") {
          return await achievementTrack(req, employee);
        }

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

