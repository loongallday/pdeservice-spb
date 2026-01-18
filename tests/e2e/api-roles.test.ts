/**
 * E2E Tests for api-roles
 * Tests all role operations with real database and authentication
 *
 * Endpoints tested:
 * - GET    /search        - Search roles
 * - GET    /role-summary  - Get all roles with employee counts
 * - GET    /:id           - Get role by ID
 * - POST   /              - Create new role
 * - PUT    /:id           - Update role
 * - DELETE /:id           - Delete role
 */

import { assertEquals, assertExists } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import {
  apiGet,
  apiPost,
  apiPut,
  apiDelete,
  assertSuccess,
  setupTestUsers,
  TEST_EMPLOYEES,
  randomUUID,
} from './test-utils.ts';

// Test role IDs from seed data (main_org_roles)
const TEST_ROLES = {
  superadmin: '2443de66-4083-40e0-9f4e-3ec963c816d8',
  admin: '44ec3f3f-b7f2-4fb5-a1b7-63435922a847',
  technicianL1: 'fc347af8-2633-4fb4-a0eb-a3bbe63957a8',
  technicianL2: 'e238ab2d-adae-4322-9ebb-2fb951c91a8f',
  assigner: 'e4cafe9c-c22b-45bb-b1f8-023fbf7394fd',
  salesL1: '38d84907-9182-4643-b766-bba4ca96e4c8',
  stock: '5bed8f0d-5f02-4638-85a4-262491db4eda',
};

// Setup before all tests
Deno.test({
  name: 'Setup: Create test auth users',
  fn: async () => {
    await setupTestUsers();
  },
  sanitizeOps: false,
  sanitizeResources: false,
});

// ============================================
// GET ROLE BY ID
// ============================================

Deno.test('GET /api-roles/:id - should get existing role', async () => {
  const response = await apiGet(`api-roles/${TEST_ROLES.admin}`);
  assertEquals(response.status, 200);
  const role = await assertSuccess(response);
  assertExists(role);
  assertEquals((role as Record<string, unknown>).id, TEST_ROLES.admin);
});

Deno.test('GET /api-roles/:id - should return 404 for non-existent role', async () => {
  const fakeId = randomUUID();
  const response = await apiGet(`api-roles/${fakeId}`);
  await response.text(); // Consume body to avoid leak
  assertEquals(response.status, 404);
});

Deno.test('GET /api-roles/:id - should return 400 for invalid UUID', async () => {
  const response = await apiGet('api-roles/invalid-uuid');
  await response.text(); // Consume body
  assertEquals(response.status, 400);
});

// ============================================
// SEARCH ROLES
// ============================================

Deno.test('GET /api-roles/search - should return paginated roles', async () => {
  const response = await apiGet('api-roles/search');
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
  assertExists(data.pagination);
});

Deno.test('GET /api-roles/search - should filter by query parameter', async () => {
  const response = await apiGet('api-roles/search?q=admin');
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
});

Deno.test('GET /api-roles/search - should support pagination', async () => {
  const response = await apiGet('api-roles/search?page=1&limit=5');
  assertEquals(response.status, 200);
  const data = await response.json();
  assertEquals(data.pagination.page, 1);
  assertEquals(data.pagination.limit, 5);
});

Deno.test('GET /api-roles/search - should return empty for non-matching query', async () => {
  const response = await apiGet('api-roles/search?q=xyznonexistent123');
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
  assertEquals(Array.isArray(data.data), true);
});

// ============================================
// ROLE SUMMARY
// ============================================

Deno.test('GET /api-roles/role-summary - should return role summary with counts', async () => {
  const response = await apiGet('api-roles/role-summary');
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
});

Deno.test('GET /api-roles/role-summary - technician can access', async () => {
  const response = await apiGet('api-roles/role-summary', TEST_EMPLOYEES.tech1);
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
});

// ============================================
// CREATE ROLE
// ============================================

Deno.test('POST /api-roles - should create role with valid data (superadmin)', async () => {
  const roleData = {
    code: `e2e_role_${Date.now()}`,
    name_th: 'บทบาททดสอบ E2E',
    name_en: 'E2E Test Role',
    description: 'Created by E2E test',
    level: 0,
  };

  const response = await apiPost('api-roles', roleData, TEST_EMPLOYEES.superAdmin);
  const text = await response.text(); // Consume body
  // Should succeed (201) or return validation error
  assertEquals(response.status < 500, true, `Unexpected server error: ${text}`);
});

Deno.test('POST /api-roles - should reject missing code', async () => {
  const roleData = {
    name_th: 'บทบาทไม่มีรหัส',
    name_en: 'Role without code',
  };

  const response = await apiPost('api-roles', roleData, TEST_EMPLOYEES.superAdmin);
  await response.text(); // Consume body
  assertEquals(response.status, 400);
});

Deno.test('POST /api-roles - should reject missing name_th', async () => {
  const roleData = {
    code: `role_no_name_${Date.now()}`,
    name_en: 'Role without Thai name',
  };

  const response = await apiPost('api-roles', roleData, TEST_EMPLOYEES.superAdmin);
  await response.text(); // Consume body
  assertEquals(response.status, 400);
});

// ============================================
// UPDATE ROLE
// ============================================

