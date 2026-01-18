/**
 * Unit tests for Todos API handlers
 */

import { assertEquals, assertRejects } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { listTodos, getTodo, createTodo, updateTodo, deleteTodo, completeTodo, reopenTodo } from '../../supabase/functions/api-todos/handlers/todos.ts';
import { createMockRequest, createMockJsonRequest, createMockEmployeeWithLevel } from '../_shared/mocks.ts';

const mockTodo = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  title: 'Test Todo',
  description: 'This is a test todo',
  deadline: '2025-01-15T00:00:00Z',
  ticket_id: null,
  is_completed: false,
  completed_at: null,
  notified_at: null,
  priority: 'normal',
  creator: {
    id: '123e4567-e89b-12d3-a456-426614174001',
    code: 'EMP001',
    name: 'Test Creator',
    nickname: null,
  },
  assignee: {
    id: '123e4567-e89b-12d3-a456-426614174002',
    code: 'EMP002',
    name: 'Test Assignee',
    nickname: null,
  },
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
};

// ============ Handler Existence Tests ============

Deno.test('listTodos - handler exists', () => {
  assertEquals(typeof listTodos, 'function');
});

Deno.test('getTodo - handler exists', () => {
  assertEquals(typeof getTodo, 'function');
});

Deno.test('createTodo - handler exists', () => {
  assertEquals(typeof createTodo, 'function');
});

Deno.test('updateTodo - handler exists', () => {
  assertEquals(typeof updateTodo, 'function');
});

Deno.test('deleteTodo - handler exists', () => {
  assertEquals(typeof deleteTodo, 'function');
});

Deno.test('completeTodo - handler exists', () => {
  assertEquals(typeof completeTodo, 'function');
});

Deno.test('reopenTodo - handler exists', () => {
  assertEquals(typeof reopenTodo, 'function');
});

// ============ Validation Tests ============

Deno.test('getTodo - invalid UUID throws error', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-todos/invalid-uuid');

  await assertRejects(
    async () => await getTodo(request, employee, 'invalid-uuid'),
    Error,
    'ไม่ถูกต้อง'
  );
});

Deno.test('updateTodo - invalid UUID throws error', async () => {
  const employee = createMockEmployeeWithLevel(1);
  const request = createMockJsonRequest('PUT', 'http://localhost/api-todos/invalid-uuid', {
    title: 'Updated Todo',
  });

  await assertRejects(
    async () => await updateTodo(request, employee, 'invalid-uuid'),
    Error,
    'ไม่ถูกต้อง'
  );
});

Deno.test('deleteTodo - invalid UUID throws error', async () => {
  const employee = createMockEmployeeWithLevel(1);
  const request = createMockRequest('DELETE', 'http://localhost/api-todos/invalid-uuid');

  await assertRejects(
    async () => await deleteTodo(request, employee, 'invalid-uuid'),
    Error,
    'ไม่ถูกต้อง'
  );
});

Deno.test('completeTodo - invalid UUID throws error', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockJsonRequest('POST', 'http://localhost/api-todos/invalid-uuid/complete', {});

  await assertRejects(
    async () => await completeTodo(request, employee, 'invalid-uuid'),
    Error,
    'ไม่ถูกต้อง'
  );
});

Deno.test('reopenTodo - invalid UUID throws error', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockJsonRequest('POST', 'http://localhost/api-todos/invalid-uuid/reopen', {});

  await assertRejects(
    async () => await reopenTodo(request, employee, 'invalid-uuid'),
    Error,
    'ไม่ถูกต้อง'
  );
});

// ============ Permission Tests ============

Deno.test('createTodo - requires level 1', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockJsonRequest('POST', 'http://localhost/api-todos', {
    title: 'New Todo',
    deadline: '2025-02-01T00:00:00Z',
    assignee_id: mockTodo.assignee.id,
  });

  await assertRejects(
    async () => await createTodo(request, employee),
    Error,
    'ต้องมีสิทธิ์ระดับ 1'
  );
});

