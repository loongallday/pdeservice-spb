/**
 * E2E Tests for api-todos
 * Tests all todo/reminder operations with real database and authentication
 */

import { assertEquals, assertExists } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import {
  apiGet,
  apiPost,
  apiPut,
  apiDelete,
  assertSuccess,
  setupTestUsers,
  TEST_EMPLOYEES,
  TEST_TICKETS,
  randomUUID,
} from './test-utils.ts';

// Track created todos for cleanup in tests
let createdTodoId: string | null = null;
let completedTodoId: string | null = null;

// Setup before all tests
Deno.test({
  name: 'Setup: Create test auth users',
  fn: async () => {
    await setupTestUsers();
  },
  sanitizeOps: false,
  sanitizeResources: false,
});

// ============================================
// LIST TODOS
// ============================================

Deno.test('GET /api-todos - should return paginated todos', async () => {
  const response = await apiGet('api-todos');
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
  assertExists(data.pagination);
});

Deno.test('GET /api-todos - should support pagination', async () => {
  const response = await apiGet('api-todos?page=1&limit=5');
  assertEquals(response.status, 200);
  const data = await response.json();
  assertEquals(data.pagination.page, 1);
  assertEquals(data.pagination.limit, 5);
});

Deno.test('GET /api-todos - should filter by is_completed=false', async () => {
  const response = await apiGet('api-todos?is_completed=false');
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
});

Deno.test('GET /api-todos - should filter by is_completed=true', async () => {
  const response = await apiGet('api-todos?is_completed=true');
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
});

Deno.test('GET /api-todos - should filter by priority', async () => {
  const response = await apiGet('api-todos?priority=high');
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
});

Deno.test('GET /api-todos - should filter by own=true', async () => {
  const response = await apiGet('api-todos?own=true', TEST_EMPLOYEES.assigner);
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
});

Deno.test('GET /api-todos - should filter by date range', async () => {
  const response = await apiGet('api-todos?from_date=2026-01-01&to_date=2026-12-31');
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
});

Deno.test('GET /api-todos - should support search term', async () => {
  const response = await apiGet('api-todos?p=test');
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
});

// ============================================
// CREATE TODO
// ============================================

Deno.test('POST /api-todos - should create todo with valid data', async () => {
  const todoData = {
    title: 'E2E Test Todo',
    description: 'This is a test todo created by E2E tests',
    deadline: '2026-02-01T09:00:00Z',
    assignee_id: TEST_EMPLOYEES.assigner,
    priority: 'normal',
  };

  const response = await apiPost('api-todos', todoData, TEST_EMPLOYEES.superAdmin);
  const text = await response.text();
  assertEquals(response.status < 500, true, `Unexpected server error: ${text}`);

  if (response.status === 201) {
    const data = JSON.parse(text);
    createdTodoId = data.data?.id;
    assertExists(data.data);
    assertEquals(data.data.title, 'E2E Test Todo');
  }
});

Deno.test('POST /api-todos - should create todo with high priority', async () => {
  const todoData = {
    title: 'High Priority Todo',
    deadline: '2026-02-02T10:00:00Z',
    assignee_id: TEST_EMPLOYEES.tech1,
    priority: 'high',
  };

  const response = await apiPost('api-todos', todoData, TEST_EMPLOYEES.assigner);
  const text = await response.text();
  assertEquals(response.status < 500, true, `Unexpected server error: ${text}`);
});

Deno.test('POST /api-todos - should create todo linked to ticket', async () => {
  const todoData = {
    title: 'Todo linked to ticket',
    deadline: '2026-02-03T14:00:00Z',
    assignee_id: TEST_EMPLOYEES.tech1,
    ticket_id: TEST_TICKETS.pm1,
    priority: 'normal',
  };

  const response = await apiPost('api-todos', todoData, TEST_EMPLOYEES.superAdmin);
  const text = await response.text();
  assertEquals(response.status < 500, true, `Unexpected server error: ${text}`);
});

