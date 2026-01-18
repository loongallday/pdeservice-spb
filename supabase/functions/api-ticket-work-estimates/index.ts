/**
 * @fileoverview Ticket Work Estimates API Edge Function - Duration estimation
 * @module api-ticket-work-estimates
 *
 * @description
 * Manages estimated work duration for tickets.
 * Used in route optimization to calculate realistic ETAs.
 *
 * Work estimates help planners:
 * - Calculate realistic technician schedules
 * - Account for on-site work time in route optimization
 * - Track historical work duration patterns
 *
 * @endpoints
 * ## Work Estimate Operations
 * - GET    /ticket/:ticketId  - Get estimate by ticket ID
 * - GET    /:id               - Get estimate by ID
 * - POST   /                  - Create estimate
 * - POST   /upsert            - Create or update estimate
 * - POST   /bulk              - Bulk create/update
 * - PUT    /:id               - Update estimate
 * - DELETE /:id               - Delete by ID
 * - DELETE /ticket/:ticketId  - Delete by ticket ID
 *
 * @auth Level 1+ required (planners/approvers)
 * @table child_ticket_work_estimates - Work duration estimates
 * @table main_tickets - Related tickets
 */

import { handleCORS } from '../_shared/cors.ts';
import { authenticate, requireMinLevel } from '../_shared/auth.ts';
import { error } from '../_shared/response.ts';
import { handleError } from '../_shared/error.ts';
import { handleCreate, handleUpsert } from './handlers/create.ts';
import { handleGetById, handleGetByTicket } from './handlers/get.ts';
import { handleUpdate } from './handlers/update.ts';
import { handleDelete, handleDeleteByTicket } from './handlers/delete.ts';
import { handleBulk } from './handlers/bulk.ts';

Deno.serve(async (req) => {
  // Handle CORS preflight
  const corsResponse = handleCORS(req);
  if (corsResponse) return corsResponse;

  try {
    // Authenticate user
    const { employee } = await authenticate(req);

    // Require level 1+ (planners/approvers)
    await requireMinLevel(employee, 1);

    // Route to appropriate handler
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const functionIndex = pathParts.indexOf('api-ticket-work-estimates');
    const relativePath = functionIndex >= 0 ? pathParts.slice(functionIndex + 1) : [];
    const method = req.method;

    switch (method) {
      case 'GET':
        // GET /ticket/:ticketId - Get by ticket ID
        if (relativePath.length === 2 && relativePath[0] === 'ticket') {
          return await handleGetByTicket(req, employee, relativePath[1]);
        }

        // GET /:id - Get by ID
        if (relativePath.length === 1) {
          return await handleGetById(req, employee, relativePath[0]);
        }
        break;

      case 'POST':
        // POST /upsert - Upsert
        if (relativePath.length === 1 && relativePath[0] === 'upsert') {
          return await handleUpsert(req, employee);
        }

        // POST /bulk - Bulk create/update
        if (relativePath.length === 1 && relativePath[0] === 'bulk') {
          return await handleBulk(req, employee);
        }

        // POST / - Create
        if (relativePath.length === 0) {
          return await handleCreate(req, employee);
        }
        break;

      case 'PUT':
        // PUT /:id - Update
        if (relativePath.length === 1) {
          return await handleUpdate(req, employee, relativePath[0]);
        }
        break;

      case 'DELETE':
        // DELETE /ticket/:ticketId - Delete by ticket ID
        if (relativePath.length === 2 && relativePath[0] === 'ticket') {
          return await handleDeleteByTicket(req, employee, relativePath[1]);
        }

        // DELETE /:id - Delete by ID
        if (relativePath.length === 1) {
          return await handleDelete(req, employee, relativePath[0]);
        }
        break;
    }

    return error('ไม่พบ endpoint ที่ระบุ', 404);
  } catch (err) {
    const { message, statusCode } = handleError(err);
    return error(message, statusCode);
  }
});
