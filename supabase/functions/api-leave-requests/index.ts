/**
 * @fileoverview Leave Requests API Edge Function - Employee leave management
 * @module api-leave-requests
 *
 * @description
 * Manages employee leave requests with approval workflow.
 * Supports vacation, sick leave, personal leave, etc.
 *
 * Leave Request Statuses:
 * - pending: Awaiting approval
 * - approved: Approved by manager
 * - rejected: Rejected by manager
 * - cancelled: Cancelled by employee
 *
 * @endpoints
 * ## Leave Request Operations
 * - GET    /                  - List leave requests
 * - GET    /search            - Search leave requests
 * - GET    /:id               - Get leave request by ID
 * - POST   /                  - Create new leave request
 * - PUT    /:id               - Update leave request
 * - DELETE /:id               - Delete leave request
 *
 * ## Approval Workflow
 * - POST   /:id/approve       - Approve leave request
 * - POST   /:id/reject        - Reject leave request
 * - POST   /:id/cancel        - Cancel leave request
 *
 * @auth All endpoints require JWT authentication
 * @table main_leave_requests - Leave request data
 * @table main_employees - Employee reference
 */

import { handleCORS } from '../_shared/cors.ts';
import { error } from '../_shared/response.ts';
import { authenticate } from '../_shared/auth.ts';
import { handleError } from '../_shared/error.ts';
import { list } from './handlers/list.ts';
import { get } from './handlers/get.ts';
import { create } from './handlers/create.ts';
import { update } from './handlers/update.ts';
import { deleteLeaveRequest } from './handlers/delete.ts';
import { approve } from './handlers/approve.ts';
import { reject } from './handlers/reject.ts';
import { cancel } from './handlers/cancel.ts';
import { search } from './handlers/search.ts';

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
    const functionIndex = pathParts.indexOf('api-leave-requests');
    const relativePath = functionIndex >= 0 ? pathParts.slice(functionIndex + 1) : [];
    const method = req.method;

    // GET / - List leave requests
    if (method === 'GET' && relativePath.length === 0) {
      return await list(req, employee);
    }

    // GET /search - Search leave requests
    if (method === 'GET' && relativePath.length === 1 && relativePath[0] === 'search') {
      return await search(req, employee);
    }

    // GET /:id - Get single leave request
    if (method === 'GET' && relativePath.length === 1 && !['approve', 'reject', 'cancel', 'search'].includes(relativePath[0])) {
      const id = relativePath[0];
      return await get(req, employee, id);
    }

    // POST / - Create leave request
    if (method === 'POST' && relativePath.length === 0) {
      return await create(req, employee);
    }

    // POST /:id/approve - Approve leave request
    if (method === 'POST' && relativePath.length === 2 && relativePath[1] === 'approve') {
      const id = relativePath[0];
      return await approve(req, employee, id);
    }

    // POST /:id/reject - Reject leave request
    if (method === 'POST' && relativePath.length === 2 && relativePath[1] === 'reject') {
      const id = relativePath[0];
      return await reject(req, employee, id);
    }

    // POST /:id/cancel - Cancel leave request
    if (method === 'POST' && relativePath.length === 2 && relativePath[1] === 'cancel') {
      const id = relativePath[0];
      return await cancel(req, employee, id);
    }

    // DELETE /:id - Delete leave request (check before PUT to avoid conflicts)
    if (method === 'DELETE' && relativePath.length === 1) {
      const id = relativePath[0];
      return await deleteLeaveRequest(req, employee, id);
    }

    // PUT /:id - Update leave request
    if (method === 'PUT' && relativePath.length === 1) {
      const id = relativePath[0];
      return await update(req, employee, id);
    }

    return error('Not found', 404);
  } catch (err) {
    const { message, statusCode } = handleError(err);
    return error(message, statusCode);
  }
});
