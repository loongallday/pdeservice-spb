/**
 * @fileoverview Staging API Edge Function - LINE file staging and approval workflow
 * @module api-staging
 *
 * @description
 * Handles staged file operations for n8n LINE integration.
 * Files uploaded via LINE are staged for admin approval before linking to tickets.
 *
 * Two authentication modes:
 * 1. Service role (n8n): For automated file creation and ticket lookup
 * 2. JWT (web app): For file approval/rejection workflow
 *
 * File Workflow:
 * 1. Technician sends image via LINE
 * 2. n8n webhook creates staged file (service_role)
 * 3. Admin reviews and approves/rejects (JWT)
 * 4. Approved files linked to tickets
 *
 * @endpoints
 * ## n8n Integration (service_role auth)
 * - POST   /files              - Create staged file
 * - PUT    /files/:id/link     - Link file to ticket
 * - GET    /tickets/carousel   - Get tickets for LINE carousel
 * - GET    /tickets/by-code/:code - Get ticket by code
 * - GET    /employee/:lineUserId  - Get employee by LINE user ID
 *
 * ## File Management (JWT auth, canApproveAppointments)
 * - GET    /files              - List staged files
 * - GET    /files/grouped      - List files grouped by ticket
 * - GET    /files/:id          - Get single staged file
 * - POST   /files/:id/approve  - Approve file
 * - POST   /files/:id/reject   - Reject file
 * - POST   /files/bulk-approve - Bulk approve files
 * - POST   /files/bulk-delete  - Bulk delete files
 * - DELETE /files/:id          - Delete staged file
 *
 * ## LINE Account Management (admin)
 * - GET    /line-accounts      - List LINE accounts
 * - POST   /line-accounts      - Create LINE account
 * - PUT    /line-accounts/:id  - Update LINE account
 * - DELETE /line-accounts/:id  - Delete LINE account
 *
 * @auth Service role for n8n, JWT for web app
 * @permission canApproveAppointments for file management
 * @table main_staged_files - Staged file uploads
 * @table child_employee_line_accounts - LINE user mappings
 * @table main_tickets - Related tickets
 */

import { handleCORS } from '../_shared/cors.ts';
import { error } from '../_shared/response.ts';
import { authenticate } from '../_shared/auth.ts';
import { handleError } from '../_shared/error.ts';
import { createServiceClient } from '../_shared/supabase.ts';

// Handlers
import { listFiles, listFilesGrouped, getFile, createFile, linkFile, deleteFile } from './handlers/files.ts';
import { approveFile, rejectFile, bulkApproveFiles, bulkDeleteFiles } from './handlers/approval.ts';
import { getCarouselTickets, getTicketByCode } from './handlers/carousel.ts';
import {
  listLineAccounts,
  createLineAccount,
  updateLineAccount,
  deleteLineAccount,
  getEmployeeByLineUserId,
} from './handlers/lineAccounts.ts';

/**
 * Check if request is using service_role key
 */