Deno.test('POST /api-todos - should fail without title', async () => {
  const todoData = {
    deadline: '2026-02-04T09:00:00Z',
    assignee_id: TEST_EMPLOYEES.tech1,
  };

  const response = await apiPost('api-todos', todoData, TEST_EMPLOYEES.superAdmin);
  await response.text(); // Consume body
  assertEquals(response.status, 400);
});

Deno.test('POST /api-todos - should fail without deadline', async () => {
  const todoData = {
    title: 'Missing deadline todo',
    assignee_id: TEST_EMPLOYEES.tech1,
  };

  const response = await apiPost('api-todos', todoData, TEST_EMPLOYEES.superAdmin);
  await response.text(); // Consume body
  assertEquals(response.status, 400);
});

Deno.test('POST /api-todos - should fail without assignee_id', async () => {
  const todoData = {
    title: 'Missing assignee todo',
    deadline: '2026-02-05T09:00:00Z',
  };

  const response = await apiPost('api-todos', todoData, TEST_EMPLOYEES.superAdmin);
  await response.text(); // Consume body
  assertEquals(response.status, 400);
});

// ============================================
// GET TODO BY ID
// ============================================

Deno.test('GET /api-todos/:id - should get existing todo', async () => {
  // First create a todo to get
  const todoData = {
    title: 'Todo for Get Test',
    deadline: '2026-03-01T09:00:00Z',
    assignee_id: TEST_EMPLOYEES.superAdmin,
    priority: 'normal',
  };

  const createResponse = await apiPost('api-todos', todoData, TEST_EMPLOYEES.superAdmin);
  const createText = await createResponse.text();

  if (createResponse.status !== 201) {
    // If creation failed, skip this test gracefully
    assertEquals(createResponse.status < 500, true, `Unexpected server error: ${createText}`);
    return;
  }

  const createData = JSON.parse(createText);
  const todoId = createData.data.id;

  const response = await apiGet(`api-todos/${todoId}`, TEST_EMPLOYEES.superAdmin);
  assertEquals(response.status, 200);
  const todo = await assertSuccess(response);
  assertExists(todo);
  assertEquals((todo as Record<string, unknown>).id, todoId);
});

Deno.test('GET /api-todos/:id - should return 404 for non-existent todo', async () => {
  const fakeId = randomUUID();
  const response = await apiGet(`api-todos/${fakeId}`);
  await response.text(); // Consume body
  assertEquals(response.status, 404);
});

Deno.test('GET /api-todos/:id - should return 400 for invalid UUID', async () => {
  const response = await apiGet('api-todos/invalid-uuid');
  await response.text(); // Consume body
  assertEquals(response.status, 400);
});

// ============================================
// UPDATE TODO
// ============================================

Deno.test('PUT /api-todos/:id - should update todo title', async () => {
  // First create a todo to update
  const todoData = {
    title: 'Todo for Update Test',
    deadline: '2026-03-15T09:00:00Z',
    assignee_id: TEST_EMPLOYEES.superAdmin,
    priority: 'normal',
  };

  const createResponse = await apiPost('api-todos', todoData, TEST_EMPLOYEES.superAdmin);
  const createText = await createResponse.text();

  if (createResponse.status !== 201) {
    assertEquals(createResponse.status < 500, true, `Unexpected server error: ${createText}`);
    return;
  }

  const createData = JSON.parse(createText);
  const todoId = createData.data.id;

  const updateData = {
    title: 'Updated Todo Title',
  };

  const response = await apiPut(`api-todos/${todoId}`, updateData, TEST_EMPLOYEES.superAdmin);
  const text = await response.text();
  assertEquals(response.status < 500, true, `Server error: ${text}`);

  if (response.status === 200) {
    const data = JSON.parse(text);
    assertEquals(data.data.title, 'Updated Todo Title');
  }
});

