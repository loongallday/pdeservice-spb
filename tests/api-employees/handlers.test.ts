/**
 * Unit tests for Employees API handlers
 * Tests validation logic and permission checks only
 */

import { assertEquals, assertRejects } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { getById } from '../../supabase/functions/api-employees/handlers/getById.ts';
import { create } from '../../supabase/functions/api-employees/handlers/create.ts';
import { search } from '../../supabase/functions/api-employees/handlers/search.ts';
import { createMockRequest, createMockJsonRequest, createMockEmployeeWithLevel, assertSuccessResponse } from '../_shared/mocks.ts';

const mockEmployee = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  name: 'Test Employee',
  code: 'TEST001',
  email: 'test@example.com',
  role_id: '123e4567-e89b-12d3-a456-426614174001',
  is_active: true,
};

// ============ Handler Existence Tests ============

Deno.test('getById handler exists', () => {
  assertEquals(typeof getById, 'function');
});

Deno.test('create handler exists', () => {
  assertEquals(typeof create, 'function');
});

Deno.test('search handler exists', () => {
  assertEquals(typeof search, 'function');
});

// ============ Permission Tests ============

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

Deno.test('search employees - requires level 1', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-employees/search?q=john');

  await assertRejects(
    async () => await search(request, employee),
    Error,
    'ต้องมีสิทธิ์ระดับ 1'
  );
});

// ============ Validation Tests ============

Deno.test('getById - invalid UUID throws error', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-employees/invalid-uuid');

  await assertRejects(
    async () => await getById(request, employee, 'invalid-uuid'),
    Error,
    'ไม่ถูกต้อง'
  );
});

// ============ Mocked Success Tests ============

Deno.test('getById - success with mocking', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', `http://localhost/api-employees/${mockEmployee.id}`);

  const module = await import('../../supabase/functions/api-employees/services/employeeService.ts');
  const originalGetById = module.EmployeeService.getById;
  module.EmployeeService.getById = async () => mockEmployee;

  try {
    const response = await getById(request, employee, mockEmployee.id);
    const data = await assertSuccessResponse<Record<string, unknown>>(response);
    assertEquals(data.id, mockEmployee.id);
  } finally {
    module.EmployeeService.getById = originalGetById;
  }
});

Deno.test('create - success with level 2', async () => {
  const employee = createMockEmployeeWithLevel(2);
  const request = createMockJsonRequest('POST', 'http://localhost/api-employees', {
    name: 'New Employee',
    code: 'NEW001',
    role_id: mockEmployee.role_id,
  });

  const module = await import('../../supabase/functions/api-employees/services/employeeService.ts');
  const originalCreate = module.EmployeeService.create;
  module.EmployeeService.create = async () => mockEmployee;

  try {
    const response = await create(request, employee);
    assertEquals(response.status, 201);
  } finally {
    module.EmployeeService.create = originalCreate;
  }
});

Deno.test('search - success with level 1', async () => {
  const employee = createMockEmployeeWithLevel(1);
  const request = createMockRequest('GET', 'http://localhost/api-employees/search?q=test');

  const module = await import('../../supabase/functions/api-employees/services/employeeService.ts');
  const originalSearch = module.EmployeeService.search;
  module.EmployeeService.search = async () => [mockEmployee];

  try {
    const response = await search(request, employee);
    assertEquals(response.status, 200);
  } finally {
    module.EmployeeService.search = originalSearch;
  }
});

