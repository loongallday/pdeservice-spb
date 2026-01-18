/**
 * @fileoverview Notifications API Edge Function - In-app notification management
 * @module api-notifications
 *
 * @description
 * Manages in-app notifications for authenticated users.
 * Notifications are created by ticket events, mentions, and watcher updates.
 *
 * Notification Types:
 * - ticket_assigned: Assigned to a ticket
 * - ticket_updated: Watched ticket updated
 * - ticket_commented: New comment on watched ticket
 * - ticket_mentioned: Mentioned in a comment
 * - technician_confirmed: Confirmed as technician
 * - appointment_approved: Appointment approved
 * - appointment_unapproved: Appointment un-approved
 *
 * @endpoints
 * ## Notification Operations
 * - GET    /          - List notifications for current user
 * - PUT    /read      - Mark notifications as read
 * - PATCH  /read      - Mark notifications as read (alias)
 * - GET    /warmup    - Keep function warm (no auth)
 *
 * @auth All endpoints require JWT authentication except /warmup
 * @table main_notifications - Notification data
 */

import { handleCORS } from '../_shared/cors.ts';
import { error } from '../_shared/response.ts';
import { authenticate } from '../_shared/auth.ts';
import { handleError } from '../_shared/error.ts';
import { getNotifications } from './handlers/get.ts';
import { markAsRead } from './handlers/markAsRead.ts';

import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  const corsResponse = handleCORS(req);
  if (corsResponse) return corsResponse;

  // Parse URL early for warmup check
  const url = new URL(req.url);
  const pathParts = url.pathname.split('/').filter(Boolean);
  const functionIndex = pathParts.indexOf('api-notifications');
  const relativePath = functionIndex >= 0 ? pathParts.slice(functionIndex + 1) : [];

  // GET /warmup - Keep function warm (no auth required)
  if (req.method === 'GET' && relativePath.length === 1 && relativePath[0] === 'warmup') {
    return new Response(
      JSON.stringify({ status: 'warm', timestamp: new Date().toISOString() }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }

  try {
    // Authenticate request
    const { employee } = await authenticate(req);
    const method = req.method;

    // Route requests
    switch (method) {
      case 'GET':
        // GET / - List notifications for current user
        if (relativePath.length === 0) {
          return await getNotifications(req, employee);
        }
        break;

      case 'PUT':
      case 'PATCH':
        // PUT/PATCH /read - Mark notifications as read
        if (relativePath.length === 1 && relativePath[0] === 'read') {
          return await markAsRead(req, employee);
        }
        break;
    }

    return error('ไม่พบ endpoint ที่ระบุ', 404);
  } catch (err) {
    const { message, statusCode } = handleError(err);
    return error(message, statusCode);
  }
});
