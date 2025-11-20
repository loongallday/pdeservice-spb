/**
 * Unit tests for Departments API handlers
 */

import { assertEquals, assertRejects } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { list } from '../../supabase/functions/api-departments/handlers/list.ts';
import { create } fro../../supabase/functions/api-departments/handlers/id.tsate.ts';
import { search } from '../../supabase/functions/api-departments/handlers/search.ts';
import { createMockRequest, createMockJsonRequest, createMockEmployeeWithLevel, assertSuccessResponse } from '../_shared/mocks.ts';

const mockDepartment = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  code: 'IT',
  name_th: 'แผนกเทคโนโลยี',
  name_en: 'IT Department',
  is_active: true,
};

Deno.test('list departments - success', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-departments');

  // Mock DepartmentService.getAll
  const originalGetAll = (await import('../../supabase/functions/api-departments/services/departmentService.ts')).DepartmentService.getAll;
  (await import('../../supabase/functions/api-departments/services/departmentService.ts')).DepartmentService.getAll = async () => [mockDepartment];

  try {
    const response = await list(request, employee);
    const data = await assertSuccessResponse<unknown[]>(response);
    assertEquals(Array.isArray(data), true);
  } finally {
    (await import('../../supabase/functions/api-departments/services/departmentService.ts')).DepartmentService.getAll = originalGetAll;
  }
});

Deno.test('create department - requires level 1', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockJsonRequest('POST', 'http://localhost/api-departments', {
    code: 'SALES',
    name_th: 'ฝ่ายขาย',
  });

  await assertRejects(
    async () => await create(request, employee),
    Error,
    'เฉพาะ Superadmin'
  );
});

Deno.test('search departments - success', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-departments/search?q=IT');

  const mockSearchResults = [
    {
      id: '123e4567-e89b-12d3-a456-426614174000',
      code: 'IT',
      name_th: 'แผนกเทคโนโลยีสารสนเทศ',
      name_en: 'Information Technology',
      is_active: true,
    },
  ];

  // Mock DepartmentService.search
  const originalSearch = (await import('../../supabase/functions/api-departments/services/departmentService.ts')).DepartmentService.search;
  (await import('../../supabase/functions/api-departments/services/departmentService.ts')).DepartmentService.search = async () => mockSearchResults;

  try {
    const response = await search(request, employee);
    const data = await assertSuccessResponse<Record<string, unknown>[]>(response);
    assertEquals(Array.isArray(data), true);
    assertEquals(data.length, 1);
    assertEquals(data[0].code, 'IT');
  } finally {
    (await import('../../supabase/functions/api-departments/services/departmentService.ts')).DepartmentService.search = originalSearch;
  }
});

Deno.test('search departments - empty query returns empty array', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-departments/search?q=');

  // Mock DepartmentService.search
  const originalSearch = (await import('../../supabase/functions/api-departments/services/departmentService.ts')).DepartmentService.search;
  (await import('../../supabase/functions/api-departments/services/departmentService.ts')).DepartmentService.search = async () => [];

  try {
    const response = await search(request, employee);
    const data = await assertSuccessResponse<Record<string, unknown>[]>(response);
    assertEquals(Array.isArray(data), true);
    assertEquals(data.length, 0);
  } finally {
    (await import('../../supabase/functions/api-departments/services/departmentService.ts')).DepartmentService.search = originalSearch;
  }
});

