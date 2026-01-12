/**
 * Todos API Edge Function
 * Handles todo/reminder CRUD operations
 */

import { handleCORS } from '../_shared/cors.ts';
import { error } from '../_shared/response.ts';
import { authenticate } from '../_shared/auth.ts';
import { handleError } from '../_shared/error.ts';
import {
  listTodos,
  getTodo,
  createTodo,
  updateTodo,
  deleteTodo,
  completeTodo,
  reopenTodo,
} from './handlers/todos.ts';

Deno.serve(async (req) => {
  // Handle CORS preflight
  const corsResponse = handleCORS(req);
  if (corsResponse) return corsResponse;

  try {
    // Authenticate user
    const { employee } = await authenticate(req);

    // Route to appropriate handler
    let url: URL;
    try {
      url = new URL(req.url);
    } catch {
      return error('Invalid URL', 400);
    }

    const pathParts = url.pathname.split('/').filter(Boolean);
    const functionIndex = pathParts.indexOf('api-todos');
    const relativePath = functionIndex >= 0 ? pathParts.slice(functionIndex + 1) : [];
    const method = req.method;

    switch (method) {
      case 'GET':
        // GET / - List todos
        if (relativePath.length === 0) {
          return await listTodos(req, employee);
        }

        // GET /:id - Get single todo
        if (relativePath.length === 1) {
          const id = relativePath[0];
          return await getTodo(req, employee, id);
        }
        break;

      case 'POST':
        // POST / - Create todo
        if (relativePath.length === 0) {
          return await createTodo(req, employee);
        }

        // POST /:id/complete - Mark as completed
        if (relativePath.length === 2 && relativePath[1] === 'complete') {
          const id = relativePath[0];
          return await completeTodo(req, employee, id);
        }

        // POST /:id/reopen - Reopen todo
        if (relativePath.length === 2 && relativePath[1] === 'reopen') {
          const id = relativePath[0];
          return await reopenTodo(req, employee, id);
        }
        break;

      case 'PUT':
        // PUT /:id - Update todo
        if (relativePath.length === 1) {
          const id = relativePath[0];
          return await updateTodo(req, employee, id);
        }

        // PUT /:id/complete - Mark as completed
        if (relativePath.length === 2 && relativePath[1] === 'complete') {
          const id = relativePath[0];
          return await completeTodo(req, employee, id);
        }

        // PUT /:id/reopen - Reopen todo
        if (relativePath.length === 2 && relativePath[1] === 'reopen') {
          const id = relativePath[0];
          return await reopenTodo(req, employee, id);
        }
        break;

      case 'DELETE':
        // DELETE /:id - Delete todo
        if (relativePath.length === 1) {
          const id = relativePath[0];
          return await deleteTodo(req, employee, id);
        }
        break;
    }

    return error('Not found', 404);
  } catch (err) {
    const { message, statusCode } = handleError(err);
    return error(message, statusCode);
  }
});