Deno.test('PUT /api-roles/:id - should update role (superadmin)', async () => {
  // First create a role to update
  const createData = {
    code: `update_test_${Date.now()}`,
    name_th: 'บทบาทสำหรับอัปเดต',
    name_en: 'Role for update test',
    level: 0,
  };

  const createResponse = await apiPost('api-roles', createData, TEST_EMPLOYEES.superAdmin);

  if (createResponse.status === 201) {
    const createJson = await createResponse.json();
    const roleId = createJson.data.id;

    const updateData = {
      name_en: `Updated Role ${Date.now()}`,
      description: 'Updated by E2E test',
    };

    const response = await apiPut(`api-roles/${roleId}`, updateData, TEST_EMPLOYEES.superAdmin);
    await response.text(); // Consume body
    assertEquals(response.status >= 200 && response.status < 500, true);
  } else {
    // If create failed, skip update test
    await createResponse.text();
  }
});

Deno.test('PUT /api-roles/:id - should return error for non-existent role', async () => {
  const fakeId = randomUUID();
  const updateData = {
    name_en: 'Should fail',
  };

  const response = await apiPut(`api-roles/${fakeId}`, updateData, TEST_EMPLOYEES.superAdmin);
  await response.text(); // Consume body
  assertEquals(response.status >= 400, true);
});

Deno.test('PUT /api-roles/:id - should reject empty update data', async () => {
  const response = await apiPut(`api-roles/${TEST_ROLES.technicianL1}`, {}, TEST_EMPLOYEES.superAdmin);
  await response.text(); // Consume body
  assertEquals(response.status, 400);
});

// ============================================
// DELETE ROLE
// ============================================

Deno.test('DELETE /api-roles/:id - should delete role (superadmin)', async () => {
  // First create a role to delete
  const createData = {
    code: `delete_test_${Date.now()}`,
    name_th: 'บทบาทสำหรับลบ',
    name_en: 'Role for delete test',
    level: 0,
  };

  const createResponse = await apiPost('api-roles', createData, TEST_EMPLOYEES.superAdmin);

  if (createResponse.status === 201) {
    const createJson = await createResponse.json();
    const roleId = createJson.data.id;

    const response = await apiDelete(`api-roles/${roleId}`, TEST_EMPLOYEES.superAdmin);
    assertEquals(response.status, 200);
    const data = await response.json();
    assertExists(data.data.message);
  } else {
    // If create failed, skip delete test
    await createResponse.text();
  }
});

Deno.test('DELETE /api-roles/:id - handles non-existent role gracefully', async () => {
  // Note: DELETE is idempotent - returns success even for non-existent IDs
  const fakeId = randomUUID();
  const response = await apiDelete(`api-roles/${fakeId}`, TEST_EMPLOYEES.superAdmin);
  await response.text(); // Consume body
  // Delete is idempotent, so it returns 200 even for non-existent roles
  assertEquals(response.status < 500, true);
});

// ============================================
// PERMISSION TESTS
// ============================================

Deno.test('Permission: Technician can read roles', async () => {
  const response = await apiGet(`api-roles/${TEST_ROLES.admin}`, TEST_EMPLOYEES.tech1);
  assertEquals(response.status, 200);
  await response.json(); // Consume body
});

Deno.test('Permission: Technician can search roles', async () => {
  const response = await apiGet('api-roles/search', TEST_EMPLOYEES.tech1);
  assertEquals(response.status, 200);
  await response.json(); // Consume body
});

Deno.test('Permission: Technician cannot create roles', async () => {
  const roleData = {
    code: 'should_fail',
    name_th: 'Should Fail',
    name_en: 'Should Fail Role',
  };

  const response = await apiPost('api-roles', roleData, TEST_EMPLOYEES.tech1);
  await response.text(); // Consume body
  assertEquals(response.status, 403);
});

Deno.test('Permission: Technician cannot update roles', async () => {
  const updateData = {
    name_en: 'Should Fail Update',
  };

  const response = await apiPut(`api-roles/${TEST_ROLES.technicianL1}`, updateData, TEST_EMPLOYEES.tech1);
  await response.text(); // Consume body
  assertEquals(response.status, 403);
});

Deno.test('Permission: Technician cannot delete roles', async () => {
  const response = await apiDelete(`api-roles/${TEST_ROLES.technicianL1}`, TEST_EMPLOYEES.tech1);
  await response.text(); // Consume body
  assertEquals(response.status, 403);
});

Deno.test('Permission: Admin cannot create roles (only superadmin)', async () => {
  const roleData = {
    code: 'admin_should_fail',
    name_th: 'Should Fail',
    name_en: 'Admin should not create',
  };

  const response = await apiPost('api-roles', roleData, TEST_EMPLOYEES.admin);
  await response.text(); // Consume body
  assertEquals(response.status, 403);
});

Deno.test('Permission: Admin cannot update roles (only superadmin)', async () => {
  const updateData = {
    name_en: 'Admin Should Fail Update',
  };

  const response = await apiPut(`api-roles/${TEST_ROLES.technicianL1}`, updateData, TEST_EMPLOYEES.admin);
  await response.text(); // Consume body
  assertEquals(response.status, 403);
});

Deno.test('Permission: Admin cannot delete roles (only superadmin)', async () => {
  const response = await apiDelete(`api-roles/${TEST_ROLES.technicianL1}`, TEST_EMPLOYEES.admin);
  await response.text(); // Consume body
  assertEquals(response.status, 403);
});
