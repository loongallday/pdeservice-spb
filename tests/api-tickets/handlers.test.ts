/**
 * Unit tests for Tickets API handlers
 */

import { assertEquals, assertRejects } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { list } from '../../supabase/functions/api-tickets/handlers/list.ts';
import { get } from '../../supabase/functions/api-tickets/handlers/get.ts';
import { create } from '../../supabase/functions/api-tickets/handlers/create.ts';
import { listMerchandise } from '../../supabase/functions/api-tickets/handlers/listMerchandise.ts';
import { addMerchandise } from '../../supabase/functions/api-tickets/handlers/addMerchandise.ts';
import { removeMerchandise } from '../../supabase/functions/api-tickets/handlers/removeMerchandise.ts';
import { createMockRequest, createMockJsonRequest, createMockEmployeeWithLevel, assertSuccessResponse } from '../_shared/mocks.ts';

const mockTicket = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  company_id: '1234567890123',
  site_id: '123e4567-e89b-12d3-a456-426614174001',
  work_type_id: '123e4567-e89b-12d3-a456-426614174002',
  description: 'Test ticket',
};

Deno.test('list tickets - success', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-tickets?page=1&limit=20');

  // Mock TicketService.getAll
  const originalGetAll = (await import('../../supabase/functions/api-tickets/services/ticketService.ts')).TicketService.getAll;
  (await import('../../supabase/functions/api-tickets/services/ticketService.ts')).TicketService.getAll = async () => ({
    data: [mockTicket],
    pagination: { page: 1, limit: 20, total: 1, totalPages: 1, hasNext: false, hasPrevious: false },
  });

  try {
    const response = await list(request, employee);
    const data = await assertSuccessResponse<{ data: unknown[]; pagination: unknown }>(response);
    assertEquals(Array.isArray(data.data), true);
  } finally {
    (await import('../../supabase/functions/api-tickets/services/ticketService.ts')).TicketService.getAll = originalGetAll;
  }
});

Deno.test('create ticket - requires level 1', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockJsonRequest('POST', 'http://localhost/api-tickets', {
    work_type_id: '123e4567-e89b-12d3-a456-426614174002',
    status_id: '123e4567-e89b-12d3-a456-426614174003',
  });

  await assertRejects(
    async () => await create(request, employee),
    Error,
    'ไม่มีสิทธิ์เข้าถึง'
  );
});

Deno.test('list tickets - pagination with filters', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-tickets?page=1&limit=10&status_id=123&work_type_id=456&employee_id=789&site_id=abc');

  // Mock TicketService.getAll
  const originalGetAll = (await import('../../supabase/functions/api-tickets/services/ticketService.ts')).TicketService.getAll;
  (await import('../../supabase/functions/api-tickets/services/ticketService.ts')).TicketService.getAll = async () => ({
    data: [mockTicket],
    pagination: { page: 1, limit: 10, total: 1, totalPages: 1, hasNext: false, hasPrevious: false },
  });

  try {
    const response = await list(request, employee);
    const data = await assertSuccessResponse<{ data: unknown[]; pagination: unknown }>(response);
    assertEquals(Array.isArray(data.data), true);
  } finally {
    (await import('../../supabase/functions/api-tickets/services/ticketService.ts')).TicketService.getAll = originalGetAll;
  }
});

Deno.test('list tickets - date range filters', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-tickets?start_date=2025-01-01&end_date=2025-12-31');

  // Mock TicketService.getAll
  const originalGetAll = (await import('../../supabase/functions/api-tickets/services/ticketService.ts')).TicketService.getAll;
  (await import('../../supabase/functions/api-tickets/services/ticketService.ts')).TicketService.getAll = async () => ({
    data: [mockTicket],
    pagination: { page: 1, limit: 20, total: 1, totalPages: 1, hasNext: false, hasPrevious: false },
  });

  try {
    const response = await list(request, employee);
    const data = await assertSuccessResponse<{ data: unknown[]; pagination: unknown }>(response);
    assertEquals(Array.isArray(data.data), true);
  } finally {
    (await import('../../supabase/functions/api-tickets/services/ticketService.ts')).TicketService.getAll = originalGetAll;
  }
});

