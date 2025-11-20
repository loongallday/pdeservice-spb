/**
 * Unit tests for Employees API handlers
 */

import { assertEquals, assertRejects } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { list } from '../../supabase/functions/api-employees/handlers/list.ts';
import { get } from '../../supabase/functions/api-employees/handlers/get.ts';
import { getByCode } from '../../supabase/functions/api-employees/handlers/getByCode.ts';
import { create } from '../../supabase/functions/api-employees/handlers/create.ts';
import { getDepartmentCounts } from '../../supabase/functions/api-employees/handlers/departmentCounts.ts';
import { getRoleCounts } from '../../supabase/functions/api-employees/handlers/roleCounts.ts';
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

Deno.test('get department counts - success', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-employees/department-counts');

  const mockDepartmentCounts = [
    {
      department_id: '123e4567-e89b-12d3-a456-426614174000',
      department_code: 'IT',
      department_name_th: 'แผนกเทคโนโลยีสารสนเทศ',
      department_name_en: 'Information Technology',
      total_employees: 15,
      active_employees: 12,
      inactive_employees: 3,
    },
    {
      department_id: '223e4567-e89b-12d3-a456-426614174000',
      department_code: 'HR',
      department_name_th: 'แผนกทรัพยากรบุคคล',
      department_name_en: 'Human Resources',
      total_employees: 8,
      active_employees: 8,
      inactive_employees: 0,
    },
  ];

  // Mock EmployeeService.getEmployeeCountsByDepartment
  const originalGetEmployeeCountsByDepartment = (await import('../../supabase/functions/api-employees/services/employeeService.ts')).EmployeeService.getEmployeeCountsByDepartment;
  (await import('../../supabase/functions/api-employees/services/employeeService.ts')).EmployeeService.getEmployeeCountsByDepartment = async () => mockDepartmentCounts;

  try {
    const response = await getDepartmentCounts(request, employee);
    const data = await assertSuccessResponse<Record<string, unknown>[]>(response);
    assertEquals(Array.isArray(data), true);
    assertEquals(data.length, 2);
    assertEquals(data[0].department_code, 'IT');
    assertEquals(data[0].total_employees, 15);
    assertEquals(data[0].active_employees, 12);
    assertEquals(data[0].inactive_employees, 3);
  } finally {
    (await import('../../supabase/functions/api-employees/services/employeeService.ts')).EmployeeService.getEmployeeCountsByDepartment = originalGetEmployeeCountsByDepartment;
  }
});

Deno.test('get role counts - success', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-employees/role-counts');

  const mockRoleCounts = [
    {
      role_id: '123e4567-e89b-12d3-a456-426614174000',
      role_code: 'ADMIN',
      role_name_th: 'ผู้ดูแลระบบ',
      role_name_en: 'Administrator',
      role_level: 10,
      department_id: '223e4567-e89b-12d3-a456-426614174000',
      department_code: 'IT',
      department_name_th: 'แผนกเทคโนโลยีสารสนเทศ',
      department_name_en: 'Information Technology',
      total_employees: 5,
      active_employees: 4,
      inactive_employees: 1,
    },
    {
      role_id: '323e4567-e89b-12d3-a456-426614174000',
      role_code: 'MANAGER',
      role_name_th: 'ผู้จัดการ',
      role_name_en: 'Manager',
      role_level: 5,
      department_id: null,
      department_code: null,
      department_name_th: null,
      department_name_en: null,
      total_employees: 8,
      active_employees: 8,
      inactive_employees: 0,
    },
  ];

  // Mock EmployeeService.getEmployeeCountsByRole
  const originalGetEmployeeCountsByRole = (await import('../../supabase/functions/api-employees/services/employeeService.ts')).EmployeeService.getEmployeeCountsByRole;
  (await import('../../supabase/functions/api-employees/services/employeeService.ts')).EmployeeService.getEmployeeCountsByRole = async () => mockRoleCounts;

  try {
    const response = await getRoleCounts(request, employee);
    const data = await assertSuccessResponse<Record<string, unknown>[]>(response);
    assertEquals(Array.isArray(data), true);
    assertEquals(data.length, 2);
    assertEquals(data[0].role_code, 'ADMIN');
    assertEquals(data[0].role_level, 10);
    assertEquals(data[0].total_employees, 5);
    assertEquals(data[0].active_employees, 4);
    assertEquals(data[0].inactive_employees, 1);
    assertEquals(data[1].department_id, null);
  } finally {
    (await import('../../supabase/functions/api-employees/services/employeeService.ts')).EmployeeService.getEmployeeCountsByRole = originalGetEmployeeCountsByRole;
  }
});

Deno.test('search employees - success', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-employees/search?q=john');

  const mockSearchResults = [
    {
      id: '123e4567-e89b-12d3-a456-426614174000',
      emp_code: 'EMP001',
      name_th: 'จอห์น สมิธ',
      name_en: 'John Smith',
      nickname: 'John',
      level: 0,
      is_active: true,
    },
    {
      id: '223e4567-e89b-12d3-a456-426614174000',
      emp_code: 'EMP002',
      name_th: 'จอห์นนี่ โด',
      name_en: 'Johnny Doe',
      nickname: 'Johnny',
      level: 0,
      is_active: true,
    },
  ];

  // Mock EmployeeService.search
  const originalSearch = (await import('../../supabase/functions/api-employees/services/employeeService.ts')).EmployeeService.search;
  (await import('../../supabase/functions/api-employees/services/employeeService.ts')).EmployeeService.search = async () => mockSearchResults;

  try {
    const response = await search(request, employee);
    const data = await assertSuccessResponse<Record<string, unknown>[]>(response);
    assertEquals(Array.isArray(data), true);
    assertEquals(data.length, 2);
    assertEquals(data[0].nickname, 'John');
    assertEquals(data[1].nickname, 'Johnny');
  } finally {
    (await import('../../supabase/functions/api-employees/services/employeeService.ts')).EmployeeService.search = originalSearch;
  }
});

Deno.test('search employees - empty query returns empty array', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-employees/search?q=');

  // Mock EmployeeService.search
  const originalSearch = (await import('../../supabase/functions/api-employees/services/employeeService.ts')).EmployeeService.search;
  (await import('../../supabase/functions/api-employees/services/employeeService.ts')).EmployeeService.search = async () => [];

  try {
    const response = await search(request, employee);
    const data = await assertSuccessResponse<Record<string, unknown>[]>(response);
    assertEquals(Array.isArray(data), true);
    assertEquals(data.length, 0);
  } finally {
    (await import('../../supabase/functions/api-employees/services/employeeService.ts')).EmployeeService.search = originalSearch;
  }
});

Deno.test('search employees - no results', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-employees/search?q=nonexistent');

  // Mock EmployeeService.search
  const originalSearch = (await import('../../supabase/functions/api-employees/services/employeeService.ts')).EmployeeService.search;
  (await import('../../supabase/functions/api-employees/services/employeeService.ts')).EmployeeService.search = async () => [];

  try {
    const response = await search(request, employee);
    const data = await assertSuccessResponse<Record<string, unknown>[]>(response);
    assertEquals(Array.isArray(data), true);
    assertEquals(data.length, 0);
  } finally {
    (await import('../../supabase/functions/api-employees/services/employeeService.ts')).EmployeeService.search = originalSearch;
  }
});

