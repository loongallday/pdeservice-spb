/**
 * @fileoverview Appointments API Edge Function
 * @module api-appointments
 *
 * Handles all appointment CRUD operations for the Field Service Management system.
 * Appointments are scheduled visits linked to tickets via main_tickets.appointment_id.
 *
 * @endpoints
 * - GET    /                    - List all appointments (paginated)
 * - GET    /search              - Search appointments by type
 * - GET    /ticket/:ticketId    - Get appointment linked to a ticket
 * - GET    /:id                 - Get single appointment by ID
 * - POST   /                    - Create new appointment
 * - POST   /approve             - Approve/unapprove appointment (approvers only)
 * - PUT    /:id                 - Update appointment
 * - DELETE /:id                 - Delete appointment
 *
 * @auth All endpoints require JWT authentication
 * @see types.ts for TypeScript interfaces
 * @see services/appointmentService.ts for business logic
 */

import { handleCORS, corsHeaders } from '../_shared/cors.ts';
import { error } from '../_shared/response.ts';
import { authenticate } from '../_shared/auth.ts';
import { handleError } from '../_shared/error.ts';
import { list } from './handlers/list.ts';
import { get } from './handlers/get.ts';
import { getByTicket } from './handlers/getByTicket.ts';
import { create } from './handlers/create.ts';
import { update } from './handlers/update.ts';
import { deleteAppointment } from './handlers/delete.ts';
import { search } from './handlers/search.ts';
import { approve } from './handlers/approve.ts';

Deno.serve(async (req) => {
  // Handle CORS preflight - MUST be ABSOLUTE FIRST, before ANY other code
  // This ensures OPTIONS requests always succeed, even if there's an error later
  const corsResponse = handleCORS(req);
  if (corsResponse) return corsResponse;

  try {
    // Authenticate user via JWT
    const { employee } = await authenticate(req);

    // Parse URL and extract path segments
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    // Find the function name in the path and slice after it
    const functionIndex = pathParts.indexOf('api-appointments');
    const relativePath = functionIndex >= 0 ? pathParts.slice(functionIndex + 1) : [];
    const method = req.method;

    // Route to appropriate handler
    // NOTE: Order matters - specific routes must come before parameterized routes

    // GET /ticket/:ticketId - Get appointment by ticket ID
    if (method === 'GET' && relativePath[0] === 'ticket' && relativePath[1]) {
      const ticketId = relativePath[1];
      return await getByTicket(req, employee, ticketId);
    }

    // GET / - List appointments
    if (method === 'GET' && relativePath.length === 0) {
      return await list(req, employee);
    }

    // GET /search - Search appointments
    if (method === 'GET' && relativePath.length === 1 && relativePath[0] === 'search') {
      return await search(req, employee);
    }

    // GET /:id - Get single appointment
    if (method === 'GET' && relativePath.length === 1) {
      const id = relativePath[0];
      return await get(req, employee, id);
    }

    // POST /approve - Approve appointment (check before generic POST)
    if (method === 'POST' && relativePath.length === 1 && relativePath[0] === 'approve') {
      return await approve(req, employee);
    }

    // POST / - Create appointment
    if (method === 'POST' && relativePath.length === 0) {
      return await create(req, employee);
    }

    // PUT /:id - Update appointment
    if (method === 'PUT' && relativePath.length === 1) {
      const id = relativePath[0];
      return await update(req, employee, id);
    }

    // DELETE /:id - Delete appointment
    if (method === 'DELETE' && relativePath.length === 1) {
      const id = relativePath[0];
      return await deleteAppointment(req, employee, id);
    }

    return error('Not found', 404);
  } catch (err) {
    // If OPTIONS request fails, still return 200 with CORS headers
    if (req.method === 'OPTIONS') {
      return new Response('ok', {
        status: 200,
        headers: corsHeaders,
      });
    }
    const { message, statusCode } = handleError(err);
    return error(message, statusCode);
  }
});
