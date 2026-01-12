/**
 * API AI Edge Function
 * AI Assistant powered by OpenAI GPT-4o-mini for PDE Service Platform
 *
 * Features:
 * - Streaming responses (SSE) like ChatGPT
 * - Context compression with entity memory (RAG-like)
 * - Session persistence in database
 * - Complete message history storage
 * - Tool calling with user confirmation
 * - Auto-cleanup: max 10 sessions per user
 *
 * Endpoints:
 * - POST /api-ai/assistant - Non-streaming response
 * - POST /api-ai/assistant/stream - Streaming SSE response
 * - GET /api-ai/sessions - List all sessions
 * - POST /api-ai/sessions - Create new session
 * - GET /api-ai/sessions/:id - Get session details
 * - GET /api-ai/sessions/:id/messages - Get messages for a session
 * - DELETE /api-ai/sessions/:id - Delete single session
 * - DELETE /api-ai/sessions - Clear all sessions
 */

import { handleCORS } from '../_shared/cors.ts';
import { authenticate } from '../_shared/auth.ts';
import { error } from '../_shared/response.ts';
import { handleError } from '../_shared/error.ts';
import { askAssistant } from './handlers/assistant.ts';
import { askAssistantStream } from './handlers/assistantStream.ts';
import {
  handleListSessions,
  handleGetSession,
  handleCreateSession,
  handleDeleteSession,
  handleDeleteAllSessions,
  handleGetSessionMessages,
} from './handlers/sessions.ts';

Deno.serve(async (req) => {
  // Handle CORS preflight
  const corsResponse = handleCORS(req);
  if (corsResponse) return corsResponse;

  try {
    // Authenticate request
    const { employee } = await authenticate(req);

    // Parse URL and route
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const functionIndex = pathParts.indexOf('api-ai');
    const relativePath = functionIndex >= 0
      ? pathParts.slice(functionIndex + 1)
      : [];
    const method = req.method;

    // Session management routes
    if (relativePath[0] === 'sessions') {
      const sessionId = relativePath[1];
      const subRoute = relativePath[2];

      if (method === 'GET') {
        // GET /api-ai/sessions/:id/messages - Get session messages
        if (sessionId && subRoute === 'messages') {
          return await handleGetSessionMessages(req, employee, sessionId);
        }

        if (sessionId) {
          // GET /api-ai/sessions/:id
          return await handleGetSession(req, employee, sessionId);
        }
        // GET /api-ai/sessions
        return await handleListSessions(req, employee);
      }

      if (method === 'POST' && !sessionId) {
        // POST /api-ai/sessions
        return await handleCreateSession(req, employee);
      }

      if (method === 'DELETE') {
        if (sessionId) {
          // DELETE /api-ai/sessions/:id - Delete single session
          return await handleDeleteSession(req, employee, sessionId);
        }
        // DELETE /api-ai/sessions - Delete all sessions (clear history)
        return await handleDeleteAllSessions(req, employee);
      }
    }

    // Assistant routes
    if (method === 'POST') {
      // POST /api-ai/assistant/stream - Ask AI with streaming response
      if (relativePath[0] === 'assistant' && relativePath[1] === 'stream') {
        return await askAssistantStream(req, employee);
      }

      // POST /api-ai/assistant - Ask the AI assistant (non-streaming)
      if (relativePath[0] === 'assistant' || relativePath.length === 0) {
        return await askAssistant(req, employee);
      }
    }

    return error('ไม่พบ endpoint ที่ร้องขอ', 404);
  } catch (err) {
    const { message, statusCode } = handleError(err);
    return error(message, statusCode);
  }
});