Deno.test('list tickets - backlog filters', async () => {
  const employee = createMockEmployeeWithLevel(0);
  
  // Test exclude_backlog
  const request1 = createMockRequest('GET', 'http://localhost/api-tickets?exclude_backlog=true');
  const originalGetAll = (await import('../../supabase/functions/api-tickets/services/ticketService.ts')).TicketService.getAll;
  (await import('../../supabase/functions/api-tickets/services/ticketService.ts')).TicketService.getAll = async () => ({
    data: [mockTicket],
    pagination: { page: 1, limit: 20, total: 1, totalPages: 1, hasNext: false, hasPrevious: false },
  });

  try {
    const response = await list(request1, employee);
    const data = await assertSuccessResponse<{ data: unknown[]; pagination: unknown }>(response);
    assertEquals(Array.isArray(data.data), true);
  } finally {
    (await import('../../supabase/functions/api-tickets/services/ticketService.ts')).TicketService.getAll = originalGetAll;
  }
});

// Merchandise tests
const ticketId = '123e4567-e89b-12d3-a456-426614174000';
const merchandiseId = '123e4567-e89b-12d3-a456-426614174010';

const mockMerchandise = {
  id: '123e4567-e89b-12d3-a456-426614174011',
  created_at: '2025-11-18T00:00:00Z',
  merchandise: {
    id: merchandiseId,
    serial_no: 'SN12345',
    model_id: '123e4567-e89b-12d3-a456-426614174012',
    site_id: '123e4567-e89b-12d3-a456-426614174001',
    pm_count: 10,
    model: {
      id: '123e4567-e89b-12d3-a456-426614174012',
      model: 'MODEL-001',
      name: 'Test Model',
    },
    site: {
      id: '123e4567-e89b-12d3-a456-426614174001',
      name: 'Test Site',
    },
  },
};

Deno.test('list merchandise - success', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', `http://localhost/api-tickets/${ticketId}/merchandise`);

  // Mock TicketService.getMerchandise
  const originalGetMerchandise = (await import('../../supabase/functions/api-tickets/services/ticketService.ts')).TicketService.getMerchandise;
  (await import('../../supabase/functions/api-tickets/services/ticketService.ts')).TicketService.getMerchandise = async () => [mockMerchandise];

  try {
    const response = await listMerchandise(request, employee, ticketId);
    const data = await assertSuccessResponse<unknown[]>(response);
    assertEquals(Array.isArray(data), true);
    assertEquals(data.length, 1);
  } finally {
    (await import('../../supabase/functions/api-tickets/services/ticketService.ts')).TicketService.getMerchandise = originalGetMerchandise;
  }
});

Deno.test('list merchandise - requires level 0', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', `http://localhost/api-tickets/${ticketId}/merchandise`);

  // Mock TicketService.getMerchandise
  const originalGetMerchandise = (await import('../../supabase/functions/api-tickets/services/ticketService.ts')).TicketService.getMerchandise;
  (await import('../../supabase/functions/api-tickets/services/ticketService.ts')).TicketService.getMerchandise = async () => [];

  try {
    const response = await listMerchandise(request, employee, ticketId);
    const data = await assertSuccessResponse<unknown[]>(response);
    assertEquals(Array.isArray(data), true);
  } finally {
    (await import('../../supabase/functions/api-tickets/services/ticketService.ts')).TicketService.getMerchandise = originalGetMerchandise;
  }
});

Deno.test('add merchandise - success', async () => {
  const employee = createMockEmployeeWithLevel(1);
  const request = createMockJsonRequest('POST', `http://localhost/api-tickets/${ticketId}/merchandise`, {
    merchandise_id: merchandiseId,
  });

  // Mock TicketService.addMerchandise
  const originalAddMerchandise = (await import('../../supabase/functions/api-tickets/services/ticketService.ts')).TicketService.addMerchandise;
  (await import('../../supabase/functions/api-tickets/services/ticketService.ts')).TicketService.addMerchandise = async () => ({ data: mockMerchandise, created: true });

  try {
    const response = await addMerchandise(request, employee, ticketId);
    const data = await assertSuccessResponse<{ id: string }>(response, 201);
    assertEquals(data.id, mockMerchandise.id);
  } finally {
    (await import('../../supabase/functions/api-tickets/services/ticketService.ts')).TicketService.addMerchandise = originalAddMerchandise;
  }
});

