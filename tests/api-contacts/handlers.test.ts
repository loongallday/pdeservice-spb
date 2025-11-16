/**
 * Unit tests for Contacts API handlers
 */

import { assertEquals, assertRejects } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { list } from '../../supabase/functions/api-contacts/handlers/list.ts';
import { create } from '../../supabase/functions/api-contacts/handlers/create.ts';
import { createMockRequest, createMockJsonRequest, createMockEmployeeWithLevel, assertSuccessResponse } from '../_shared/mocks.ts';

const mockContact = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  site_id: '123e4567-e89b-12d3-a456-426614174001',
  person_name: 'John Doe',
  phone: '0812345678',
  email: 'john@example.com',
};

Deno.test('list contacts - success', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-contacts?page=1&limit=20');

  // Mock ContactService.getAll
  const originalGetAll = (await import('../../supabase/functions/api-contacts/services/contactService.ts')).ContactService.getAll;
  (await import('../../supabase/functions/api-contacts/services/contactService.ts')).ContactService.getAll = async () => ({
    data: [mockContact],
    pagination: { page: 1, limit: 20, total: 1, totalPages: 1, hasNext: false, hasPrevious: false },
  });

  try {
    const response = await list(request, employee);
    const data = await assertSuccessResponse<{ data: unknown[]; pagination: unknown }>(response);
    assertEquals(Array.isArray(data.data), true);
  } finally {
    (await import('../../supabase/functions/api-contacts/services/contactService.ts')).ContactService.getAll = originalGetAll;
  }
});

Deno.test('create contact - requires level 1', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockJsonRequest('POST', 'http://localhost/api-contacts', {
    site_id: '123e4567-e89b-12d3-a456-426614174001',
    person_name: 'John Doe',
  });

  await assertRejects(
    async () => await create(request, employee),
    Error,
    'ต้องมีสิทธิ์ระดับ 1'
  );
});

Deno.test('list contacts - filtering by site_id', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-contacts?site_id=123e4567-e89b-12d3-a456-426614174001');

  // Mock ContactService.getAll
  const originalGetAll = (await import('../../supabase/functions/api-contacts/services/contactService.ts')).ContactService.getAll;
  (await import('../../supabase/functions/api-contacts/services/contactService.ts')).ContactService.getAll = async () => ({
    data: [mockContact],
    pagination: { page: 1, limit: 20, total: 1, totalPages: 1, hasNext: false, hasPrevious: false },
  });

  try {
    const response = await list(request, employee);
    const data = await assertSuccessResponse<{ data: unknown[]; pagination: unknown }>(response);
    assertEquals(Array.isArray(data.data), true);
  } finally {
    (await import('../../supabase/functions/api-contacts/services/contactService.ts')).ContactService.getAll = originalGetAll;
  }
});

Deno.test('list contacts - pagination with site filter', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-contacts?page=2&limit=5&site_id=123e4567-e89b-12d3-a456-426614174001');

  // Mock ContactService.getAll
  const originalGetAll = (await import('../../supabase/functions/api-contacts/services/contactService.ts')).ContactService.getAll;
  (await import('../../supabase/functions/api-contacts/services/contactService.ts')).ContactService.getAll = async () => ({
    data: [mockContact],
    pagination: { page: 2, limit: 5, total: 10, totalPages: 2, hasNext: false, hasPrevious: true },
  });

  try {
    const response = await list(request, employee);
    const data = await assertSuccessResponse<{ data: unknown[]; pagination: { page: number; limit: number; total: number; totalPages: number; hasNext: boolean; hasPrevious: boolean } }>(response);
    assertEquals(data.pagination.page, 2);
    assertEquals(data.pagination.limit, 5);
    assertEquals(data.pagination.total, 10);
    assertEquals(data.pagination.totalPages, 2);
    assertEquals(data.pagination.hasNext, false);
    assertEquals(data.pagination.hasPrevious, true);
  } finally {
    (await import('../../supabase/functions/api-contacts/services/contactService.ts')).ContactService.getAll = originalGetAll;
  }
});

