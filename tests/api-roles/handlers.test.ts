/**
 * Unit tests for Roles API handlers
 */

import { assertEquals, assertRejects } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { list } from '../../supabase/functions/api-roles/handlers/list.ts';
import { get } from '../../supabase/functions/api-roles/handlers/get.ts';
import { create } from '../../supabase/functions/api-roles/handlers/create.ts';
import { search } from '../../supabase/functions/api-roles/handlers/search.ts';
import { createMockRequest, createMockJsonRequest, createMockEmployeeWithLevel, assertSuccessResponse } from '../_shared/mocks.ts';

const mockRole = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  code: 'ADMIN',
  name_th: 'ผู้ดูแลระบบ',
  name_en: 'Administrator',
  level: 2,
  is_active: true,
};

Deno.test('list roles - success', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-roles');

  // Mock RoleService.getAll
  const originalGetAll = (await import('../../supabase/functions/api-roles/services/roleService.ts')).RoleService.getAll;
  (await import('../../supabase/functions/api-roles/services/roleService.ts')).RoleService.getAll = async () => [mockRole];

  try {
    const response = await list(request, employee);
    const data = await assertSuccessResponse<unknown[]>(response);
    assertEquals(Array.isArray(data), true);
  } finally {
    (await import('../../supabase/functions/api-roles/services/roleService.ts')).RoleService.getAll = originalGetAll;
  }
});

Deno.test('create role - requires level 2', async () => {
  const employee = createMockEmployeeWithLevel(1);
  const request = createMockJsonRequest('POST', 'http://localhost/api-roles', {
    code: 'MANAGER',
    name_th: 'ผู้จัดการ',
    level: 5,
  });

  await assertRejects(
    async () => await create(request, employee),
    Error,
    'เฉพาะ Superadmin'
  );
});

Deno.test('search roles - success', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-roles/search?q=admin');

  const mockSearchResults = [
    {
      id: '123e4567-e89b-12d3-a456-426614174000',
      code: 'ADMIN',
      name_th: 'ผู้ดูแลระบบ',
      name_en: 'Administrator',
      level: 10,
      department_id: null,
    },
  ];

  // Mock RoleService.search
  const originalSearch = (await import('../../supabase/functions/api-roles/services/roleService.ts')).RoleService.search;
  (await import('../../supabase/functions/api-roles/services/roleService.ts')).RoleService.search = async () => mockSearchResults;

  try {
    const response = await search(request, employee);
    const data = await assertSuccessResponse<Record<string, unknown>[]>(response);
    assertEquals(Array.isArray(data), true);
    assertEquals(data.length, 1);
    assertEquals(data[0].code, 'ADMIN');
  } finally {
    (await import('../../supabase/functions/api-roles/services/roleService.ts')).RoleService.search = originalSearch;
  }
});

Deno.test('search roles - empty query returns empty array', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-roles/search?q=');

  // Mock RoleService.search
  const originalSearch = (await import('../../supabase/functions/api-roles/services/roleService.ts')).RoleService.search;
  (await import('../../supabase/functions/api-roles/services/roleService.ts')).RoleService.search = async () => [];

  try {
    const response = await search(request, employee);
    const data = await assertSuccessResponse<Record<string, unknown>[]>(response);
    assertEquals(Array.isArray(data), true);
    assertEquals(data.length, 0);
  } finally {
    (await import('../../supabase/functions/api-roles/services/roleService.ts')).RoleService.search = originalSearch;
  }
});