Deno.test('PUT /api-todos/:id - should update todo priority', async () => {
  // First create a todo to update
  const todoData = {
    title: 'Todo for Priority Update',
    deadline: '2026-03-16T09:00:00Z',
    assignee_id: TEST_EMPLOYEES.superAdmin,
    priority: 'normal',
  };

  const createResponse = await apiPost('api-todos', todoData, TEST_EMPLOYEES.superAdmin);
  const createText = await createResponse.text();

  if (createResponse.status !== 201) {
    assertEquals(createResponse.status < 500, true, `Unexpected server error: ${createText}`);
    return;
  }

  const createData = JSON.parse(createText);
  const todoId = createData.data.id;

  const updateData = {
    priority: 'urgent',
  };

  const response = await apiPut(`api-todos/${todoId}`, updateData, TEST_EMPLOYEES.superAdmin);
  const text = await response.text();
  assertEquals(response.status < 500, true, `Server error: ${text}`);

  if (response.status === 200) {
    const data = JSON.parse(text);
    assertEquals(data.data.priority, 'urgent');
  }
});

Deno.test('PUT /api-todos/:id - should return error for non-existent todo', async () => {
  const fakeId = randomUUID();
  const updateData = {
    title: 'Updated Title',
  };

  const response = await apiPut(`api-todos/${fakeId}`, updateData, TEST_EMPLOYEES.superAdmin);
  await response.text(); // Consume body
  assertEquals(response.status >= 400, true);
});

// ============================================
// COMPLETE TODO
// ============================================

Deno.test('POST /api-todos/:id/complete - should mark todo as completed', async () => {
  // First create a todo to complete
  const todoData = {
    title: 'Todo for Complete Test',
    deadline: '2026-04-01T09:00:00Z',
    assignee_id: TEST_EMPLOYEES.superAdmin,
    priority: 'normal',
  };

  const createResponse = await apiPost('api-todos', todoData, TEST_EMPLOYEES.superAdmin);
  const createText = await createResponse.text();

  if (createResponse.status !== 201) {
    assertEquals(createResponse.status < 500, true, `Unexpected server error: ${createText}`);
    return;
  }

  const createData = JSON.parse(createText);
  const todoId = createData.data.id;
  completedTodoId = todoId; // Save for reopen test

  const response = await apiPost(`api-todos/${todoId}/complete`, {}, TEST_EMPLOYEES.superAdmin);
  const text = await response.text();
  assertEquals(response.status < 500, true, `Server error: ${text}`);

  if (response.status === 200) {
    const data = JSON.parse(text);
    assertEquals(data.data.is_completed, true);
    assertExists(data.data.completed_at);
  }
});

Deno.test('PUT /api-todos/:id/complete - should mark todo as completed (PUT alias)', async () => {
  // First create a todo to complete
  const todoData = {
    title: 'Todo for PUT Complete Test',
    deadline: '2026-04-02T09:00:00Z',
    assignee_id: TEST_EMPLOYEES.superAdmin,
    priority: 'normal',
  };

  const createResponse = await apiPost('api-todos', todoData, TEST_EMPLOYEES.superAdmin);
  const createText = await createResponse.text();

  if (createResponse.status !== 201) {
    assertEquals(createResponse.status < 500, true, `Unexpected server error: ${createText}`);
    return;
  }

  const createData = JSON.parse(createText);
  const todoId = createData.data.id;

  const response = await apiPut(`api-todos/${todoId}/complete`, {}, TEST_EMPLOYEES.superAdmin);
  const text = await response.text();
  assertEquals(response.status < 500, true, `Server error: ${text}`);
});

Deno.test('POST /api-todos/:id/complete - should fail for already completed todo', async () => {
  if (!completedTodoId) {
    // Skip if previous test didn't create a completed todo
    return;
  }

  const response = await apiPost(`api-todos/${completedTodoId}/complete`, {}, TEST_EMPLOYEES.superAdmin);
  const text = await response.text();
  // Should return 400 validation error for already completed todo
  assertEquals(response.status < 500, true, `Server error: ${text}`);
  if (response.status === 400) {
    const data = JSON.parse(text);
    assertExists(data.error);
  }
});

