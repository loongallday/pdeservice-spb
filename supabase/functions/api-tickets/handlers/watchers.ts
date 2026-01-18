/**
 * @fileoverview Ticket watcher subscription handlers
 * @module api-tickets/handlers/watchers
 *
 * Provides watch/unwatch functionality for tickets:
 * - GET /:id/watchers - Get all watchers and current user's watch status
 * - POST /:id/watch - Subscribe current user to ticket notifications
 * - DELETE /:id/watch - Unsubscribe current user from ticket
 *
 * @auth All operations require Level 0+ authentication
 *
 * @description
 * Watchers receive notifications when ticket changes occur (comments,
 * status updates, etc.). Users can manually watch tickets, and may be
 * automatically added as watchers when assigned or commenting.
 */

import { success } from '../../_shared/response.ts';
import { requireMinLevel } from '../../_shared/auth.ts';
import { validateUUID } from '../../_shared/validation.ts';
import { WatcherService } from '../services/watcherService.ts';
import type { Employee } from '../../_shared/auth.ts';

/**
 * GET /tickets/:id/watchers - Get all watchers for a ticket
 */
export async function getWatchers(req: Request, employee: Employee, ticketId: string) {
  // Check permissions - Level 0 and above can view watchers
  await requireMinLevel(employee, 0);

  // Validate ticket ID
  validateUUID(ticketId, 'Ticket ID');

  // Get watchers
  const watchers = await WatcherService.getWatchers(ticketId);

  // Check if current user is watching
  const isWatching = watchers.some(w => w.employee_id === employee.id);

  return success({
    watchers,
    is_watching: isWatching,
  });
}

/**
 * POST /tickets/:id/watch - Add current user as watcher
 */
export async function addWatch(req: Request, employee: Employee, ticketId: string) {
  // Check permissions - Level 0 and above can watch tickets
  await requireMinLevel(employee, 0);

  // Validate ticket ID
  validateUUID(ticketId, 'Ticket ID');

  // Add current user as watcher
  await WatcherService.addWatcher(ticketId, employee.id, employee.id, 'manual');

  return success({ message: 'เริ่มติดตามตั๋วงานแล้ว' }, 201);
}

/**
 * DELETE /tickets/:id/watch - Remove current user from watchers
 */
export async function removeWatch(req: Request, employee: Employee, ticketId: string) {
  // Check permissions - Level 0 and above can unwatch tickets
  await requireMinLevel(employee, 0);

  // Validate ticket ID
  validateUUID(ticketId, 'Ticket ID');

  // Remove current user from watchers
  await WatcherService.removeWatcher(ticketId, employee.id);

  return success({ message: 'หยุดติดตามตั๋วงานแล้ว' });
}
