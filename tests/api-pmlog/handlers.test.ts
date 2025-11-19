/**
 * Unit tests for PM Log API handlers
 */

import { assertEquals, assertRejects } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { list } from '../../supabase/functions/api-pmlog/handlers/list.ts';
import { get } from '../../supabase/functions/api-pmlog/handlers/get.ts';
import { create } from '../../supabase/functions/api-pmlog/handlers/create.ts';
import { update } from '../../supabase/functions/api-pmlog/handlers/update.ts';
import { deletePMLog } from '../../supabase/functions/api-pmlog/handlers/delete.ts';
import { getByMerchandise } from '../../supabase/functions/api-pmlog/handlers/getByMerchandise.ts';
import { createMockRequest, createMockJsonRequest, createMockEmployeeWithLevel, assertSuccessResponse } from '../_shared/mocks.ts';

const mockPMLog = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  merchandise_id: '123e4567-e89b-12d3-a456-426614174001',
  description: 'เปลี่ยนน้ำมันและตรวจสอบระบบ',
  performed_at: '2025-11-17T10:30:00Z',
  performed_by: '123e4567-e89b-12d3-a456-426614174002',
  created_at: '2025-11-17T00:00:00Z',
  updated_at: '2025-11-17T00:00:00Z',
};

Deno.test('list pmlog - success', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-pmlog?page=1&limit=20');

  // Mock PMLogService.getAll
  const originalGetAll = (await import('../../supabase/functions/api-pmlog/services/pmlogService.ts')).PMLogService.getAll;
  (await import('../../supabase/functions/api-pmlog/services/pmlogService.ts')).PMLogService.getAll = async () => ({
    data: [mockPMLog],
    pagination: { page: 1, limit: 20, total: 1, totalPages: 1, hasNext: false, hasPrevious: false },
  });

  try {
    const response = await list(request, employee);
    const data = await assertSuccessResponse<{ data: unknown[]; pagination: unknown }>(response);
    assertEquals(Array.isArray(data.data), true);
  } finally {
    (await import('../../supabase/functions/api-pmlog/services/pmlogService.ts')).PMLogService.getAll = originalGetAll;
  }
});

Deno.test('get pmlog - success', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-pmlog/123e4567-e89b-12d3-a456-426614174000');

  // Mock PMLogService.getById
  const originalGetById = (await import('../../supabase/functions/api-pmlog/services/pmlogService.ts')).PMLogService.getById;
  (await import('../../supabase/functions/api-pmlog/services/pmlogService.ts')).PMLogService.getById = async () => mockPMLog;

  try {
    const response = await get(request, employee, '123e4567-e89b-12d3-a456-426614174000');
    const data = await assertSuccessResponse<typeof mockPMLog>(response);
    assertEquals(data.description, 'เปลี่ยนน้ำมันและตรวจสอบระบบ');
  } finally {
    (await import('../../supabase/functions/api-pmlog/services/pmlogService.ts')).PMLogService.getById = originalGetById;
  }
});

Deno.test('get pmlog by merchandise - success', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-pmlog/merchandise/123e4567-e89b-12d3-a456-426614174001?page=1&limit=20');

  // Mock PMLogService.getByMerchandise
  const originalGetByMerchandise = (await import('../../supabase/functions/api-pmlog/services/pmlogService.ts')).PMLogService.getByMerchandise;
  (await import('../../supabase/functions/api-pmlog/services/pmlogService.ts')).PMLogService.getByMerchandise = async () => ({
    data: [mockPMLog],
    pagination: { page: 1, limit: 20, total: 1, totalPages: 1, hasNext: false, hasPrevious: false },
  });

  try {
    const response = await getByMerchandise(request, employee, '123e4567-e89b-12d3-a456-426614174001');
    const data = await assertSuccessResponse<{ data: unknown[]; pagination: unknown }>(response);
    assertEquals(Array.isArray(data.data), true);
  } finally {
    (await import('../../supabase/functions/api-pmlog/services/pmlogService.ts')).PMLogService.getByMerchandise = originalGetByMerchandise;
  }
});

