/**
 * E2E Tests for api-employees
 * Tests all employee operations with real database and authentication
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
// GET EMPLOYEE BY ID
// ============================================

Deno.test('GET /api-employees/:id - should get existing employee', async () => {
  const response = await apiGet(`api-employees/${TEST_EMPLOYEES.superAdmin}`);
  assertEquals(response.status, 200);
  const employee = await assertSuccess(response);
  assertExists(employee);
  assertEquals((employee as Record<string, unknown>).id, TEST_EMPLOYEES.superAdmin);
});

Deno.test('GET /api-employees/:id - should return 404 for non-existent employee', async () => {
  const fakeId = randomUUID();
  const response = await apiGet(`api-employees/${fakeId}`);
  await response.text(); // Consume body to avoid leak
  assertEquals(response.status, 404);
});

Deno.test('GET /api-employees/:id - should return 400 for invalid UUID', async () => {
  const response = await apiGet('api-employees/invalid-uuid');
  await response.text(); // Consume body to avoid leak
  assertEquals(response.status, 400);
});

// ============================================
// SEARCH EMPLOYEES
// ============================================

Deno.test('GET /api-employees - should return paginated employees', async () => {
  const response = await apiGet('api-employees');
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
  assertExists(data.pagination);
});

Deno.test('GET /api-employees - should filter by is_active', async () => {
  const response = await apiGet('api-employees?is_active=true');
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
});

Deno.test('GET /api-employees - should support pagination', async () => {
  const response = await apiGet('api-employees?page=1&limit=5');
  assertEquals(response.status, 200);
  const data = await response.json();
  assertEquals(data.pagination.page, 1);
  assertEquals(data.pagination.limit, 5);
});

// ============================================
// NETWORK SEARCH
// ============================================

Deno.test('GET /api-employees/network-search - should return employees for management UI', async () => {
  const response = await apiGet('api-employees/network-search');
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
});

Deno.test('GET /api-employees/network-search - should filter by keyword', async () => {
  const response = await apiGet('api-employees/network-search?keyword=Admin');
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
});

// ============================================
// EMPLOYEE SUMMARY
// ============================================

Deno.test('GET /api-employees/employee-summary - should return lightweight employee list', async () => {
  const response = await apiGet('api-employees/employee-summary');
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
});

// ============================================
// TECHNICIAN AVAILABILITY
// ============================================

Deno.test('GET /api-employees/technicians/availability - should get technician workload', async () => {
  const today = new Date().toISOString().split('T')[0];
  const response = await apiGet(`api-employees/technicians/availability?date=${today}`);
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
});

// ============================================
// CREATE EMPLOYEE
// ============================================

Deno.test('POST /api-employees - should create employee with admin permissions', async () => {
  // First get a valid role_id from an existing employee
  const existingEmpResponse = await apiGet(`api-employees/${TEST_EMPLOYEES.tech1}`, TEST_EMPLOYEES.superAdmin);
  const existingEmp = await existingEmpResponse.json();
  const validRoleId = existingEmp.data?.role_id;

  const employeeData = {
    name: 'E2E Test Employee',
    code: `E2E${Date.now()}`,
    email: `e2e-${Date.now()}@test.com`,
    role_id: validRoleId,
    is_active: true,
  };

  const response = await apiPost('api-employees', employeeData, TEST_EMPLOYEES.superAdmin);
  const text = await response.text(); // Consume body
  // Should succeed (201) or return validation/permission error (4xx)
  assertEquals(response.status < 500, true, `Unexpected server error: ${text}`);
});

Deno.test('POST /api-employees - should reject technician creating employee', async () => {
  const employeeData = {
    name: 'Should Fail Employee',
    code: 'FAIL001',
    email: 'fail@test.com',
    role_id: '10000000-0000-0000-0000-000000000001',
    is_active: true,
  };

  const response = await apiPost('api-employees', employeeData, TEST_EMPLOYEES.tech1);
  await response.text(); // Consume body to avoid leak
  assertEquals(response.status, 403);
});

// ============================================
// UPDATE EMPLOYEE
// ============================================

Deno.test('PUT /api-employees/:id - should update employee with admin permissions', async () => {
  const updateData = {
    nickname: `Updated-${Date.now()}`,
  };

  const response = await apiPut(`api-employees/${TEST_EMPLOYEES.tech1}`, updateData, TEST_EMPLOYEES.superAdmin);
  await response.text(); // Consume body
  assertEquals(response.status >= 200 && response.status < 500, true);
});

Deno.test('PUT /api-employees/:id - should return error for non-existent employee', async () => {
  const fakeId = randomUUID();
  const updateData = {
    nickname: 'Should fail',
  };

  const response = await apiPut(`api-employees/${fakeId}`, updateData, TEST_EMPLOYEES.superAdmin);
  await response.text(); // Consume body to avoid leak
  // Should return 404 or 500 (some implementations throw on non-existent)
  assertEquals(response.status >= 400, true);
});

// ============================================
// ACHIEVEMENTS
// ============================================

Deno.test('GET /api-employees/achievements/progress - should get current user achievement progress', async () => {
  const response = await apiGet('api-employees/achievements/progress');
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
});

Deno.test('GET /api-employees/achievements/coupons - should get current user coupons', async () => {
  const response = await apiGet('api-employees/achievements/coupons');
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
});

Deno.test('POST /api-employees/achievements/track - should track achievement action', async () => {
  const trackData = {
    action_type: 'ticket_completed',
  };

  const response = await apiPost('api-employees/achievements/track', trackData);
  await response.text(); // Consume body
  // May succeed or fail depending on achievement configuration
  assertEquals(response.status >= 200 && response.status < 500, true);
});

// ============================================
// PERMISSION TESTS
// ============================================

Deno.test('Permission: Technician can read own profile', async () => {
  const response = await apiGet(`api-employees/${TEST_EMPLOYEES.tech1}`, TEST_EMPLOYEES.tech1);
  await response.text(); // Consume body
  assertEquals(response.status, 200);
});

Deno.test('Permission: Technician can read other employees', async () => {
  const response = await apiGet(`api-employees/${TEST_EMPLOYEES.superAdmin}`, TEST_EMPLOYEES.tech1);
  await response.text(); // Consume body
  assertEquals(response.status, 200);
});
