/**
 * @fileoverview Announcements API Edge Function - System-wide announcements
 * @module api-announcements
 *
 * @description
 * Manages system-wide announcements displayed to all users.
 * Only superadmins (level 3) can create/update/delete announcements.
 *
 * Announcement Features:
 * - Title and content (supports HTML/markdown)
 * - Priority levels (normal, high, urgent)
 * - Start/end date for scheduled visibility
 * - Target audience (all, technicians, admins)
 *
 * @endpoints
 * ## Announcement Operations
 * - GET    /      - List all announcements (all users)
 * - GET    /:id   - Get announcement by ID (all users)
 * - POST   /      - Create announcement (superadmin only)
 * - PUT    /:id   - Update announcement (superadmin only)
 * - DELETE /:id   - Delete announcement (superadmin only)
 *
 * @auth All endpoints require JWT authentication
 * @permission Level 3 (superadmin) for POST/PUT/DELETE
 * @table main_announcements - Announcement data
 */

import { handleCORS } from '../_shared/cors.ts';
import { error } from '../_shared/response.ts';
import { authenticate } from '../_shared/auth.ts';
import { handleError } from '../_shared/error.ts';
import { list } from './handlers/list.ts';
import { getById } from './handlers/getById.ts';
import { create } from './handlers/create.ts';
import { update } from './handlers/update.ts';
import { deleteAnnouncement } from './handlers/delete.ts';

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
    const functionIndex = pathParts.indexOf('api-announcements');
    const relativePath = functionIndex >= 0 ? pathParts.slice(functionIndex + 1) : [];
    const method = req.method;

    // GET / - List all announcements
    if (method === 'GET' && relativePath.length === 0) {
      return await list(req, employee);
    }

    // GET /:id - Get announcement by ID
    if (method === 'GET' && relativePath.length === 1) {
      return await getById(req, employee, relativePath[0]);
    }

    // POST / - Create announcement (superadmin only)
    if (method === 'POST' && relativePath.length === 0) {
      return await create(req, employee);
    }

    // PUT /:id - Update announcement (superadmin only)
    if (method === 'PUT' && relativePath.length === 1) {
      return await update(req, employee, relativePath[0]);
    }

    // DELETE /:id - Delete announcement (superadmin only)
    if (method === 'DELETE' && relativePath.length === 1) {
      return await deleteAnnouncement(req, employee, relativePath[0]);
    }

    return error('Not found', 404);
  } catch (err) {
    const { message, statusCode } = handleError(err);
    return error(message, statusCode);
  }
});