function isServiceRoleAuth(req: Request): boolean {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }

  const token = authHeader.replace('Bearer ', '');

  // Service role key is used directly, not a JWT
  // Check if it's the service role key by trying to decode as JWT
  // Service role keys are typically 176+ chars and don't have JWT structure
  const parts = token.split('.');
  if (parts.length !== 3) {
    // Not a JWT structure - likely service role key
    // Verify by checking if we can create a service client with it
    return true;
  }

  // Check if it's actually a service_role JWT by examining the payload
  try {
    const payload = JSON.parse(atob(parts[1]));
    return payload.role === 'service_role';
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  const corsResponse = handleCORS(req);
  if (corsResponse) return corsResponse;

  try {
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const functionIndex = pathParts.indexOf('api-staging');
    const relativePath = functionIndex >= 0 ? pathParts.slice(functionIndex + 1) : [];
    const method = req.method;

    // Check if using service_role (for n8n endpoints)
    const serviceRole = isServiceRoleAuth(req);

    // Routes that require service_role auth (n8n)
    if (serviceRole) {
      // POST /files - Create staged file
      if (method === 'POST' && relativePath.length === 1 && relativePath[0] === 'files') {
        return await createFile(req);
      }

      // PUT /files/:id/link - Link file to ticket
      if (method === 'PUT' && relativePath.length === 3 && relativePath[0] === 'files' && relativePath[2] === 'link') {
        const id = relativePath[1];
        return await linkFile(req, id);
      }

      // GET /tickets/carousel - Get tickets for LINE carousel
      if (method === 'GET' && relativePath.length === 2 && relativePath[0] === 'tickets' && relativePath[1] === 'carousel') {
        return await getCarouselTickets(req);
      }

      // GET /tickets/by-code/:code - Get ticket by code
      if (method === 'GET' && relativePath.length === 3 && relativePath[0] === 'tickets' && relativePath[1] === 'by-code') {
        const code = relativePath[2];
        return await getTicketByCode(req, code);
      }

      // GET /employee/:lineUserId - Get employee by LINE user ID
      if (method === 'GET' && relativePath.length === 2 && relativePath[0] === 'employee') {
        const lineUserId = relativePath[1];
        return await getEmployeeByLineUserId(req, lineUserId);
      }
    }

    // Routes that require authenticated user
    const { employee } = await authenticate(req);

    switch (method) {
      case 'GET':
        // GET /files - List staged files
        if (relativePath.length === 1 && relativePath[0] === 'files') {
          return await listFiles(req, employee);
        }

        // GET /files/grouped - List files grouped by ticket
        if (relativePath.length === 2 && relativePath[0] === 'files' && relativePath[1] === 'grouped') {
          return await listFilesGrouped(req, employee);
        }

        // GET /files/:id - Get single staged file
        if (relativePath.length === 2 && relativePath[0] === 'files') {
          const id = relativePath[1];
          return await getFile(req, employee, id);
        }

        // GET /line-accounts - List LINE accounts
        if (relativePath.length === 1 && relativePath[0] === 'line-accounts') {
          return await listLineAccounts(req, employee);
        }
        break;

      case 'POST':
        // POST /files/:id/approve - Approve file
        if (relativePath.length === 3 && relativePath[0] === 'files' && relativePath[2] === 'approve') {
          const id = relativePath[1];
          return await approveFile(req, employee, id);
        }

        // POST /files/:id/reject - Reject file
        if (relativePath.length === 3 && relativePath[0] === 'files' && relativePath[2] === 'reject') {
          const id = relativePath[1];
          return await rejectFile(req, employee, id);
        }

        // POST /files/bulk-approve - Bulk approve files
        if (relativePath.length === 2 && relativePath[0] === 'files' && relativePath[1] === 'bulk-approve') {
          return await bulkApproveFiles(req, employee);
        }

        // POST /files/bulk-delete - Bulk delete files
        if (relativePath.length === 2 && relativePath[0] === 'files' && relativePath[1] === 'bulk-delete') {
          return await bulkDeleteFiles(req, employee);
        }

        // POST /line-accounts - Create LINE account
        if (relativePath.length === 1 && relativePath[0] === 'line-accounts') {
          return await createLineAccount(req, employee);
        }
        break;

      case 'PUT':
        // PUT /line-accounts/:id - Update LINE account
        if (relativePath.length === 2 && relativePath[0] === 'line-accounts') {
          const id = relativePath[1];
          return await updateLineAccount(req, employee, id);
        }
        break;

      case 'DELETE':
        // DELETE /files/:id - Delete staged file
        if (relativePath.length === 2 && relativePath[0] === 'files') {
          const id = relativePath[1];
          return await deleteFile(req, employee, id);
        }

        // DELETE /line-accounts/:id - Delete LINE account
        if (relativePath.length === 2 && relativePath[0] === 'line-accounts') {
          const id = relativePath[1];
          return await deleteLineAccount(req, employee, id);
        }
        break;
    }

    return error('Not found', 404);
  } catch (err) {
    const { message, statusCode } = handleError(err);
    return error(message, statusCode);
  }
});
