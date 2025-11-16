/**
 * Unit tests for Tickets API handlers
 */

import { assertEquals, assertRejects } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { list } from '../../supabase/functions/api-tickets/handlers/list.ts';
import { get } from '../../supabase/functions/api-tickets/handlers/get.ts';
import { create } from '../../supabase/functions/api-tickets/handlers/create.ts';
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