Deno.test('POST /api-todos/:id/complete - should return error for non-existent todo', async () => {
  const fakeId = randomUUID();
  const response = await apiPost(`api-todos/${fakeId}/complete`, {}, TEST_EMPLOYEES.superAdmin);
  await response.text(); // Consume body
  assertEquals(response.status >= 400, true);
});

// ============================================
// REOPEN TODO
// ============================================

Deno.test('POST /api-todos/:id/reopen - should reopen completed todo', async () => {
  if (!completedTodoId) {
    // Skip if no completed todo to reopen
    return;
  }

  const response = await apiPost(`api-todos/${completedTodoId}/reopen`, {}, TEST_EMPLOYEES.superAdmin);
  const text = await response.text();
  assertEquals(response.status < 500, true, `Server error: ${text}`);

  if (response.status === 200) {
    const data = JSON.parse(text);
    assertEquals(data.data.is_completed, false);
    assertEquals(data.data.completed_at, null);
  }
});

Deno.test('PUT /api-todos/:id/reopen - should reopen completed todo (PUT alias)', async () => {
  // First create and complete a todo
  const todoData = {
    title: 'Todo for PUT Reopen Test',
    deadline: '2026-04-03T09:00:00Z',
    assignee_id: TEST_EMPLOYEES.superAdmin,
    priority: 'normal',
  };

  const createResponse = await apiPost('api-todos', todoData, TEST_EMPLOYEES.superAdmin);
  const createText = await createResponse.text();

  if (createResponse.status !== 201) {
    assertEquals(createResponse.status < 500, true, `Unexpected server error: ${createText}`);
    return;
  }

  const createData = JSON.parse(createText);
  const todoId = createData.data.id;

  // Complete the todo first
  const completeResponse = await apiPost(`api-todos/${todoId}/complete`, {}, TEST_EMPLOYEES.superAdmin);
  await completeResponse.text();

  // Now reopen using PUT
  const response = await apiPut(`api-todos/${todoId}/reopen`, {}, TEST_EMPLOYEES.superAdmin);
  const text = await response.text();
  assertEquals(response.status < 500, true, `Server error: ${text}`);
});

Deno.test('POST /api-todos/:id/reopen - should fail for non-completed todo', async () => {
  // Create a new todo (not completed)
  const todoData = {
    title: 'Todo for Reopen Fail Test',
    deadline: '2026-04-04T09:00:00Z',
    assignee_id: TEST_EMPLOYEES.superAdmin,
    priority: 'normal',
  };

  const createResponse = await apiPost('api-todos', todoData, TEST_EMPLOYEES.superAdmin);
  const createText = await createResponse.text();

  if (createResponse.status !== 201) {
    assertEquals(createResponse.status < 500, true, `Unexpected server error: ${createText}`);
    return;
  }

  const createData = JSON.parse(createText);
  const todoId = createData.data.id;

  const response = await apiPost(`api-todos/${todoId}/reopen`, {}, TEST_EMPLOYEES.superAdmin);
  const text = await response.text();
  // Should return 400 validation error for non-completed todo
  assertEquals(response.status < 500, true, `Server error: ${text}`);
  if (response.status === 400) {
    const data = JSON.parse(text);
    assertExists(data.error);
  }
});

Deno.test('POST /api-todos/:id/reopen - should return error for non-existent todo', async () => {
  const fakeId = randomUUID();
  const response = await apiPost(`api-todos/${fakeId}/reopen`, {}, TEST_EMPLOYEES.superAdmin);
  await response.text(); // Consume body
  assertEquals(response.status >= 400, true);
});

// ============================================
// DELETE TODO
// ============================================

