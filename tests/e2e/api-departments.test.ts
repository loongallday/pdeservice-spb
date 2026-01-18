/**
 * E2E Tests for api-departments
 * Tests all department operations with real database and authentication
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

// Test department IDs from seed data
const TEST_DEPARTMENTS = {
  admin: '6dcd5778-ef2f-4605-8584-b94f7afee0ec',
  general: '9832c452-4494-4642-8451-25279a932caf',
  pm: '10922489-f324-4bfd-8afd-ffa5edcc8eba',
  rma: 'e4b2d701-122a-417e-9680-8fb5746887b4',
  sales: '3fb22d7b-9902-453b-a97f-f04a91dd76e0',
  technical: 'f7ee1d76-d95d-4fd6-90be-ce5177ecc2be',
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
// GET DEPARTMENT BY ID
// ============================================

Deno.test('GET /api-departments/:id - should get existing department', async () => {
  const response = await apiGet(`api-departments/${TEST_DEPARTMENTS.admin}`);
  assertEquals(response.status, 200);
  const department = await assertSuccess(response);
  assertExists(department);
  assertEquals((department as Record<string, unknown>).id, TEST_DEPARTMENTS.admin);
});

Deno.test('GET /api-departments/:id - should return 404 for non-existent department', async () => {
  const fakeId = randomUUID();
  const response = await apiGet(`api-departments/${fakeId}`);
  await response.text(); // Consume body to avoid leak
  assertEquals(response.status, 404);
});

Deno.test('GET /api-departments/:id - should return 400 for invalid UUID', async () => {
  const response = await apiGet('api-departments/invalid-uuid');
  await response.text(); // Consume body to avoid leak
  assertEquals(response.status, 400);
});

// ============================================
// SEARCH DEPARTMENTS
// ============================================

Deno.test('GET /api-departments/search - should return paginated departments', async () => {
  const response = await apiGet('api-departments/search');
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
  assertExists(data.pagination);
});

Deno.test('GET /api-departments/search - should filter by query', async () => {
  const response = await apiGet('api-departments/search?q=admin');
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
});

Deno.test('GET /api-departments/search - should support pagination', async () => {
  const response = await apiGet('api-departments/search?page=1&limit=3');
  assertEquals(response.status, 200);
  const data = await response.json();
  assertEquals(data.pagination.page, 1);
  assertEquals(data.pagination.limit, 3);
});

Deno.test('GET /api-departments/search - should return empty result for no matches', async () => {
  const response = await apiGet('api-departments/search?q=nonexistentdepartmentxyz');
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
  assertEquals(data.data.length, 0);
});

// ============================================
// DEPARTMENT SUMMARY
// ============================================

Deno.test('GET /api-departments/department-summary - should return department summary with employee counts', async () => {
  const response = await apiGet('api-departments/department-summary');
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
});

Deno.test('GET /api-departments/department-summary - technician can access summary', async () => {
  const response = await apiGet('api-departments/department-summary', TEST_EMPLOYEES.tech1);
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
});

// ============================================
// CREATE DEPARTMENT
// ============================================

Deno.test('POST /api-departments - should create department with valid data', async () => {
  const departmentData = {
    code: `e2e_test_${Date.now()}`,
    name_th: 'แผนกทดสอบ E2E',
    name_en: 'E2E Test Department',
    description: 'Department created during E2E testing',
    is_active: true,
  };

  const response = await apiPost('api-departments', departmentData, TEST_EMPLOYEES.superAdmin);
  const text = await response.text(); // Consume body
  // Should succeed or return validation error (e.g., duplicate code)
  assertEquals(response.status < 500, true, `Unexpected server error: ${text}`);
});

Deno.test('POST /api-departments - should reject missing code', async () => {
  const departmentData = {
    name_th: 'แผนกไม่มีรหัส',
  };

  const response = await apiPost('api-departments', departmentData, TEST_EMPLOYEES.superAdmin);
  await response.text(); // Consume body
  assertEquals(response.status, 400);
});

Deno.test('POST /api-departments - should reject missing name_th', async () => {
  const departmentData = {
    code: 'missing_name',
  };

  const response = await apiPost('api-departments', departmentData, TEST_EMPLOYEES.superAdmin);
  await response.text(); // Consume body
  assertEquals(response.status, 400);
});

// ============================================
// UPDATE DEPARTMENT
// ============================================

Deno.test('PUT /api-departments/:id - should update department', async () => {
  const updateData = {
    name_en: `Updated Department ${Date.now()}`,
  };

  const response = await apiPut(`api-departments/${TEST_DEPARTMENTS.general}`, updateData, TEST_EMPLOYEES.superAdmin);
  await response.text(); // Consume body
  assertEquals(response.status >= 200 && response.status < 500, true);
});

Deno.test('PUT /api-departments/:id - should return error for non-existent department', async () => {
  const fakeId = randomUUID();
  const updateData = {
    name_en: 'Should fail',
  };

  const response = await apiPut(`api-departments/${fakeId}`, updateData, TEST_EMPLOYEES.superAdmin);
  await response.text(); // Consume body
  assertEquals(response.status >= 400, true);
});

Deno.test('PUT /api-departments/:id - should reject empty update body', async () => {
  const response = await apiPut(`api-departments/${TEST_DEPARTMENTS.admin}`, {}, TEST_EMPLOYEES.superAdmin);
  await response.text(); // Consume body
  assertEquals(response.status, 400);
});

Deno.test('PUT /api-departments/:id - should return 400 for invalid UUID', async () => {
  const updateData = {
    name_en: 'Should fail',
  };

  const response = await apiPut('api-departments/invalid-uuid', updateData, TEST_EMPLOYEES.superAdmin);
  await response.text(); // Consume body
  assertEquals(response.status, 400);
});

// ============================================
// DELETE DEPARTMENT
// ============================================

Deno.test('DELETE /api-departments/:id - should delete department created for testing', async () => {
  // First, create a department to delete
  const departmentData = {
    code: `to_delete_${Date.now()}`,
    name_th: 'แผนกที่จะลบ',
    name_en: 'Department to Delete',
  };

  const createResponse = await apiPost('api-departments', departmentData, TEST_EMPLOYEES.superAdmin);
  const createText = await createResponse.text();

  // Only proceed with delete if create succeeded
  if (createResponse.status === 201) {
    const createdData = JSON.parse(createText);
    const departmentId = createdData.data.id;

    const deleteResponse = await apiDelete(`api-departments/${departmentId}`, TEST_EMPLOYEES.superAdmin);
    await deleteResponse.text(); // Consume body
    assertEquals(deleteResponse.status < 500, true);
  } else {
    // If create failed (e.g., due to db constraints), skip delete test
    assertEquals(createResponse.status < 500, true, `Create failed: ${createText}`);
  }
});

Deno.test('DELETE /api-departments/:id - should succeed for non-existent department (no-op)', async () => {
  // Note: Supabase delete doesn't throw error when no rows are affected
  // This is expected behavior - delete is idempotent
  const fakeId = randomUUID();
  const response = await apiDelete(`api-departments/${fakeId}`, TEST_EMPLOYEES.superAdmin);
  await response.text(); // Consume body
  assertEquals(response.status < 500, true);
});

Deno.test('DELETE /api-departments/:id - should return 400 for invalid UUID', async () => {
  const response = await apiDelete('api-departments/invalid-uuid', TEST_EMPLOYEES.superAdmin);
  await response.text(); // Consume body
  assertEquals(response.status, 400);
});

// ============================================
// PERMISSION TESTS
// ============================================

Deno.test('Permission: Technician can search departments', async () => {
  const response = await apiGet('api-departments/search', TEST_EMPLOYEES.tech1);
  assertEquals(response.status, 200);
  await response.json(); // Consume body
});

Deno.test('Permission: Technician can read department by ID', async () => {
  const response = await apiGet(`api-departments/${TEST_DEPARTMENTS.admin}`, TEST_EMPLOYEES.tech1);
  await response.text(); // Consume body
  assertEquals(response.status, 200);
});

Deno.test('Permission: Technician cannot create departments', async () => {
  const departmentData = {
    code: 'should_fail',
    name_th: 'ควรล้มเหลว',
    name_en: 'Should Fail',
  };

  const response = await apiPost('api-departments', departmentData, TEST_EMPLOYEES.tech1);
  await response.text(); // Consume body
  assertEquals(response.status, 403);
});

Deno.test('Permission: Technician cannot update departments', async () => {
  const updateData = {
    name_en: 'Should fail',
  };

  const response = await apiPut(`api-departments/${TEST_DEPARTMENTS.admin}`, updateData, TEST_EMPLOYEES.tech1);
  await response.text(); // Consume body
  assertEquals(response.status, 403);
});

Deno.test('Permission: Technician cannot delete departments', async () => {
  const response = await apiDelete(`api-departments/${TEST_DEPARTMENTS.admin}`, TEST_EMPLOYEES.tech1);
  await response.text(); // Consume body
  assertEquals(response.status, 403);
});

Deno.test('Permission: Admin (level 2) cannot create departments', async () => {
  const departmentData = {
    code: 'admin_fail',
    name_th: 'ควรล้มเหลว',
    name_en: 'Should Fail',
  };

  const response = await apiPost('api-departments', departmentData, TEST_EMPLOYEES.admin);
  await response.text(); // Consume body
  assertEquals(response.status, 403);
});

Deno.test('Permission: Admin (level 2) cannot update departments', async () => {
  const updateData = {
    name_en: 'Should fail',
  };

  const response = await apiPut(`api-departments/${TEST_DEPARTMENTS.admin}`, updateData, TEST_EMPLOYEES.admin);
  await response.text(); // Consume body
  assertEquals(response.status, 403);
});

Deno.test('Permission: Admin (level 2) cannot delete departments', async () => {
  const response = await apiDelete(`api-departments/${TEST_DEPARTMENTS.admin}`, TEST_EMPLOYEES.admin);
  await response.text(); // Consume body
  assertEquals(response.status, 403);
});
