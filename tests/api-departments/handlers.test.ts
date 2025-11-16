/**
 * Unit tests for Departments API handlers
 */

import { assertEquals, assertRejects } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { list } from '../../supabase/functions/api-departments/handlers/list.ts';
import { get } from '../../supabase/functions/api-departments/handlers/get.ts';
import { create } from '../../supabase/functions/api-departments/handlers/create.ts';
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

