/**
 * GET handler for notifications
 */

import { parsePaginationParams } from '../../_shared/validation.ts';
import { NotificationService } from '../../api-tickets/services/notificationService.ts';
import { corsHeaders } from '../../_shared/cors.ts';
import type { Employee } from '../../_shared/auth.ts';

/**
 * GET /api-notifications
 * List notifications for the current user
 */
export async function getNotifications(req: Request, employee: Employee): Promise<Response> {
  const url = new URL(req.url);
  const { page, limit } = parsePaginationParams(url);
  const unreadOnly = url.searchParams.get('unread_only') === 'true';

  const result = await NotificationService.getByRecipient(employee.id, {
    page,
    limit,
    unreadOnly,
  });

  // Return data with pagination AND unread_count in response
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
}
