/**
 * Mark as read handler for notifications
 */

import { success } from '../../_shared/response.ts';
import { parseRequestBody } from '../../_shared/validation.ts';
import { NotificationService } from '../../api-tickets/services/notificationService.ts';
import type { Employee } from '../../_shared/auth.ts';

interface MarkAsReadInput {
  notification_ids?: string[]; // Optional - if omitted, marks ALL as read
}

/**
 * PUT /api-notifications/read
 * Mark notifications as read
 */
export async function markAsRead(req: Request, employee: Employee): Promise<Response> {
  const body = await parseRequestBody<MarkAsReadInput>(req);

  const result = await NotificationService.markAsRead(
    employee.id,
    body.notification_ids
  );

  return success(result);
}
