/**
 * Todo handlers - CRUD operations for todos
 */

import { success, successWithPagination } from '../../_shared/response.ts';
import { requireMinLevel } from '../../_shared/auth.ts';
import { validateUUID, parseRequestBody, parsePaginationParams } from '../../_shared/validation.ts';
import { TodoService, TodoInput, TodoPriority, TodoListParams } from '../services/todoService.ts';
import type { Employee } from '../../_shared/auth.ts';

/**
 * GET /todos - List todos with filters
 */
export async function listTodos(req: Request, employee: Employee) {
  await requireMinLevel(employee, 0);

  const url = new URL(req.url);
  const { page, limit } = parsePaginationParams(url);

  const params: TodoListParams = {
    page,
    limit,
    assigneeId: url.searchParams.get('assignee_id') || undefined,
    creatorId: url.searchParams.get('creator_id') || undefined,
    isCompleted: url.searchParams.has('is_completed')
      ? url.searchParams.get('is_completed') === 'true'
      : undefined,
    priority: (url.searchParams.get('priority') as TodoPriority) || undefined,
    ticketId: url.searchParams.get('ticket_id') || undefined,
    fromDate: url.searchParams.get('from_date') || undefined,
    toDate: url.searchParams.get('to_date') || undefined,
    own: url.searchParams.get('own') === 'true',
    searchTerm: url.searchParams.get('p') || undefined,
  };

  const { data, total } = await TodoService.list(employee.id, employee.level, params);

  return successWithPagination(data, {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  });
}

/**
 * GET /todos/:id - Get single todo
 */
export async function getTodo(req: Request, employee: Employee, todoId: string) {
  await requireMinLevel(employee, 0);
  validateUUID(todoId, 'Todo ID');

  const todo = await TodoService.getById(todoId, employee.id, employee.level);

  return success(todo);
}

/**
 * POST /todos - Create new todo
 */
export async function createTodo(req: Request, employee: Employee) {
  await requireMinLevel(employee, 1);

  const body = await parseRequestBody<Record<string, unknown>>(req);

  const input: TodoInput = {
    title: (body.title as string) || '',
    description: body.description as string | undefined,
    deadline: (body.deadline as string) || '',
    assignee_id: body.assignee_id as string,
    ticket_id: body.ticket_id as string | undefined,
    priority: (body.priority as TodoPriority) || undefined,
  };

  const todo = await TodoService.create(employee.id, input);

  return success(todo, 201);
}

/**
 * PUT /todos/:id - Update todo
 */
export async function updateTodo(req: Request, employee: Employee, todoId: string) {
  await requireMinLevel(employee, 1);
  validateUUID(todoId, 'Todo ID');

  const body = await parseRequestBody<Record<string, unknown>>(req);

  const input: Partial<TodoInput> = {};
  if (body.title !== undefined) input.title = body.title as string;
  if (body.description !== undefined) input.description = body.description as string;
  if (body.deadline !== undefined) input.deadline = body.deadline as string;
  if (body.assignee_id !== undefined) input.assignee_id = body.assignee_id as string;
  if (body.ticket_id !== undefined) input.ticket_id = body.ticket_id as string;
  if (body.priority !== undefined) input.priority = body.priority as TodoPriority;

  const todo = await TodoService.update(todoId, employee.id, employee.level, input);

  return success(todo);
}

/**
 * DELETE /todos/:id - Delete todo
 */
export async function deleteTodo(req: Request, employee: Employee, todoId: string) {
  await requireMinLevel(employee, 1);
  validateUUID(todoId, 'Todo ID');

  await TodoService.delete(todoId, employee.id, employee.level);

  return success({ message: 'ลบงานสำเร็จ' });
}

/**
 * POST /todos/:id/complete - Mark todo as completed
 */
export async function completeTodo(req: Request, employee: Employee, todoId: string) {
  await requireMinLevel(employee, 0);
  validateUUID(todoId, 'Todo ID');

  const todo = await TodoService.complete(todoId, employee.id, employee.level);

  return success(todo);
}

/**
 * POST /todos/:id/reopen - Reopen completed todo
 */
export async function reopenTodo(req: Request, employee: Employee, todoId: string) {
  await requireMinLevel(employee, 0);
  validateUUID(todoId, 'Todo ID');

  const todo = await TodoService.reopen(todoId, employee.id, employee.level);

  return success(todo);
}
