/**
 * Unit tests for Prizes API handlers
 */

import { assertEquals, assertRejects } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { handleList } from '../../supabase/functions/api-prizes/handlers/list.ts';
import { handleGet } from '../../supabase/functions/api-prizes/handlers/get.ts';
import { handleCreate } from '../../supabase/functions/api-prizes/handlers/create.ts';
import { handleUpdate } from '../../supabase/functions/api-prizes/handlers/update.ts';
import { handleDelete } from '../../supabase/functions/api-prizes/handlers/delete.ts';
import { handleListWinners } from '../../supabase/functions/api-prizes/handlers/listWinners.ts';
import { handleAssignPrize } from '../../supabase/functions/api-prizes/handlers/assignPrize.ts';
import { handleUnassignPrize } from '../../supabase/functions/api-prizes/handlers/unassignPrize.ts';
import { createMockRequest, createMockJsonRequest, createMockEmployeeWithLevel, assertSuccessResponse } from '../_shared/mocks.ts';

// Mock data
const mockPrize = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  name: 'Test Prize',
  image_url: 'https://example.com/prize.jpg',
  created_at: '2025-12-01T00:00:00Z',
};

const mockWinner = {
  id: '123e4567-e89b-12d3-a456-426614174001',
  prize_id: '123e4567-e89b-12d3-a456-426614174000',
  user_id: '123e4567-e89b-12d3-a456-426614174002',
  assigned_at: '2025-12-01T00:00:00Z',
  prize: mockPrize,
  user: {
    id: '123e4567-e89b-12d3-a456-426614174002',
    name: 'Test User',
  },
};

// ============================================================================
// LIST PRIZES TESTS
// ============================================================================

Deno.test('handleList - success with pagination', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-prizes?page=1&limit=20');

  // Mock prizeService.getAll
  const originalGetAll = (await import('../../supabase/functions/api-prizes/services/prizeService.ts')).getAll;
  (await import('../../supabase/functions/api-prizes/services/prizeService.ts')).getAll = async () => ({
    data: [mockPrize],
    pagination: {
      page: 1,
      limit: 20,
      total: 1,
      totalPages: 1,
      hasNext: false,
      hasPrevious: false,
    },
  });

  try {
    const response = await handleList(request);
    const data = await assertSuccessResponse<{ data: unknown[]; pagination: unknown }>(response);
    assertEquals(Array.isArray(data.data), true);
    assertEquals(data.pagination.page, 1);
    assertEquals(data.pagination.limit, 20);
    assertEquals(data.pagination.hasNext, false);
    assertEquals(data.pagination.hasPrevious, false);
  } finally {
    (await import('../../supabase/functions/api-prizes/services/prizeService.ts')).getAll = originalGetAll;
  }
});

Deno.test('handleList - empty results', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-prizes?page=1&limit=20');

  // Mock prizeService.getAll
  const originalGetAll = (await import('../../supabase/functions/api-prizes/services/prizeService.ts')).getAll;
  (await import('../../supabase/functions/api-prizes/services/prizeService.ts')).getAll = async () => ({
    data: [],
    pagination: {
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 0,
      hasNext: false,
      hasPrevious: false,
    },
  });

  try {
    const response = await handleList(request);
    const data = await assertSuccessResponse<{ data: unknown[]; pagination: unknown }>(response);
    assertEquals(Array.isArray(data.data), true);
    assertEquals(data.data.length, 0);
  } finally {
    (await import('../../supabase/functions/api-prizes/services/prizeService.ts')).getAll = originalGetAll;
  }
});

// ============================================================================
// GET PRIZE TESTS
// ============================================================================

Deno.test('handleGet - success by id', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-prizes/123e4567-e89b-12d3-a456-426614174000');

  // Mock prizeService.getById
  const originalGetById = (await import('../../supabase/functions/api-prizes/services/prizeService.ts')).getById;
  (await import('../../supabase/functions/api-prizes/services/prizeService.ts')).getById = async () => mockPrize;

  try {
    const response = await handleGet(request, '123e4567-e89b-12d3-a456-426614174000');
    const data = await assertSuccessResponse<typeof mockPrize>(response);
    assertEquals(data.id, mockPrize.id);
    assertEquals(data.name, mockPrize.name);
  } finally {
    (await import('../../supabase/functions/api-prizes/services/prizeService.ts')).getById = originalGetById;
  }
});

// ============================================================================
// CREATE PRIZE TESTS
// ============================================================================

