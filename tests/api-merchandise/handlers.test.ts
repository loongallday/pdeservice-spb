/**
 * Unit tests for Merchandise API handlers
 */

import { assertEquals, assertRejects } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { list } from '../../supabase/functions/api-merchandise/handlers/list.ts';
import { get } from '../../supabase/functions/api-merchandise/handlers/get.ts';
import { create } from '../../supabase/functions/api-merchandise/handlers/create.ts';
import { update } from '../../supabase/functions/api-merchandise/handlers/update.ts';
import { deleteMerchandise } from '../../supabase/functions/api-merchandise/handlers/delete.ts';
import { getBySite } from '../../supabase/functions/api-merchandise/handlers/getBySite.ts';
import { getByModel } from '../../supabase/functions/api-merchandise/handlers/getByModel.ts';
import { createMockRequest, createMockJsonRequest, createMockEmployeeWithLevel, assertSuccessResponse, assertErrorResponse } from '../_shared/mocks.ts';

const mockMerchandise = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  serial_no: 'SN12345',
  model_id: '123e4567-e89b-12d3-a456-426614174001',
  site_id: '123e4567-e89b-12d3-a456-426614174002',
  pm_count: 10,
  distributor_id: null,
  dealer_id: null,
  replaced_by_id: null,
  created_at: '2025-11-17T00:00:00Z',
  updated_at: '2025-11-17T00:00:00Z',
};

Deno.test('list merchandise - success', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-merchandise?page=1&limit=20');

  // Mock MerchandiseService.getAll
  const originalGetAll = (await import('../../supabase/functions/api-merchandise/services/merchandiseService.ts')).MerchandiseService.getAll;
  (await import('../../supabase/functions/api-merchandise/services/merchandiseService.ts')).MerchandiseService.getAll = async () => ({
    data: [mockMerchandise],
    pagination: { page: 1, limit: 20, total: 1, totalPages: 1, hasNext: false, hasPrevious: false },
  });

  try {
    const response = await list(request, employee);
    const data = await assertSuccessResponse<{ data: unknown[]; pagination: unknown }>(response);
    assertEquals(Array.isArray(data.data), true);
  } finally {
    (await import('../../supabase/functions/api-merchandise/services/merchandiseService.ts')).MerchandiseService.getAll = originalGetAll;
  }
});

Deno.test('get merchandise - success', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-merchandise/123e4567-e89b-12d3-a456-426614174000');

  // Mock MerchandiseService.getById
  const originalGetById = (await import('../../supabase/functions/api-merchandise/services/merchandiseService.ts')).MerchandiseService.getById;
  (await import('../../supabase/functions/api-merchandise/services/merchandiseService.ts')).MerchandiseService.getById = async () => mockMerchandise;

  try {
    const response = await get(request, employee, '123e4567-e89b-12d3-a456-426614174000');
    const data = await assertSuccessResponse<typeof mockMerchandise>(response);
    assertEquals(data.serial_no, 'SN12345');
  } finally {
    (await import('../../supabase/functions/api-merchandise/services/merchandiseService.ts')).MerchandiseService.getById = originalGetById;
  }
});

Deno.test('get merchandise by site - success', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-merchandise/site/123e4567-e89b-12d3-a456-426614174002?page=1&limit=20');

  // Mock MerchandiseService.getBySite
  const originalGetBySite = (await import('../../supabase/functions/api-merchandise/services/merchandiseService.ts')).MerchandiseService.getBySite;
  (await import('../../supabase/functions/api-merchandise/services/merchandiseService.ts')).MerchandiseService.getBySite = async () => ({
    data: [mockMerchandise],
    pagination: { page: 1, limit: 20, total: 1, totalPages: 1, hasNext: false, hasPrevious: false },
  });

  try {
    const response = await getBySite(request, employee, '123e4567-e89b-12d3-a456-426614174002');
    const data = await assertSuccessResponse<{ data: unknown[]; pagination: unknown }>(response);
    assertEquals(Array.isArray(data.data), true);
  } finally {
    (await import('../../supabase/functions/api-merchandise/services/merchandiseService.ts')).MerchandiseService.getBySite = originalGetBySite;
  }
});

Deno.test('get merchandise by model - success', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-merchandise/model/123e4567-e89b-12d3-a456-426614174001?page=1&limit=20');

  // Mock MerchandiseService.getByModel
  const originalGetByModel = (await import('../../supabase/functions/api-merchandise/services/merchandiseService.ts')).MerchandiseService.getByModel;
  (await import('../../supabase/functions/api-merchandise/services/merchandiseService.ts')).MerchandiseService.getByModel = async () => ({
    data: [mockMerchandise],
    pagination: { page: 1, limit: 20, total: 1, totalPages: 1, hasNext: false, hasPrevious: false },
  });

  try {
    const response = await getByModel(request, employee, '123e4567-e89b-12d3-a456-426614174001');
    const data = await assertSuccessResponse<{ data: unknown[]; pagination: unknown }>(response);
    assertEquals(Array.isArray(data.data), true);
  } finally {
    (await import('../../supabase/functions/api-merchandise/services/merchandiseService.ts')).MerchandiseService.getByModel = originalGetByModel;
  }
});

