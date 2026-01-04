/**
 * Departments API Edge Function
 * Handles all department CRUD operations
 */

import { handleCORS } from "../_shared/cors.ts";
import { error } from "../_shared/response.ts";
import { authenticate } from "../_shared/auth.ts";
import { handleError } from "../_shared/error.ts";
import { create } from "./handlers/create.ts";
import { update } from "./handlers/update.ts";
import { deleteDepartment } from "./handlers/delete.ts";
import { search } from "./handlers/search.ts";
import { getById } from "./handlers/getById.ts";
import { getDepartmentSummary } from "./handlers/departmentSummary.ts";

Deno.serve(async (req) => {
  // Handle CORS preflight
  const corsResponse = handleCORS(req);
  if (corsResponse) return corsResponse;

  try {
    // Authenticate user
    const { employee } = await authenticate(req);

    // Route to appropriate handler
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/").filter(Boolean);
    // Find the function name in the path and slice after it
    const functionIndex = pathParts.indexOf("api-departments");
    const relativePath = functionIndex >= 0
      ? pathParts.slice(functionIndex + 1)
      : [];
    const method = req.method;

    switch (method) {
      case "GET":
        // GET /search - Search departments
        if (relativePath.length === 1 && relativePath[0] === "search") {
          return await search(req, employee);
        }

        // GET /department-summary - Get department summary with employee counts
        if (relativePath.length === 1 && relativePath[0] === "department-summary") {
          return await getDepartmentSummary(req, employee);
        }

        // GET /:id - Get single department
        if (relativePath.length === 1) {
          const id = relativePath[0];
          return await getById(req, employee, id);
        }
        break;

      case "POST":
        // POST / - Create department
        if (relativePath.length === 0) {
          return await create(req, employee);
        }
        break;

      case "PUT":
        // PUT /:id - Update department
        if (relativePath.length === 1) {
          const id = relativePath[0];
          return await update(req, employee, id);
        }
        break;

      case "DELETE":
        // DELETE /:id - Delete department
        if (relativePath.length === 1) {
          const id = relativePath[0];
          return await deleteDepartment(req, employee, id);
        }
        break;
    }

    return error("Not found", 404);
  } catch (err) {
    const { message, statusCode } = handleError(err);
    return error(message, statusCode);
  }
});