Deno.test('handleCreate - success', async () => {
  const employee = createMockEmployeeWithLevel(2);
  const requestBody = {
    name: 'New Test Prize',
    image_url: 'https://example.com/new-prize.jpg',
  };
  const request = createMockJsonRequest('POST', 'http://localhost/api-prizes', requestBody);

  // Mock prizeService.create
  const originalCreate = (await import('../../supabase/functions/api-prizes/services/prizeService.ts')).create;
  (await import('../../supabase/functions/api-prizes/services/prizeService.ts')).create = async () => ({
    ...mockPrize,
    ...requestBody,
  });

  try {
    const response = await handleCreate(request);
    const data = await assertSuccessResponse<typeof mockPrize>(response, 201);
    assertEquals(data.name, requestBody.name);
    assertEquals(data.image_url, requestBody.image_url);
  } finally {
    (await import('../../supabase/functions/api-prizes/services/prizeService.ts')).create = originalCreate;
  }
});

Deno.test('handleCreate - requires level 2', async () => {
  const employee = createMockEmployeeWithLevel(1);
  const requestBody = { name: 'Test Prize' };
  const request = createMockJsonRequest('POST', 'http://localhost/api-prizes', requestBody);

  await assertRejects(
    async () => await handleCreate(request),
    Error,
    'ต้องมีสิทธิ์ระดับ 2'
  );
});

Deno.test('handleCreate - missing required name', async () => {
  const employee = createMockEmployeeWithLevel(2);
  const requestBody = {}; // Missing name
  const request = createMockJsonRequest('POST', 'http://localhost/api-prizes', requestBody);

  await assertRejects(
    async () => await handleCreate(request),
    Error,
    'จำเป็นต้องระบุ ชื่อรางวัล'
  );
});

// ============================================================================
// UPDATE PRIZE TESTS
// ============================================================================

Deno.test('handleUpdate - success', async () => {
  const employee = createMockEmployeeWithLevel(2);
  const requestBody = {
    name: 'Updated Prize Name',
    image_url: 'https://example.com/updated-prize.jpg',
  };
  const request = createMockJsonRequest('PUT', 'http://localhost/api-prizes/123e4567-e89b-12d3-a456-426614174000', requestBody);

  // Mock prizeService.update
  const originalUpdate = (await import('../../supabase/functions/api-prizes/services/prizeService.ts')).update;
  (await import('../../supabase/functions/api-prizes/services/prizeService.ts')).update = async () => ({
    ...mockPrize,
    ...requestBody,
  });

  try {
    const response = await handleUpdate(request, '123e4567-e89b-12d3-a456-426614174000');
    const data = await assertSuccessResponse<typeof mockPrize>(response);
    assertEquals(data.name, requestBody.name);
    assertEquals(data.image_url, requestBody.image_url);
  } finally {
    (await import('../../supabase/functions/api-prizes/services/prizeService.ts')).update = originalUpdate;
  }
});

Deno.test('handleUpdate - requires level 2', async () => {
  const employee = createMockEmployeeWithLevel(1);
  const requestBody = { name: 'Updated Prize' };
  const request = createMockJsonRequest('PUT', 'http://localhost/api-prizes/123e4567-e89b-12d3-a456-426614174000', requestBody);

  await assertRejects(
    async () => await handleUpdate(request, '123e4567-e89b-12d3-a456-426614174000'),
    Error,
    'ต้องมีสิทธิ์ระดับ 2'
  );
});

// ============================================================================
// DELETE PRIZE TESTS
// ============================================================================

Deno.test('handleDelete - success', async () => {
  const employee = createMockEmployeeWithLevel(2);
  const request = createMockRequest('DELETE', 'http://localhost/api-prizes/123e4567-e89b-12d3-a456-426614174000');

  // Mock prizeService.remove
  const originalRemove = (await import('../../supabase/functions/api-prizes/services/prizeService.ts')).remove;
  (await import('../../supabase/functions/api-prizes/services/prizeService.ts')).remove = async () => mockPrize;

  try {
    const response = await handleDelete(request, '123e4567-e89b-12d3-a456-426614174000');
    const data = await assertSuccessResponse<typeof mockPrize>(response);
    assertEquals(data.id, mockPrize.id);
  } finally {
    (await import('../../supabase/functions/api-prizes/services/prizeService.ts')).remove = originalRemove;
  }
});

Deno.test('handleDelete - requires level 2', async () => {
  const employee = createMockEmployeeWithLevel(1);
  const request = createMockRequest('DELETE', 'http://localhost/api-prizes/123e4567-e89b-12d3-a456-426614174000');

  await assertRejects(
    async () => await handleDelete(request, '123e4567-e89b-12d3-a456-426614174000'),
    Error,
    'ต้องมีสิทธิ์ระดับ 2'
  );
});

// ============================================================================
// LIST WINNERS TESTS
// ============================================================================

