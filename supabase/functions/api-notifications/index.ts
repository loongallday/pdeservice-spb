/**
 * API Notifications Edge Function
 * Handles notification CRUD operations for authenticated users
 */

import { handleCORS } from '../_shared/cors.ts';
import { error } from '../_shared/response.ts';
import { authenticate } from '../_shared/auth.ts';
import { handleError } from '../_shared/error.ts';
import { getNotifications } from './handlers/get.ts';
import { markAsRead } from './handlers/markAsRead.ts';

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  const corsResponse = handleCORS(req);
  if (corsResponse) return corsResponse;

  try {
    // Authenticate request
    const { employee } = await authenticate(req);

    // Parse URL and method
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const functionIndex = pathParts.indexOf('api-notifications');
    const relativePath = functionIndex >= 0 ? pathParts.slice(functionIndex + 1) : [];
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
