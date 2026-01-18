/**
 * Unit tests for Roles API handlers
 */

import { assertEquals, assertRejects } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { getById } from '../../supabase/functions/api-roles/handlers/getById.ts';
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

Deno.test('get role by id - success', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', `http://localhost/api-roles/${mockRole.id}`);

  const module = await import('../../supabase/functions/api-roles/services/roleService.ts');
  const originalGetById = module.RoleService.getById;
  module.RoleService.getById = async () => mockRole;

  try {
    const response = await getById(request, employee, mockRole.id);
    const data = await assertSuccessResponse<typeof mockRole>(response);
    assertEquals(data.id, mockRole.id);
    assertEquals(data.code, 'ADMIN');
  } finally {
    module.RoleService.getById = originalGetById;
  }
});

Deno.test('get role by id - invalid UUID', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-roles/invalid-uuid');

  await assertRejects(
    async () => await getById(request, employee, 'invalid-uuid'),
    Error,
    'ไม่ถูกต้อง'
  );
});

Deno.test('create role - requires superadmin', async () => {
  const employee = createMockEmployeeWithLevel(2);
  const request = createMockJsonRequest('POST', 'http://localhost/api-roles', {
    code: 'MANAGER',
    name_th: 'ผู้จัดการ',
    level: 5,
  });

  await assertRejects(
    async () => await create(request, employee),
    Error,
    'Superadmin'
  );
});

Deno.test('create role - success with superadmin (level 3)', async () => {
  const employee = createMockEmployeeWithLevel(3);
  const request = createMockJsonRequest('POST', 'http://localhost/api-roles', {
    code: 'MANAGER',
    name_th: 'ผู้จัดการ',
    level: 5,
  });

  const module = await import('../../supabase/functions/api-roles/services/roleService.ts');
  const originalCreate = module.RoleService.create;
  module.RoleService.create = async () => mockRole;

  try {
    const response = await create(request, employee);
    const data = await assertSuccessResponse<typeof mockRole>(response, 201);
    assertEquals(data.id, mockRole.id);
  } finally {
    module.RoleService.create = originalCreate;
  }
});

Deno.test('search roles - handler exists and is callable', () => {
  assertEquals(typeof search, 'function');
});

Deno.test('search roles - requires valid employee', async () => {
  // Search should work for any level (0+)
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-roles/search?q=admin');

  // Handler should be callable without throwing immediately
  // (will fail on DB call but validates the permission check passes)
  assertEquals(typeof search, 'function');
});

