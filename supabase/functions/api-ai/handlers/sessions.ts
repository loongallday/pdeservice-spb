/**
 * AI Session Management Handlers
 */

import { success, error } from '../../_shared/response.ts';
import type { Employee } from '../../_shared/auth.ts';
import {
  listSessions,
  getOrCreateSession,
  createNewSession,
  deleteSession,
  deleteAllSessions,
  loadMessages,
  loadRecentMessages,
} from '../services/sessionService.ts';

/**
 * GET /api-ai/sessions
 * List all sessions for the current employee
 */
export async function handleListSessions(
  _req: Request,
  employee: Employee
): Promise<Response> {
  try {
    const sessions = await listSessions(employee.id, 20);
    return success({ sessions });
  } catch (err) {
    console.error('[sessions] List error:', err);
    return error(err instanceof Error ? err.message : 'Failed to list sessions', 500);
  }
}

/**
 * GET /api-ai/sessions/:id
 * Get a specific session
 */
export async function handleGetSession(
  _req: Request,
  employee: Employee,
  sessionId: string
): Promise<Response> {
  try {
    const session = await getOrCreateSession(employee.id, sessionId);
    return success({ session });
  } catch (err) {
    console.error('[sessions] Get error:', err);
    return error(err instanceof Error ? err.message : 'Failed to get session', 500);
  }
}

/**
 * POST /api-ai/sessions
 * Create a new session
 */
export async function handleCreateSession(
  _req: Request,
  employee: Employee
): Promise<Response> {
  try {
    const session = await createNewSession(employee.id);
    return success({ session });
  } catch (err) {
    console.error('[sessions] Create error:', err);
    return error(err instanceof Error ? err.message : 'Failed to create session', 500);
  }
}

/**
 * DELETE /api-ai/sessions/:id
 * Delete a session
 */
export async function handleDeleteSession(
  _req: Request,
  employee: Employee,
  sessionId: string
): Promise<Response> {
  try {
    await deleteSession(sessionId, employee.id);
    return success({ deleted: true });
  } catch (err) {
    console.error('[sessions] Delete error:', err);
    return error(err instanceof Error ? err.message : 'Failed to delete session', 500);
  }
}

/**
 * DELETE /api-ai/sessions
 * Delete all sessions for the current employee (clear chat history)
 */
export async function handleDeleteAllSessions(
  _req: Request,
  employee: Employee
): Promise<Response> {
  try {
    const count = await deleteAllSessions(employee.id);
    return success({ deleted: true, count });
  } catch (err) {
    console.error('[sessions] Delete all error:', err);
    return error(err instanceof Error ? err.message : 'Failed to clear sessions', 500);
  }
}

/**
 * GET /api-ai/sessions/:id/messages
 * Get messages for a session
 * Query params:
 *   - limit: max number of messages (default: 100, max: 500)
 *   - offset: skip first N messages (default: 0)
 *   - after: get messages after this sequence number
 *   - recent: if true, get last N messages (uses limit param)
 */
export async function handleGetSessionMessages(
  req: Request,
  employee: Employee,
  sessionId: string
): Promise<Response> {
  try {
    // First verify the session belongs to this employee
    const session = await getOrCreateSession(employee.id, sessionId);
    if (!session || session.employee_id !== employee.id) {
      return error('Session not found', 404);
    }

    const url = new URL(req.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '100'), 500);
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const after = url.searchParams.get('after');
    const recent = url.searchParams.get('recent') === 'true';

    let messages;
    if (recent) {
      messages = await loadRecentMessages(sessionId, limit);
    } else {
      messages = await loadMessages(sessionId, {
        limit,
        offset,
        afterSequence: after ? parseInt(after) : undefined,
      });
    }

    return success({
      sessionId,
      messages,
      count: messages.length,
    });
  } catch (err) {
    console.error('[sessions] Get messages error:', err);
    return error(err instanceof Error ? err.message : 'Failed to get messages', 500);
  }
}
