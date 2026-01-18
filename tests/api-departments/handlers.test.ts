/**
 * Unit tests for Departments API handlers
 * Tests validation logic and permission checks only
 */

import { assertEquals, assertRejects } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { search } from '../../supabase/functions/api-departments/handlers/search.ts';
import { create } from '../../supabase/functions/api-departments/handlers/create.ts';
import { update } from '../../supabase/functions/api-departments/handlers/update.ts';
import { deleteDepartment } from '../../supabase/functions/api-departments/handlers/delete.ts';
import { createMockRequest, createMockJsonRequest, createMockEmployeeWithLevel } from '../_shared/mocks.ts';

const mockDepartment = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  code: 'TECH',
  name_th: 'ฝ่ายเทคนิค',
  name_en: 'Technical Department',
  is_active: true,
};

// ============ Handler Existence Tests ============

Deno.test('search handler exists', () => {
  assertEquals(typeof search, 'function');
});

Deno.test('create handler exists', () => {
  assertEquals(typeof create, 'function');
});

Deno.test('update handler exists', () => {
  assertEquals(typeof update, 'function');
});

Deno.test('deleteDepartment handler exists', () => {
  assertEquals(typeof deleteDepartment, 'function');
});

// ============ Permission Tests ============

Deno.test('create department - requires superadmin', async () => {
  const employee = createMockEmployeeWithLevel(2);
  const request = createMockJsonRequest('POST', 'http://localhost/api-departments', {
    code: 'NEW',
    name_th: 'ฝ่ายใหม่',
  });

  await assertRejects(
    async () => await create(request, employee),
    Error,
    'เฉพาะ Superadmin เท่านั้น'
  );
});

Deno.test('update department - requires superadmin', async () => {
  const employee = createMockEmployeeWithLevel(2);
  const request = createMockJsonRequest('PUT', `http://localhost/api-departments/${mockDepartment.id}`, {
    name_th: 'Updated Name',
  });

  await assertRejects(
    async () => await update(request, employee, mockDepartment.id),
    Error,
    'เฉพาะ Superadmin เท่านั้น'
  );
});

Deno.test('delete department - requires superadmin', async () => {
  const employee = createMockEmployeeWithLevel(2);
  const request = createMockRequest('DELETE', `http://localhost/api-departments/${mockDepartment.id}`);

  await assertRejects(
    async () => await deleteDepartment(request, employee, mockDepartment.id),
    Error,
    'เฉพาะ Superadmin เท่านั้น'
  );
});

// ============ Validation Tests ============

Deno.test('update department - invalid UUID throws error', async () => {
  const employee = createMockEmployeeWithLevel(3);
  const request = createMockJsonRequest('PUT', 'http://localhost/api-departments/invalid-uuid', {
    name_th: 'Updated Name',
  });

  await assertRejects(
    async () => await update(request, employee, 'invalid-uuid'),
    Error,
    'ไม่ถูกต้อง'
  );
});

Deno.test('update department - empty body throws error', async () => {
  const employee = createMockEmployeeWithLevel(3);
  const request = createMockJsonRequest('PUT', `http://localhost/api-departments/${mockDepartment.id}`, {});

  await assertRejects(
    async () => await update(request, employee, mockDepartment.id),
    Error,
    'ไม่มีข้อมูลที่จะอัปเดต'
  );
});

Deno.test('delete department - invalid UUID throws error', async () => {
  const employee = createMockEmployeeWithLevel(3);
  const request = createMockRequest('DELETE', 'http://localhost/api-departments/invalid-uuid');

  await assertRejects(
    async () => await deleteDepartment(request, employee, 'invalid-uuid'),
    Error,
    'ไม่ถูกต้อง'
  );
});

// ============ Mocked Success Tests ============

Deno.test('search - success with mocking', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-departments/search?q=tech');

  const module = await import('../../supabase/functions/api-departments/services/departmentService.ts');
  const originalSearch = module.DepartmentService.search;
  module.DepartmentService.search = async () => ({
    data: [mockDepartment],
    pagination: { page: 1, limit: 20, total: 1, totalPages: 1, hasNext: false, hasPrevious: false },
  });

  try {
    const response = await search(request, employee);
    assertEquals(response.status, 200);
  } finally {
    module.DepartmentService.search = originalSearch;
  }
});

Deno.test('create - success with superadmin', async () => {
  const employee = createMockEmployeeWithLevel(3);
  const request = createMockJsonRequest('POST', 'http://localhost/api-departments', {
    code: 'NEW',
    name_th: 'ฝ่ายใหม่',
  });

  const module = await import('../../supabase/functions/api-departments/services/departmentService.ts');
  const originalCreate = module.DepartmentService.create;
  module.DepartmentService.create = async () => mockDepartment;

  try {
    const response = await create(request, employee);
    assertEquals(response.status, 201);
  } finally {
    module.DepartmentService.create = originalCreate;
  }
});

Deno.test('update - success with superadmin', async () => {
  const employee = createMockEmployeeWithLevel(3);
  const request = createMockJsonRequest('PUT', `http://localhost/api-departments/${mockDepartment.id}`, {
    name_th: 'Updated Name',
  });

  const module = await import('../../supabase/functions/api-departments/services/departmentService.ts');
  const originalUpdate = module.DepartmentService.update;
  module.DepartmentService.update = async () => ({ ...mockDepartment, name_th: 'Updated Name' });

  try {
    const response = await update(request, employee, mockDepartment.id);
    assertEquals(response.status, 200);
  } finally {
    module.DepartmentService.update = originalUpdate;
  }
});

Deno.test('delete - success with superadmin', async () => {
  const employee = createMockEmployeeWithLevel(3);
  const request = createMockRequest('DELETE', `http://localhost/api-departments/${mockDepartment.id}`);

  const module = await import('../../supabase/functions/api-departments/services/departmentService.ts');
  const originalDelete = module.DepartmentService.delete;
  module.DepartmentService.delete = async () => {};

  try {
    const response = await deleteDepartment(request, employee, mockDepartment.id);
    assertEquals(response.status, 200);
  } finally {
    module.DepartmentService.delete = originalDelete;
  }
});

