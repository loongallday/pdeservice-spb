/**
 * Unit tests for Merchandise API handlers
 * Tests validation logic and permission checks only
 */

import { assertEquals, assertRejects } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { list } from '../../supabase/functions/api-merchandise/handlers/list.ts';
import { get } from '../../supabase/functions/api-merchandise/handlers/get.ts';
import { create } from '../../supabase/functions/api-merchandise/handlers/create.ts';
import { update } from '../../supabase/functions/api-merchandise/handlers/update.ts';
import { deleteMerchandise } from '../../supabase/functions/api-merchandise/handlers/delete.ts';
import { createMockRequest, createMockJsonRequest, createMockEmployeeWithLevel, assertSuccessResponse } from '../_shared/mocks.ts';

const mockMerchandise = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  serial_no: 'SN001',
  model_id: '123e4567-e89b-12d3-a456-426614174001',
  site_id: '123e4567-e89b-12d3-a456-426614174002',
  status: 'active',
};

// ============ Handler Existence Tests ============

Deno.test('list handler exists', () => {
  assertEquals(typeof list, 'function');
});

Deno.test('get handler exists', () => {
  assertEquals(typeof get, 'function');
});

Deno.test('create handler exists', () => {
  assertEquals(typeof create, 'function');
});

Deno.test('update handler exists', () => {
  assertEquals(typeof update, 'function');
});

Deno.test('deleteMerchandise handler exists', () => {
  assertEquals(typeof deleteMerchandise, 'function');
});

// ============ Permission Tests ============

Deno.test('create - requires level 1', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockJsonRequest('POST', 'http://localhost/api-merchandise', {
    serial_no: 'SN002',
    model_id: mockMerchandise.model_id,
  });

  await assertRejects(
    async () => await create(request, employee),
    Error,
    'ต้องมีสิทธิ์ระดับ 1'
  );
});

Deno.test('update - requires level 1', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockJsonRequest('PUT', `http://localhost/api-merchandise/${mockMerchandise.id}`, {
    status: 'inactive',
  });

  await assertRejects(
    async () => await update(request, employee, mockMerchandise.id),
    Error,
    'ต้องมีสิทธิ์ระดับ 1'
  );
});

Deno.test('delete - requires level 2', async () => {
  const employee = createMockEmployeeWithLevel(1);
  const request = createMockRequest('DELETE', `http://localhost/api-merchandise/${mockMerchandise.id}`);

  await assertRejects(
    async () => await deleteMerchandise(request, employee, mockMerchandise.id),
    Error,
    'ต้องมีสิทธิ์ระดับ 2'
  );
});

// ============ Mocked Success Tests ============

Deno.test('get - success with mocking', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', `http://localhost/api-merchandise/${mockMerchandise.id}`);

  const module = await import('../../supabase/functions/api-merchandise/services/merchandiseService.ts');
  const originalGetById = module.MerchandiseService.getById;
  module.MerchandiseService.getById = async () => mockMerchandise;

  try {
    const response = await get(request, employee, mockMerchandise.id);
    assertEquals(response.status, 200);
  } finally {
    module.MerchandiseService.getById = originalGetById;
  }
});

Deno.test('create - success with level 1', async () => {
  const employee = createMockEmployeeWithLevel(1);
  const request = createMockJsonRequest('POST', 'http://localhost/api-merchandise', {
    serial_no: 'SN002',
    model_id: mockMerchandise.model_id,
  });

  const module = await import('../../supabase/functions/api-merchandise/services/merchandiseService.ts');
  const originalCreate = module.MerchandiseService.create;
  module.MerchandiseService.create = async () => mockMerchandise;

  try {
    const response = await create(request, employee);
    assertEquals(response.status, 201);
  } finally {
    module.MerchandiseService.create = originalCreate;
  }
});

Deno.test('update - success with level 1', async () => {
  const employee = createMockEmployeeWithLevel(1);
  const request = createMockJsonRequest('PUT', `http://localhost/api-merchandise/${mockMerchandise.id}`, {
    status: 'inactive',
  });

  const module = await import('../../supabase/functions/api-merchandise/services/merchandiseService.ts');
  const originalUpdate = module.MerchandiseService.update;
  module.MerchandiseService.update = async () => ({ ...mockMerchandise, status: 'inactive' });

  try {
    const response = await update(request, employee, mockMerchandise.id);
    assertEquals(response.status, 200);
  } finally {
    module.MerchandiseService.update = originalUpdate;
  }
});

Deno.test('delete - success with level 2', async () => {
  const employee = createMockEmployeeWithLevel(2);
  const request = createMockRequest('DELETE', `http://localhost/api-merchandise/${mockMerchandise.id}`);

  const module = await import('../../supabase/functions/api-merchandise/services/merchandiseService.ts');
  const originalDelete = module.MerchandiseService.delete;
  module.MerchandiseService.delete = async () => {};

  try {
    const response = await deleteMerchandise(request, employee, mockMerchandise.id);
    assertEquals(response.status, 200);
  } finally {
    module.MerchandiseService.delete = originalDelete;
  }
});