Deno.test('createTodo - success with level 1', async () => {
  const employee = createMockEmployeeWithLevel(1);
  const request = createMockJsonRequest('POST', 'http://localhost/api-todos', {
    title: 'New Todo',
    deadline: '2025-02-01T00:00:00Z',
    assignee_id: mockTodo.assignee.id,
  });

  const module = await import('../../supabase/functions/api-todos/services/todoService.ts');
  const originalCreate = module.TodoService.create;
  module.TodoService.create = async () => mockTodo;

  try {
    const response = await createTodo(request, employee);
    assertEquals(response.status, 201);
  } finally {
    module.TodoService.create = originalCreate;
  }
});

Deno.test('updateTodo - requires level 1', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockJsonRequest('PUT', `http://localhost/api-todos/${mockTodo.id}`, {
    title: 'Updated Todo',
  });

  await assertRejects(
    async () => await updateTodo(request, employee, mockTodo.id),
    Error,
    'ต้องมีสิทธิ์ระดับ 1'
  );
});

Deno.test('deleteTodo - requires level 1', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('DELETE', `http://localhost/api-todos/${mockTodo.id}`);

  await assertRejects(
    async () => await deleteTodo(request, employee, mockTodo.id),
    Error,
    'ต้องมีสิทธิ์ระดับ 1'
  );
});

Deno.test('deleteTodo - success with level 1', async () => {
  const employee = createMockEmployeeWithLevel(1);
  const request = createMockRequest('DELETE', `http://localhost/api-todos/${mockTodo.id}`);

  const module = await import('../../supabase/functions/api-todos/services/todoService.ts');
  const originalDelete = module.TodoService.delete;
  module.TodoService.delete = async () => undefined;

  try {
    const response = await deleteTodo(request, employee, mockTodo.id);
    assertEquals(response.status, 200);
  } finally {
    module.TodoService.delete = originalDelete;
  }
});

Deno.test('completeTodo - success (level 0)', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockJsonRequest('POST', `http://localhost/api-todos/${mockTodo.id}/complete`, {});

  const module = await import('../../supabase/functions/api-todos/services/todoService.ts');
  const originalComplete = module.TodoService.complete;
  module.TodoService.complete = async () => ({ ...mockTodo, is_completed: true });

  try {
    const response = await completeTodo(request, employee, mockTodo.id);
    assertEquals(response.status, 200);
  } finally {
    module.TodoService.complete = originalComplete;
  }
});

Deno.test('reopenTodo - success (level 0)', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockJsonRequest('POST', `http://localhost/api-todos/${mockTodo.id}/reopen`, {});

  const module = await import('../../supabase/functions/api-todos/services/todoService.ts');
  const originalReopen = module.TodoService.reopen;
  module.TodoService.reopen = async () => ({ ...mockTodo, is_completed: false });

  try {
    const response = await reopenTodo(request, employee, mockTodo.id);
    assertEquals(response.status, 200);
  } finally {
    module.TodoService.reopen = originalReopen;
  }
});

Deno.test('listTodos - success with mocking', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-todos?page=1&limit=20');

  const module = await import('../../supabase/functions/api-todos/services/todoService.ts');
  const originalList = module.TodoService.list;
  module.TodoService.list = async () => ({ data: [mockTodo], total: 1 });

  try {
    const response = await listTodos(request, employee);
    assertEquals(response.status, 200);
  } finally {
    module.TodoService.list = originalList;
  }
});

Deno.test('getTodo - success with mocking', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', `http://localhost/api-todos/${mockTodo.id}`);

  const module = await import('../../supabase/functions/api-todos/services/todoService.ts');
  const originalGetById = module.TodoService.getById;
  module.TodoService.getById = async () => mockTodo;

  try {
    const response = await getTodo(request, employee, mockTodo.id);
    assertEquals(response.status, 200);
  } finally {
    module.TodoService.getById = originalGetById;
  }
});

Deno.test('updateTodo - success with level 1', async () => {
  const employee = createMockEmployeeWithLevel(1);
  const request = createMockJsonRequest('PUT', `http://localhost/api-todos/${mockTodo.id}`, {
    title: 'Updated Todo',
  });

  const module = await import('../../supabase/functions/api-todos/services/todoService.ts');
  const originalUpdate = module.TodoService.update;
  module.TodoService.update = async () => ({ ...mockTodo, title: 'Updated Todo' });

  try {
    const response = await updateTodo(request, employee, mockTodo.id);
    assertEquals(response.status, 200);
  } finally {
    module.TodoService.update = originalUpdate;
  }
});