Deno.test('create merchandise - requires level 1', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockJsonRequest('POST', 'http://localhost/api-merchandise', {
    serial_no: 'SN12345',
    model_id: '123e4567-e89b-12d3-a456-426614174001',
    site_id: '123e4567-e89b-12d3-a456-426614174002',
  });

  await assertRejects(
    async () => await create(request, employee),
    Error,
    'ต้องมีสิทธิ์ระดับ 1'
  );
});

Deno.test('create merchandise - success', async () => {
  const employee = createMockEmployeeWithLevel(1);
  const request = createMockJsonRequest('POST', 'http://localhost/api-merchandise', {
    serial_no: 'SN12345',
    model_id: '123e4567-e89b-12d3-a456-426614174001',
    site_id: '123e4567-e89b-12d3-a456-426614174002',
    pm_count: 10,
  });

  // Mock MerchandiseService.create
  const originalCreate = (await import('../../supabase/functions/api-merchandise/services/merchandiseService.ts')).MerchandiseService.create;
  (await import('../../supabase/functions/api-merchandise/services/merchandiseService.ts')).MerchandiseService.create = async () => mockMerchandise;

  try {
    const response = await create(request, employee);
    const data = await assertSuccessResponse<typeof mockMerchandise>(response, 201);
    assertEquals(data.serial_no, 'SN12345');
    assertEquals(response.status, 201);
  } finally {
    (await import('../../supabase/functions/api-merchandise/services/merchandiseService.ts')).MerchandiseService.create = originalCreate;
  }
});

Deno.test('update merchandise - requires level 2', async () => {
  const employee = createMockEmployeeWithLevel(1);
  const request = createMockJsonRequest('PUT', 'http://localhost/api-merchandise/123e4567-e89b-12d3-a456-426614174000', {
    pm_count: 15,
  });

  await assertRejects(
    async () => await update(request, employee, '123e4567-e89b-12d3-a456-426614174000'),
    Error,
    'ต้องมีสิทธิ์ระดับ 2'
  );
});

Deno.test('update merchandise - success', async () => {
  const employee = createMockEmployeeWithLevel(2);
  const request = createMockJsonRequest('PUT', 'http://localhost/api-merchandise/123e4567-e89b-12d3-a456-426614174000', {
    pm_count: 15,
  });

  // Mock MerchandiseService.update
  const originalUpdate = (await import('../../supabase/functions/api-merchandise/services/merchandiseService.ts')).MerchandiseService.update;
  const updatedMerchandise = { ...mockMerchandise, pm_count: 15 };
  (await import('../../supabase/functions/api-merchandise/services/merchandiseService.ts')).MerchandiseService.update = async () => updatedMerchandise;

  try {
    const response = await update(request, employee, '123e4567-e89b-12d3-a456-426614174000');
    const data = await assertSuccessResponse<typeof updatedMerchandise>(response);
    assertEquals(data.pm_count, 15);
  } finally {
    (await import('../../supabase/functions/api-merchandise/services/merchandiseService.ts')).MerchandiseService.update = originalUpdate;
  }
});

Deno.test('delete merchandise - requires level 2', async () => {
  const employee = createMockEmployeeWithLevel(1);
  const request = createMockRequest('DELETE', 'http://localhost/api-merchandise/123e4567-e89b-12d3-a456-426614174000');

  await assertRejects(
    async () => await deleteMerchandise(request, employee, '123e4567-e89b-12d3-a456-426614174000'),
    Error,
    'ต้องมีสิทธิ์ระดับ 2'
  );
});

Deno.test('delete merchandise - success', async () => {
  const employee = createMockEmployeeWithLevel(2);
  const request = createMockRequest('DELETE', 'http://localhost/api-merchandise/123e4567-e89b-12d3-a456-426614174000');

  // Mock MerchandiseService.delete
  const originalDelete = (await import('../../supabase/functions/api-merchandise/services/merchandiseService.ts')).MerchandiseService.delete;
  (await import('../../supabase/functions/api-merchandise/services/merchandiseService.ts')).MerchandiseService.delete = async () => undefined;

  try {
    const response = await deleteMerchandise(request, employee, '123e4567-e89b-12d3-a456-426614174000');
    const data = await assertSuccessResponse<{ message: string }>(response);
    assertEquals(data.message, 'ลบข้อมูลสำเร็จ');
  } finally {
    (await import('../../supabase/functions/api-merchandise/services/merchandiseService.ts')).MerchandiseService.delete = originalDelete;
  }
});