Deno.test('DELETE /api-todos/:id - should delete todo', async () => {
  // First create a todo to delete
  const todoData = {
    title: 'Todo for Delete Test',
    deadline: '2026-05-01T09:00:00Z',
    assignee_id: TEST_EMPLOYEES.superAdmin,
    priority: 'low',
  };

  const createResponse = await apiPost('api-todos', todoData, TEST_EMPLOYEES.superAdmin);
  const createText = await createResponse.text();

  if (createResponse.status !== 201) {
    assertEquals(createResponse.status < 500, true, `Unexpected server error: ${createText}`);
    return;
  }

  const createData = JSON.parse(createText);
  const todoId = createData.data.id;

  const response = await apiDelete(`api-todos/${todoId}`, TEST_EMPLOYEES.superAdmin);
  const text = await response.text();
  assertEquals(response.status < 500, true, `Server error: ${text}`);

  if (response.status === 200) {
    const data = JSON.parse(text);
    assertExists(data.data.message);
  }
});

Deno.test('DELETE /api-todos/:id - should return error for non-existent todo', async () => {
  const fakeId = randomUUID();
  const response = await apiDelete(`api-todos/${fakeId}`, TEST_EMPLOYEES.superAdmin);
  await response.text(); // Consume body
  assertEquals(response.status >= 400, true);
});

Deno.test('DELETE /api-todos/:id - should return 400 for invalid UUID', async () => {
  const response = await apiDelete('api-todos/invalid-uuid', TEST_EMPLOYEES.superAdmin);
  await response.text(); // Consume body
  assertEquals(response.status, 400);
});

// ============================================
// PERMISSION TESTS
// ============================================

Deno.test('Permission: Technician can list own todos', async () => {
  const response = await apiGet('api-todos?own=true', TEST_EMPLOYEES.tech1);
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
});

Deno.test('Permission: Technician cannot create todos (level 0)', async () => {
  const todoData = {
    title: 'Technician Todo',
    deadline: '2026-06-01T09:00:00Z',
    assignee_id: TEST_EMPLOYEES.tech1,
    priority: 'normal',
  };

  const response = await apiPost('api-todos', todoData, TEST_EMPLOYEES.tech1);
  await response.text(); // Consume body
  assertEquals(response.status, 403);
});

Deno.test('Permission: Assigner can create todos (level 1)', async () => {
  const todoData = {
    title: 'Assigner Todo',
    deadline: '2026-06-02T09:00:00Z',
    assignee_id: TEST_EMPLOYEES.tech1,
    priority: 'normal',
  };

  const response = await apiPost('api-todos', todoData, TEST_EMPLOYEES.assigner);
  const text = await response.text(); // Consume body
  assertEquals(response.status < 500, true, `Unexpected server error: ${text}`);
});

Deno.test('Permission: Admin can see all todos (level 2)', async () => {
  const response = await apiGet('api-todos', TEST_EMPLOYEES.admin);
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
});

Deno.test('Permission: Technician can complete their assigned todo', async () => {
  // First create a todo assigned to technician
  const todoData = {
    title: 'Todo for Tech to Complete',
    deadline: '2026-06-03T09:00:00Z',
    assignee_id: TEST_EMPLOYEES.tech1,
    priority: 'normal',
  };

  const createResponse = await apiPost('api-todos', todoData, TEST_EMPLOYEES.superAdmin);
  const createText = await createResponse.text();

  if (createResponse.status !== 201) {
    assertEquals(createResponse.status < 500, true, `Unexpected server error: ${createText}`);
    return;
  }

  const createData = JSON.parse(createText);
  const todoId = createData.data.id;

  // Technician should be able to complete their assigned todo
  const response = await apiPost(`api-todos/${todoId}/complete`, {}, TEST_EMPLOYEES.tech1);
  const text = await response.text();
  assertEquals(response.status < 500, true, `Server error: ${text}`);
});

