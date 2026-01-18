/**
 * Unit tests for auth utilities
 * Tests pure functions only (no database required)
 */

import { assertEquals, assertRejects } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import {
  Employee,
  requireMinLevel,
  requireLevelGreaterThanZero,
  getEmployeeLevel,
  isAdmin,
  isSuperAdmin,
} from '../../supabase/functions/_shared/auth.ts';
import { AuthorizationError } from '../../supabase/functions/_shared/error.ts';

// Helper to create mock employee with specific level
function createMockEmployee(level: number | null): Employee {
  return {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'Test Employee',
    code: 'EMP001',
    email: 'test@example.com',
    role_id: 'role-123',
    auth_user_id: 'auth-123',
    is_active: true,
    role_data: {
      id: 'role-123',
      code: 'technician',
      name_th: 'ช่างเทคนิค',
      level: level,
    },
  };
}

// Helper to create mock employee without role_data
function createMockEmployeeWithoutRole(): Employee {
  return {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'Test Employee',
    code: 'EMP001',
    email: 'test@example.com',
    role_id: null,
    auth_user_id: 'auth-123',
    is_active: true,
    role_data: null,
  };
}

// ============ requireMinLevel Tests ============

Deno.test('requireMinLevel - level 0 employee passes for level 0', async () => {
  const employee = createMockEmployee(0);
  // Should not throw
  await requireMinLevel(employee, 0);
});

Deno.test('requireMinLevel - level 1 employee passes for level 0', async () => {
  const employee = createMockEmployee(1);
  // Should not throw
  await requireMinLevel(employee, 0);
});

Deno.test('requireMinLevel - level 2 employee passes for level 1', async () => {
  const employee = createMockEmployee(2);
  // Should not throw
  await requireMinLevel(employee, 1);
});

Deno.test('requireMinLevel - level 3 employee passes for all levels', async () => {
  const employee = createMockEmployee(3);
  // Should not throw for any level
  await requireMinLevel(employee, 0);
  await requireMinLevel(employee, 1);
  await requireMinLevel(employee, 2);
  await requireMinLevel(employee, 3);
});

Deno.test('requireMinLevel - level 0 employee fails for level 1', async () => {
  const employee = createMockEmployee(0);

  await assertRejects(
    async () => await requireMinLevel(employee, 1),
    AuthorizationError,
    'ต้องมีสิทธิ์ระดับ 1'
  );
});

Deno.test('requireMinLevel - level 1 employee fails for level 2', async () => {
  const employee = createMockEmployee(1);

  await assertRejects(
    async () => await requireMinLevel(employee, 2),
    AuthorizationError,
    'ต้องมีสิทธิ์ระดับ 2'
  );
});

Deno.test('requireMinLevel - level 2 employee fails for level 3', async () => {
  const employee = createMockEmployee(2);

  await assertRejects(
    async () => await requireMinLevel(employee, 3),
    AuthorizationError,
    'ต้องมีสิทธิ์ระดับ 3'
  );
});

Deno.test('requireMinLevel - null role_data treated as level 0', async () => {
  const employee = createMockEmployeeWithoutRole();

  // Should pass for level 0
  await requireMinLevel(employee, 0);

  // Should fail for level 1
  await assertRejects(
    async () => await requireMinLevel(employee, 1),
    AuthorizationError
  );
});

Deno.test('requireMinLevel - null level in role_data treated as level 0', async () => {
  const employee = createMockEmployee(null);

  // Should pass for level 0
  await requireMinLevel(employee, 0);

  // Should fail for level 1
  await assertRejects(
    async () => await requireMinLevel(employee, 1),
    AuthorizationError
  );
});

// ============ requireLevelGreaterThanZero Tests ============

Deno.test('requireLevelGreaterThanZero - level 1 passes', async () => {
  const employee = createMockEmployee(1);
  // Should not throw
  await requireLevelGreaterThanZero(employee);
});

Deno.test('requireLevelGreaterThanZero - level 2 passes', async () => {
  const employee = createMockEmployee(2);
  // Should not throw
  await requireLevelGreaterThanZero(employee);
});

