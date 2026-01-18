/**
 * Mark as read handler for notifications
 */

import { success, error } from '../../_shared/response.ts';
import { parseRequestBody } from '../../_shared/validation.ts';
import { NotificationService } from '../../api-tickets/services/notificationService.ts';
import { handleError } from '../../_shared/error.ts';
import type { Employee } from '../../_shared/auth.ts';

interface MarkAsReadInput {
  notification_ids?: string[]; // Optional - if omitted, marks ALL as read
}

/**
 * PUT /api-notifications/read
 * Mark notifications as read
 *
 * @param notification_ids - Optional array of notification IDs to mark as read
 *                          If omitted, marks ALL unread notifications as read
 */
export async function markAsRead(req: Request, employee: Employee): Promise<Response> {
  try {
    const body = await parseRequestBody<MarkAsReadInput>(req);

    const result = await NotificationService.markAsRead(
      employee.id,
      body.notification_ids
    );

    return success(result);
  } catch (err) {
    const { message, statusCode, code } = handleError(err);
    return error(message, statusCode, code);
  }
}