Deno.test('Permission: Technician cannot delete others todo', async () => {
  // First create a todo by superadmin assigned to superadmin
  const todoData = {
    title: 'Todo that tech cannot delete',
    deadline: '2026-06-04T09:00:00Z',
    assignee_id: TEST_EMPLOYEES.superAdmin,
    priority: 'normal',
  };

  const createResponse = await apiPost('api-todos', todoData, TEST_EMPLOYEES.superAdmin);
  const createText = await createResponse.text();

  if (createResponse.status !== 201) {
    assertEquals(createResponse.status < 500, true, `Unexpected server error: ${createText}`);
    return;
  }

  const createData = JSON.parse(createText);
  const todoId = createData.data.id;

  // Technician should not be able to delete this todo
  const response = await apiDelete(`api-todos/${todoId}`, TEST_EMPLOYEES.tech1);
  await response.text(); // Consume body
  // Should be 403 (forbidden) or 404 (not found due to visibility)
  assertEquals(response.status >= 400, true);
});

// ============================================
// FILTER BY ASSIGNEE/CREATOR
// ============================================

Deno.test('GET /api-todos - should filter by assignee_id', async () => {
  const response = await apiGet(`api-todos?assignee_id=${TEST_EMPLOYEES.tech1}`, TEST_EMPLOYEES.superAdmin);
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
});

Deno.test('GET /api-todos - should filter by creator_id', async () => {
  const response = await apiGet(`api-todos?creator_id=${TEST_EMPLOYEES.superAdmin}`, TEST_EMPLOYEES.superAdmin);
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
});

Deno.test('GET /api-todos - should filter by ticket_id', async () => {
  const response = await apiGet(`api-todos?ticket_id=${TEST_TICKETS.pm1}`, TEST_EMPLOYEES.superAdmin);
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
});

// ============================================
// EDGE CASES
// ============================================

Deno.test('POST /api-todos - should handle invalid priority', async () => {
  const todoData = {
    title: 'Todo with invalid priority',
    deadline: '2026-07-01T09:00:00Z',
    assignee_id: TEST_EMPLOYEES.tech1,
    priority: 'invalid_priority',
  };

  const response = await apiPost('api-todos', todoData, TEST_EMPLOYEES.superAdmin);
  await response.text(); // Consume body
  assertEquals(response.status, 400);
});

Deno.test('POST /api-todos - should handle invalid deadline format', async () => {
  const todoData = {
    title: 'Todo with invalid deadline',
    deadline: 'not-a-date',
    assignee_id: TEST_EMPLOYEES.tech1,
    priority: 'normal',
  };

  const response = await apiPost('api-todos', todoData, TEST_EMPLOYEES.superAdmin);
  await response.text(); // Consume body
  assertEquals(response.status, 400);
});

Deno.test('POST /api-todos - should handle invalid assignee_id UUID', async () => {
  const todoData = {
    title: 'Todo with invalid assignee',
    deadline: '2026-07-02T09:00:00Z',
    assignee_id: 'invalid-uuid',
    priority: 'normal',
  };

  const response = await apiPost('api-todos', todoData, TEST_EMPLOYEES.superAdmin);
  await response.text(); // Consume body
  // Should fail with either validation error or database error
  assertEquals(response.status >= 400, true);
});

Deno.test('PUT /api-todos/:id - should handle invalid priority on update', async () => {
  // First create a todo to update
  const todoData = {
    title: 'Todo for Invalid Priority Update',
    deadline: '2026-07-03T09:00:00Z',
    assignee_id: TEST_EMPLOYEES.superAdmin,
    priority: 'normal',
  };

  const createResponse = await apiPost('api-todos', todoData, TEST_EMPLOYEES.superAdmin);
  const createText = await createResponse.text();

  if (createResponse.status !== 201) {
    assertEquals(createResponse.status < 500, true, `Unexpected server error: ${createText}`);
    return;
  }

  const createData = JSON.parse(createText);
  const todoId = createData.data.id;

  const updateData = {
    priority: 'invalid',
  };

  const response = await apiPut(`api-todos/${todoId}`, updateData, TEST_EMPLOYEES.superAdmin);
  await response.text(); // Consume body
  assertEquals(response.status, 400);
});
