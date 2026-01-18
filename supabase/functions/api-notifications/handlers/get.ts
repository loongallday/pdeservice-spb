/**
 * GET handler for notifications
 */

import { parsePaginationParams } from '../../_shared/validation.ts';
import { NotificationService } from '../../api-tickets/services/notificationService.ts';
import { corsHeaders } from '../../_shared/cors.ts';
import { handleError } from '../../_shared/error.ts';
import { error } from '../../_shared/response.ts';
import type { Employee } from '../../_shared/auth.ts';

/**
 * GET /api-notifications
 * List notifications for the current user
 * Query params:
 *   - page: number (default 1)
 *   - limit: number (default 20)
 *   - unread_only: boolean (default false)
 *   - search: string (optional) - search in title and message
 */
export async function getNotifications(req: Request, employee: Employee): Promise<Response> {
  try {
    const url = new URL(req.url);
    const { page, limit } = parsePaginationParams(url);
    const unreadOnly = url.searchParams.get('unread_only') === 'true';
    const search = url.searchParams.get('search')?.trim() || undefined;

    const result = await NotificationService.getByRecipient(employee.id, {
      page,
      limit,
      unreadOnly,
      search,
    });

    // Return data with pagination AND unread_count in response
    // Note: Must include unread_count at top level for frontend NotificationResponse shape
    return new Response(
      JSON.stringify({
        data: result.data,
        pagination: result.pagination,
        unread_count: result.unread_count,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  } catch (err) {
    const { message, statusCode, code } = handleError(err);
    return error(message, statusCode, code);
  }
}