Deno.test('create pmlog - requires level 1', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockJsonRequest('POST', 'http://localhost/api-pmlog', {
    merchandise_id: '123e4567-e89b-12d3-a456-426614174001',
    description: 'เปลี่ยนน้ำมัน',
  });

  await assertRejects(
    async () => await create(request, employee),
    Error,
    'ต้องมีสิทธิ์ระดับ 1'
  );
});

Deno.test('create pmlog - success with auto performed_by', async () => {
  const employee = createMockEmployeeWithLevel(1);
  const request = createMockJsonRequest('POST', 'http://localhost/api-pmlog', {
    merchandise_id: '123e4567-e89b-12d3-a456-426614174001',
    description: 'เปลี่ยนน้ำมันและตรวจสอบระบบ',
  });

  // Mock PMLogService.create
  const originalCreate = (await import('../../supabase/functions/api-pmlog/services/pmlogService.ts')).PMLogService.create;
  const newPMLog = { ...mockPMLog, performed_by: employee.id };
  (await import('../../supabase/functions/api-pmlog/services/pmlogService.ts')).PMLogService.create = async () => newPMLog;

  try {
    const response = await create(request, employee);
    const data = await assertSuccessResponse<typeof newPMLog>(response, 201);
    assertEquals(data.description, 'เปลี่ยนน้ำมันและตรวจสอบระบบ');
    assertEquals(response.status, 201);
  } finally {
    (await import('../../supabase/functions/api-pmlog/services/pmlogService.ts')).PMLogService.create = originalCreate;
  }
});

Deno.test('update pmlog - requires level 2', async () => {
  const employee = createMockEmployeeWithLevel(1);
  const request = createMockJsonRequest('PUT', 'http://localhost/api-pmlog/123e4567-e89b-12d3-a456-426614174000', {
    description: 'Updated description',
  });

  await assertRejects(
    async () => await update(request, employee, '123e4567-e89b-12d3-a456-426614174000'),
    Error,
    'ต้องมีสิทธิ์ระดับ 2'
  );
});

Deno.test('update pmlog - success', async () => {
  const employee = createMockEmployeeWithLevel(2);
  const request = createMockJsonRequest('PUT', 'http://localhost/api-pmlog/123e4567-e89b-12d3-a456-426614174000', {
    description: 'Updated description',
  });

  // Mock PMLogService.update
  const originalUpdate = (await import('../../supabase/functions/api-pmlog/services/pmlogService.ts')).PMLogService.update;
  const updatedPMLog = { ...mockPMLog, description: 'Updated description' };
  (await import('../../supabase/functions/api-pmlog/services/pmlogService.ts')).PMLogService.update = async () => updatedPMLog;

  try {
    const response = await update(request, employee, '123e4567-e89b-12d3-a456-426614174000');
    const data = await assertSuccessResponse<typeof updatedPMLog>(response);
    assertEquals(data.description, 'Updated description');
  } finally {
    (await import('../../supabase/functions/api-pmlog/services/pmlogService.ts')).PMLogService.update = originalUpdate;
  }
});

Deno.test('delete pmlog - requires level 2', async () => {
  const employee = createMockEmployeeWithLevel(1);
  const request = createMockRequest('DELETE', 'http://localhost/api-pmlog/123e4567-e89b-12d3-a456-426614174000');

  await assertRejects(
    async () => await deletePMLog(request, employee, '123e4567-e89b-12d3-a456-426614174000'),
    Error,
    'ต้องมีสิทธิ์ระดับ 2'
  );
});

Deno.test('delete pmlog - success', async () => {
  const employee = createMockEmployeeWithLevel(2);
  const request = createMockRequest('DELETE', 'http://localhost/api-pmlog/123e4567-e89b-12d3-a456-426614174000');

  // Mock PMLogService.delete
  const originalDelete = (await import('../../supabase/functions/api-pmlog/services/pmlogService.ts')).PMLogService.delete;
  (await import('../../supabase/functions/api-pmlog/services/pmlogService.ts')).PMLogService.delete = async () => undefined;

  try {
    const response = await deletePMLog(request, employee, '123e4567-e89b-12d3-a456-426614174000');
    const data = await assertSuccessResponse<{ message: string }>(response);
    assertEquals(data.message, 'ลบข้อมูลสำเร็จ');
  } finally {
    (await import('../../supabase/functions/api-pmlog/services/pmlogService.ts')).PMLogService.delete = originalDelete;
  }
});

