/**
 * Unit tests for Employees API handlers
 */

import { assertEquals, assertRejects } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { list } from '../../supabase/functions/api-employees/handlers/list.ts';
import { get } from '../../supabase/functions/api-employees/handlers/get.ts';
import { getByCode } from '../../supabase/functions/api-employees/handlers/getByCode.ts';
import { create } from '../../supabase/functions/api-employees/handlers/create.ts';
import { createMockRequest, createMockJsonRequest, createMockEmployeeWithLevel, assertSuccessResponse } from '../_shared/mocks.ts';

const mockEmployee = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  name: 'Test Employee',
  code: 'TEST001',
  email: 'test@example.com',
  role_id: '123e4567-e89b-12d3-a456-426614174001',
  is_active: true,
};

Deno.test('list employees - success', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-employees?page=1&limit=20');

  // Mock EmployeeService.getAll
  const originalGetAll = (await import('../../supabase/functions/api-employees/services/employeeService.ts')).EmployeeService.getAll;
  (await import('../../supabase/functions/api-employees/services/employeeService.ts')).EmployeeService.getAll = async () => ({
    data: [mockEmployee],
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
    const response = await list(request, employee);
    const data = await assertSuccessResponse<{ data: unknown[]; pagination: unknown }>(response);
    assertEquals(Array.isArray(data.data), true);
  } finally {
    (await import('../../supabase/functions/api-employees/services/employeeService.ts')).EmployeeService.getAll = originalGetAll;
  }
});

Deno.test('get employee by id - success', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-employees/123e4567-e89b-12d3-a456-426614174000');

  // Mock EmployeeService.getById
  const originalGetById = (await import('../../supabase/functions/api-employees/services/employeeService.ts')).EmployeeService.getById;
  (await import('../../supabase/functions/api-employees/services/employeeService.ts')).EmployeeService.getById = async () => mockEmployee;

  try {
    const response = await get(request, employee, '123e4567-e89b-12d3-a456-426614174000');
    const data = await assertSuccessResponse<Record<string, unknown>>(response);
    assertEquals(data.id, '123e4567-e89b-12d3-a456-426614174000');
  } finally {
    (await import('../../supabase/functions/api-employees/services/employeeService.ts')).EmployeeService.getById = originalGetById;
  }
});

Deno.test('get employee by code - success', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-employees/code/TEST001');

  // Mock EmployeeService.getByCode
  const originalGetByCode = (await import('../../supabase/functions/api-employees/services/employeeService.ts')).EmployeeService.getByCode;
  (await import('../../supabase/functions/api-employees/services/employeeService.ts')).EmployeeService.getByCode = async () => mockEmployee;

  try {
    const response = await getByCode(request, employee, 'TEST001');
    const data = await assertSuccessResponse<Record<string, unknown>>(response);
    assertEquals(data.code, 'TEST001');
  } finally {
    (await import('../../supabase/functions/api-employees/services/employeeService.ts')).EmployeeService.getByCode = originalGetByCode;
  }
});

Deno.test('create employee - requires level 2', async () => {
  const employee = createMockEmployeeWithLevel(1);
  const request = createMockJsonRequest('POST', 'http://localhost/api-employees', {
    name: 'New Employee',
    code: 'NEW001',
  });

  await assertRejects(
    async () => await create(request, employee),
    Error,
    'ต้องมีสิทธิ์ระดับ 2'
  );
});

Deno.test('create employee - missing required fields', async () => {
  const employee = createMockEmployeeWithLevel(2);
  const request = createMockJsonRequest('POST', 'http://localhost/api-employees', {
    name: 'New Employee',
    // Missing code
  });

  await assertRejects(
    async () => await create(request, employee),
    Error,
    'จำเป็นต้องระบุ'
  );
});

Deno.test('list employees - filtering by role', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-employees?role=admin');

  // Mock EmployeeService.getAll
  const originalGetAll = (await import('../../supabase/functions/api-employees/services/employeeService.ts')).EmployeeService.getAll;
  (await import('../../supabase/functions/api-employees/services/employeeService.ts')).EmployeeService.getAll = async () => ({
    data: [mockEmployee],
    pagination: { page: 1, limit: 20, total: 1, totalPages: 1, hasNext: false, hasPrevious: false },
  });

  try {
    const response = await list(request, employee);
    const data = await assertSuccessResponse<{ data: unknown[]; pagination: unknown }>(response);
    assertEquals(Array.isArray(data.data), true);
  } finally {
    (await import('../../supabase/functions/api-employees/services/employeeService.ts')).EmployeeService.getAll = originalGetAll;
  }
});

Deno.test('list employees - filtering by department and active status', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-employees?department_id=123&is_active=true');

  // Mock EmployeeService.getAll
  const originalGetAll = (await import('../../supabase/functions/api-employees/services/employeeService.ts')).EmployeeService.getAll;
  (await import('../../supabase/functions/api-employees/services/employeeService.ts')).EmployeeService.getAll = async () => ({
    data: [mockEmployee],
    pagination: { page: 1, limit: 20, total: 1, totalPages: 1, hasNext: false, hasPrevious: false },
  });

  try {
    const response = await list(request, employee);
    const data = await assertSuccessResponse<{ data: unknown[]; pagination: unknown }>(response);
    assertEquals(Array.isArray(data.data), true);
  } finally {
    (await import('../../supabase/functions/api-employees/services/employeeService.ts')).EmployeeService.getAll = originalGetAll;
  }
});

Deno.test('list employees - pagination with multiple pages', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-employees?page=3&limit=5');

  // Mock EmployeeService.getAll
  const originalGetAll = (await import('../../supabase/functions/api-employees/services/employeeService.ts')).EmployeeService.getAll;
  (await import('../../supabase/functions/api-employees/services/employeeService.ts')).EmployeeService.getAll = async () => ({
    data: [mockEmployee],
    pagination: { page: 3, limit: 5, total: 15, totalPages: 3, hasNext: false, hasPrevious: true },
  });

  try {
    const response = await list(request, employee);
    const data = await assertSuccessResponse<{ data: unknown[]; pagination: { page: number; limit: number; total: number; totalPages: number; hasNext: boolean; hasPrevious: boolean } }>(response);
    assertEquals(data.pagination.page, 3);
    assertEquals(data.pagination.limit, 5);
    assertEquals(data.pagination.total, 15);
    assertEquals(data.pagination.totalPages, 3);
    assertEquals(data.pagination.hasNext, false);
    assertEquals(data.pagination.hasPrevious, true);
  } finally {
    (await import('../../supabase/functions/api-employees/services/employeeService.ts')).EmployeeService.getAll = originalGetAll;
  }
});