Deno.test('add merchandise - requires level 1', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockJsonRequest('POST', `http://localhost/api-tickets/${ticketId}/merchandise`, {
    merchandise_id: merchandiseId,
  });

  await assertRejects(
    async () => await addMerchandise(request, employee, ticketId),
    Error,
    'ต้องมีสิทธิ์ระดับ 1'
  );
});

Deno.test('add merchandise - missing merchandise_id', async () => {
  const employee = createMockEmployeeWithLevel(1);
  const request = createMockJsonRequest('POST', `http://localhost/api-tickets/${ticketId}/merchandise`, {});

  await assertRejects(
    async () => await addMerchandise(request, employee, ticketId),
    Error,
    'Merchandise ID'
  );
});

Deno.test('add merchandise - invalid UUID', async () => {
  const employee = createMockEmployeeWithLevel(1);
  const request = createMockJsonRequest('POST', `http://localhost/api-tickets/${ticketId}/merchandise`, {
    merchandise_id: 'invalid-uuid',
  });

  await assertRejects(
    async () => await addMerchandise(request, employee, ticketId),
    Error,
    'ไม่ถูกต้อง'
  );
});

Deno.test('add merchandise - already linked (idempotent)', async () => {
  const employee = createMockEmployeeWithLevel(1);
  const request = createMockJsonRequest('POST', `http://localhost/api-tickets/${ticketId}/merchandise`, {
    merchandise_id: merchandiseId,
  });

  // Mock TicketService.addMerchandise to return existing (created: false)
  const originalAddMerchandise = (await import('../../supabase/functions/api-tickets/services/ticketService.ts')).TicketService.addMerchandise;
  (await import('../../supabase/functions/api-tickets/services/ticketService.ts')).TicketService.addMerchandise = async () => ({ data: mockMerchandise, created: false });

  try {
    const response = await addMerchandise(request, employee, ticketId);
    // Should return 200 OK (not 201) when already exists
    const data = await assertSuccessResponse<{ id: string }>(response, 200);
    assertEquals(data.id, mockMerchandise.id);
  } finally {
    (await import('../../supabase/functions/api-tickets/services/ticketService.ts')).TicketService.addMerchandise = originalAddMerchandise;
  }
});

Deno.test('remove merchandise - success', async () => {
  const employee = createMockEmployeeWithLevel(1);
  const request = createMockRequest('DELETE', `http://localhost/api-tickets/${ticketId}/merchandise/${merchandiseId}`);

  // Mock TicketService.removeMerchandise
  const originalRemoveMerchandise = (await import('../../supabase/functions/api-tickets/services/ticketService.ts')).TicketService.removeMerchandise;
  (await import('../../supabase/functions/api-tickets/services/ticketService.ts')).TicketService.removeMerchandise = async () => {};

  try {
    const response = await removeMerchandise(request, employee, ticketId, merchandiseId);
    const data = await assertSuccessResponse<{ message: string }>(response);
    assertEquals(data.message, 'ลบการเชื่อมโยงอุปกรณ์สำเร็จ');
  } finally {
    (await import('../../supabase/functions/api-tickets/services/ticketService.ts')).TicketService.removeMerchandise = originalRemoveMerchandise;
  }
});

Deno.test('remove merchandise - requires level 1', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('DELETE', `http://localhost/api-tickets/${ticketId}/merchandise/${merchandiseId}`);

  await assertRejects(
    async () => await removeMerchandise(request, employee, ticketId, merchandiseId),
    Error,
    'ต้องมีสิทธิ์ระดับ 1'
  );
});

Deno.test('remove merchandise - invalid ticket UUID', async () => {
  const employee = createMockEmployeeWithLevel(1);
  const request = createMockRequest('DELETE', `http://localhost/api-tickets/invalid-uuid/merchandise/${merchandiseId}`);

  await assertRejects(
    async () => await removeMerchandise(request, employee, 'invalid-uuid', merchandiseId),
    Error,
    'ไม่ถูกต้อง'
  );
});

Deno.test('remove merchandise - invalid merchandise UUID', async () => {
  const employee = createMockEmployeeWithLevel(1);
  const request = createMockRequest('DELETE', `http://localhost/api-tickets/${ticketId}/merchandise/invalid-uuid`);

  await assertRejects(
    async () => await removeMerchandise(request, employee, ticketId, 'invalid-uuid'),
    Error,
    'ไม่ถูกต้อง'
  );
});