Deno.test('requireLevelGreaterThanZero - level 3 passes', async () => {
  const employee = createMockEmployee(3);
  // Should not throw
  await requireLevelGreaterThanZero(employee);
});

Deno.test('requireLevelGreaterThanZero - level 0 fails', async () => {
  const employee = createMockEmployee(0);

  await assertRejects(
    async () => await requireLevelGreaterThanZero(employee),
    AuthorizationError,
    'ไม่มีสิทธิ์เข้าถึง'
  );
});

Deno.test('requireLevelGreaterThanZero - null role_data fails', async () => {
  const employee = createMockEmployeeWithoutRole();

  await assertRejects(
    async () => await requireLevelGreaterThanZero(employee),
    AuthorizationError,
    'ไม่มีสิทธิ์เข้าถึง'
  );
});

Deno.test('requireLevelGreaterThanZero - null level fails', async () => {
  const employee = createMockEmployee(null);

  await assertRejects(
    async () => await requireLevelGreaterThanZero(employee),
    AuthorizationError,
    'ไม่มีสิทธิ์เข้าถึง'
  );
});

// ============ getEmployeeLevel Tests ============

Deno.test('getEmployeeLevel - returns level 0', () => {
  const employee = createMockEmployee(0);

  assertEquals(getEmployeeLevel(employee), 0);
});

Deno.test('getEmployeeLevel - returns level 1', () => {
  const employee = createMockEmployee(1);

  assertEquals(getEmployeeLevel(employee), 1);
});

Deno.test('getEmployeeLevel - returns level 2', () => {
  const employee = createMockEmployee(2);

  assertEquals(getEmployeeLevel(employee), 2);
});

Deno.test('getEmployeeLevel - returns level 3', () => {
  const employee = createMockEmployee(3);

  assertEquals(getEmployeeLevel(employee), 3);
});

Deno.test('getEmployeeLevel - null role_data returns 0', () => {
  const employee = createMockEmployeeWithoutRole();

  assertEquals(getEmployeeLevel(employee), 0);
});

Deno.test('getEmployeeLevel - null level returns 0', () => {
  const employee = createMockEmployee(null);

  assertEquals(getEmployeeLevel(employee), 0);
});

// ============ isAdmin Tests ============

Deno.test('isAdmin - level 0 is not admin', () => {
  const employee = createMockEmployee(0);

  assertEquals(isAdmin(employee), false);
});

Deno.test('isAdmin - level 1 is not admin', () => {
  const employee = createMockEmployee(1);

  assertEquals(isAdmin(employee), false);
});

Deno.test('isAdmin - level 2 is admin', () => {
  const employee = createMockEmployee(2);

  assertEquals(isAdmin(employee), true);
});

Deno.test('isAdmin - level 3 is admin', () => {
  const employee = createMockEmployee(3);

  assertEquals(isAdmin(employee), true);
});

Deno.test('isAdmin - null role_data is not admin', () => {
  const employee = createMockEmployeeWithoutRole();

  assertEquals(isAdmin(employee), false);
});

Deno.test('isAdmin - null level is not admin', () => {
  const employee = createMockEmployee(null);

  assertEquals(isAdmin(employee), false);
});

// ============ isSuperAdmin Tests ============

Deno.test('isSuperAdmin - level 0 is not superadmin', () => {
  const employee = createMockEmployee(0);

  assertEquals(isSuperAdmin(employee), false);
});

Deno.test('isSuperAdmin - level 1 is not superadmin', () => {
  const employee = createMockEmployee(1);

  assertEquals(isSuperAdmin(employee), false);
});

Deno.test('isSuperAdmin - level 2 is not superadmin', () => {
  const employee = createMockEmployee(2);

  assertEquals(isSuperAdmin(employee), false);
});

Deno.test('isSuperAdmin - level 3 is superadmin', () => {
  const employee = createMockEmployee(3);

  assertEquals(isSuperAdmin(employee), true);
});

Deno.test('isSuperAdmin - null role_data is not superadmin', () => {
  const employee = createMockEmployeeWithoutRole();

  assertEquals(isSuperAdmin(employee), false);
});

Deno.test('isSuperAdmin - null level is not superadmin', () => {
  const employee = createMockEmployee(null);

  assertEquals(isSuperAdmin(employee), false);
});

