/**
 * Unit tests for Models API handlers
 */

import { assertEquals, assertRejects } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { list } from '../../supabase/functions/api-models/handlers/list.ts';
import { get } from '../../supabase/functions/api-models/handlers/get.ts';
import { create } from '../../supabase/functions/api-models/handlers/create.ts';
import { update } from '../../supabase/functions/api-models/handlers/update.ts';
import { deleteModel } from '../../supabase/functions/api-models/handlers/delete.ts';
import { getByModel } from '../../supabase/functions/api-models/handlers/getByModel.ts';
import { createMockRequest, createMockJsonRequest, createMockEmployeeWithLevel, assertSuccessResponse } from '../_shared/mocks.ts';

const mockModel = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  model: 'MODEL-001',
  name: 'Test Model',
  website_url: 'https://example.com/model-001',
  created_at: '2025-11-17T00:00:00Z',
  updated_at: '2025-11-17T00:00:00Z',
};

Deno.test('list models - success', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-models?page=1&limit=20');

  // Mock ModelService.getAll
  const originalGetAll = (await import('../../supabase/functions/api-models/services/modelService.ts')).ModelService.getAll;
  (await import('../../supabase/functions/api-models/services/modelService.ts')).ModelService.getAll = async () => ({
    data: [mockModel],
    pagination: { page: 1, limit: 20, total: 1, totalPages: 1, hasNext: false, hasPrevious: false },
  });

  try {
    const response = await list(request, employee);
    const data = await assertSuccessResponse<{ data: unknown[]; pagination: unknown }>(response);
    assertEquals(Array.isArray(data.data), true);
  } finally {
    (await import('../../supabase/functions/api-models/services/modelService.ts')).ModelService.getAll = originalGetAll;
  }
});

Deno.test('get model - success', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-models/123e4567-e89b-12d3-a456-426614174000');

  // Mock ModelService.getById
  const originalGetById = (await import('../../supabase/functions/api-models/services/modelService.ts')).ModelService.getById;
  (await import('../../supabase/functions/api-models/services/modelService.ts')).ModelService.getById = async () => mockModel;

  try {
    const response = await get(request, employee, '123e4567-e89b-12d3-a456-426614174000');
    const data = await assertSuccessResponse<typeof mockModel>(response);
    assertEquals(data.model, 'MODEL-001');
  } finally {
    (await import('../../supabase/functions/api-models/services/modelService.ts')).ModelService.getById = originalGetById;
  }
});

Deno.test('get model by code - success', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-models/model/MODEL-001');

  // Mock ModelService.getByModel
  const originalGetByModel = (await import('../../supabase/functions/api-models/services/modelService.ts')).ModelService.getByModel;
  (await import('../../supabase/functions/api-models/services/modelService.ts')).ModelService.getByModel = async () => mockModel;

  try {
    const response = await getByModel(request, employee, 'MODEL-001');
    const data = await assertSuccessResponse<typeof mockModel>(response);
    assertEquals(data.model, 'MODEL-001');
  } finally {
    (await import('../../supabase/functions/api-models/services/modelService.ts')).ModelService.getByModel = originalGetByModel;
  }
});

Deno.test('create model - requires level 2', async () => {
  const employee = createMockEmployeeWithLevel(1);
  const request = createMockJsonRequest('POST', 'http://localhost/api-models', {
    model: 'MODEL-002',
    name: 'New Model',
  });

  await assertRejects(
    async () => await create(request, employee),
    Error,
    'ต้องมีสิทธิ์ระดับ 2'
  );
});

Deno.test('create model - success', async () => {
  const employee = createMockEmployeeWithLevel(2);
  const request = createMockJsonRequest('POST', 'http://localhost/api-models', {
    model: 'MODEL-002',
    name: 'New Model',
    website_url: 'https://example.com/model-002',
  });

  // Mock ModelService.create
  const originalCreate = (await import('../../supabase/functions/api-models/services/modelService.ts')).ModelService.create;
  const newModel = { ...mockModel, model: 'MODEL-002', name: 'New Model' };
  (await import('../../supabase/functions/api-models/services/modelService.ts')).ModelService.create = async () => newModel;

  try {
    const response = await create(request, employee);
    const data = await assertSuccessResponse<typeof newModel>(response, 201);
    assertEquals(data.model, 'MODEL-002');
    assertEquals(response.status, 201);
  } finally {
    (await import('../../supabase/functions/api-models/services/modelService.ts')).ModelService.create = originalCreate;
  }
});

Deno.test('update model - requires level 2', async () => {
  const employee = createMockEmployeeWithLevel(1);
  const request = createMockJsonRequest('PUT', 'http://localhost/api-models/123e4567-e89b-12d3-a456-426614174000', {
    name: 'Updated Model Name',
  });

  await assertRejects(
    async () => await update(request, employee, '123e4567-e89b-12d3-a456-426614174000'),
    Error,
    'ต้องมีสิทธิ์ระดับ 2'
  );
});

Deno.test('update model - success', async () => {
  const employee = createMockEmployeeWithLevel(2);
  const request = createMockJsonRequest('PUT', 'http://localhost/api-models/123e4567-e89b-12d3-a456-426614174000', {
    name: 'Updated Model Name',
  });

  // Mock ModelService.update
  const originalUpdate = (await import('../../supabase/functions/api-models/services/modelService.ts')).ModelService.update;
  const updatedModel = { ...mockModel, name: 'Updated Model Name' };
  (await import('../../supabase/functions/api-models/services/modelService.ts')).ModelService.update = async () => updatedModel;

  try {
    const response = await update(request, employee, '123e4567-e89b-12d3-a456-426614174000');
    const data = await assertSuccessResponse<typeof updatedModel>(response);
    assertEquals(data.name, 'Updated Model Name');
  } finally {
    (await import('../../supabase/functions/api-models/services/modelService.ts')).ModelService.update = originalUpdate;
  }
});

Deno.test('delete model - requires level 2', async () => {
  const employee = createMockEmployeeWithLevel(1);
  const request = createMockRequest('DELETE', 'http://localhost/api-models/123e4567-e89b-12d3-a456-426614174000');

  await assertRejects(
    async () => await deleteModel(request, employee, '123e4567-e89b-12d3-a456-426614174000'),
    Error,
    'ต้องมีสิทธิ์ระดับ 2'
  );
});

Deno.test('delete model - success', async () => {
  const employee = createMockEmployeeWithLevel(2);
  const request = createMockRequest('DELETE', 'http://localhost/api-models/123e4567-e89b-12d3-a456-426614174000');

  // Mock ModelService.delete
  const originalDelete = (await import('../../supabase/functions/api-models/services/modelService.ts')).ModelService.delete;
  (await import('../../supabase/functions/api-models/services/modelService.ts')).ModelService.delete = async () => undefined;

  try {
    const response = await deleteModel(request, employee, '123e4567-e89b-12d3-a456-426614174000');
    const data = await assertSuccessResponse<{ message: string }>(response);
    assertEquals(data.message, 'ลบข้อมูลสำเร็จ');
  } finally {
    (await import('../../supabase/functions/api-models/services/modelService.ts')).ModelService.delete = originalDelete;
  }
});

