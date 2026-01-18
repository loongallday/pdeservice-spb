/**
 * Unit tests for Models API handlers
 * Tests validation logic and permission checks only
 */

import { assertEquals, assertRejects } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { list } from '../../supabase/functions/api-models/handlers/list.ts';
import { get } from '../../supabase/functions/api-models/handlers/get.ts';
import { create } from '../../supabase/functions/api-models/handlers/create.ts';
import { update } from '../../supabase/functions/api-models/handlers/update.ts';
import { deleteModel } from '../../supabase/functions/api-models/handlers/delete.ts';
import { checkCodeFast } from '../../supabase/functions/api-models/handlers/checkCode.ts';
import { createMockRequest, createMockJsonRequest, createMockEmployeeWithLevel } from '../_shared/mocks.ts';

const mockModel = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  code: 'MODEL001',
  name_th: 'รุ่นทดสอบ',
  name_en: 'Test Model',
  brand: 'Test Brand',
  is_active: true,
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

Deno.test('deleteModel handler exists', () => {
  assertEquals(typeof deleteModel, 'function');
});

Deno.test('checkCodeFast handler exists', () => {
  assertEquals(typeof checkCodeFast, 'function');
});

// ============ Permission Tests ============

Deno.test('delete - requires level 1', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('DELETE', `http://localhost/api-models/${mockModel.id}`);

  await assertRejects(
    async () => await deleteModel(request, employee, mockModel.id),
    Error,
    'ต้องมีสิทธิ์ระดับ 1'
  );
});

// ============ Mocked Success Tests ============

Deno.test('get - success with mocking', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', `http://localhost/api-models/${mockModel.id}`);

  const module = await import('../../supabase/functions/api-models/services/modelService.ts');
  const originalGetById = module.ModelService.getById;
  module.ModelService.getById = async () => mockModel;

  try {
    const response = await get(request, employee, mockModel.id);
    assertEquals(response.status, 200);
  } finally {
    module.ModelService.getById = originalGetById;
  }
});

Deno.test('delete - success with level 1', async () => {
  const employee = createMockEmployeeWithLevel(1);
  const request = createMockRequest('DELETE', `http://localhost/api-models/${mockModel.id}`);

  const module = await import('../../supabase/functions/api-models/services/modelService.ts');
  const originalDelete = module.ModelService.delete;
  module.ModelService.delete = async () => {};

  try {
    const response = await deleteModel(request, employee, mockModel.id);
    assertEquals(response.status, 200);
  } finally {
    module.ModelService.delete = originalDelete;
  }
});