Deno.test('handleListWinners - success with pagination', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-prizes/winners?page=1&limit=20');

  // Mock prizeService.getAllWinners
  const originalGetAllWinners = (await import('../../supabase/functions/api-prizes/services/prizeService.ts')).getAllWinners;
  (await import('../../supabase/functions/api-prizes/services/prizeService.ts')).getAllWinners = async () => ({
    data: [mockWinner],
    pagination: {
      page: 1,
      limit: 20,
      total: 1,
      totalPages: 1,
      hasNext: false,
      hasPrevious: false,
    },
  });

  try {
    const response = await handleListWinners(request);
    const data = await assertSuccessResponse<{ data: unknown[]; pagination: unknown }>(response);
    assertEquals(Array.isArray(data.data), true);
    assertEquals(data.pagination.page, 1);
    assertEquals(data.pagination.limit, 20);
  } finally {
    (await import('../../supabase/functions/api-prizes/services/prizeService.ts')).getAllWinners = originalGetAllWinners;
  }
});

// ============================================================================
// ASSIGN PRIZE TESTS
// ============================================================================

Deno.test('handleAssignPrize - success', async () => {
  const employee = createMockEmployeeWithLevel(2);
  const requestBody = {
    user_id: '123e4567-e89b-12d3-a456-426614174002',
  };
  const request = createMockJsonRequest('POST', 'http://localhost/api-prizes/123e4567-e89b-12d3-a456-426614174000/assign', requestBody);

  // Mock prizeService.assignPrize
  const originalAssignPrize = (await import('../../supabase/functions/api-prizes/services/prizeService.ts')).assignPrize;
  (await import('../../supabase/functions/api-prizes/services/prizeService.ts')).assignPrize = async () => mockWinner;

  try {
    const response = await handleAssignPrize(request, '123e4567-e89b-12d3-a456-426614174000');
    const data = await assertSuccessResponse<typeof mockWinner>(response, 201);
    assertEquals(data.prize_id, mockPrize.id);
    assertEquals(data.user_id, requestBody.user_id);
  } finally {
    (await import('../../supabase/functions/api-prizes/services/prizeService.ts')).assignPrize = originalAssignPrize;
  }
});

Deno.test('handleAssignPrize - requires level 2', async () => {
  const employee = createMockEmployeeWithLevel(1);
  const requestBody = { user_id: '123e4567-e89b-12d3-a456-426614174002' };
  const request = createMockJsonRequest('POST', 'http://localhost/api-prizes/123e4567-e89b-12d3-a456-426614174000/assign', requestBody);

  await assertRejects(
    async () => await handleAssignPrize(request, '123e4567-e89b-12d3-a456-426614174000'),
    Error,
    'ต้องมีสิทธิ์ระดับ 2'
  );
});

Deno.test('handleAssignPrize - missing required user_id', async () => {
  const employee = createMockEmployeeWithLevel(2);
  const requestBody = {}; // Missing user_id
  const request = createMockJsonRequest('POST', 'http://localhost/api-prizes/123e4567-e89b-12d3-a456-426614174000/assign', requestBody);

  await assertRejects(
    async () => await handleAssignPrize(request, '123e4567-e89b-12d3-a456-426614174000'),
    Error,
    'จำเป็นต้องระบุ User ID'
  );
});

// ============================================================================
// UNASSIGN PRIZE TESTS
// ============================================================================

Deno.test('handleUnassignPrize - success', async () => {
  const employee = createMockEmployeeWithLevel(2);
  const request = createMockRequest('DELETE', 'http://localhost/api-prizes/123e4567-e89b-12d3-a456-426614174000/unassign/123e4567-e89b-12d3-a456-426614174002');

  // Mock prizeService.unassignPrize
  const originalUnassignPrize = (await import('../../supabase/functions/api-prizes/services/prizeService.ts')).unassignPrize;
  (await import('../../supabase/functions/api-prizes/services/prizeService.ts')).unassignPrize = async () => mockWinner;

  try {
    const response = await handleUnassignPrize(request, '123e4567-e89b-12d3-a456-426614174000', '123e4567-e89b-12d3-a456-426614174002');
    const data = await assertSuccessResponse<typeof mockWinner>(response);
    assertEquals(data.prize_id, mockPrize.id);
    assertEquals(data.user_id, '123e4567-e89b-12d3-a456-426614174002');
  } finally {
    (await import('../../supabase/functions/api-prizes/services/prizeService.ts')).unassignPrize = originalUnassignPrize;
  }
});

Deno.test('handleUnassignPrize - requires level 2', async () => {
  const employee = createMockEmployeeWithLevel(1);
  const request = createMockRequest('DELETE', 'http://localhost/api-prizes/123e4567-e89b-12d3-a456-426614174000/unassign/123e4567-e89b-12d3-a456-426614174002');

  await assertRejects(
    async () => await handleUnassignPrize(request, '123e4567-e89b-12d3-a456-426614174000', '123e4567-e89b-12d3-a456-426614174002'),
    Error,
    'ต้องมีสิทธิ์ระดับ 2'
  );
});
