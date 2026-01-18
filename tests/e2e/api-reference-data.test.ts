/**
 * E2E Tests for api-reference-data
 * Tests all reference data endpoints with real database and authentication
 *
 * Reference data endpoints are read-only and accessible by all authenticated users (level 0+)
 */

import { assertEquals, assertExists } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import {
  apiGet,
  assertSuccess,
  setupTestUsers,
  TEST_EMPLOYEES,
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
// GET WORK TYPES
// ============================================

Deno.test('GET /api-reference-data/work-types - should return work types list', async () => {
  const response = await apiGet('api-reference-data/work-types');
  assertEquals(response.status, 200);
  const data = await assertSuccess<Record<string, unknown>[]>(response);
  assertExists(data);
  assertEquals(Array.isArray(data), true);
});

Deno.test('GET /api-reference-data/work-types - technician can access work types', async () => {
  const response = await apiGet('api-reference-data/work-types', TEST_EMPLOYEES.tech1);
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
});

Deno.test('GET /api-reference-data/work-types - response contains expected fields', async () => {
  const response = await apiGet('api-reference-data/work-types');
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);

  // If there are work types, check they have expected structure
  if (Array.isArray(data.data) && data.data.length > 0) {
    const workType = data.data[0];
    assertExists(workType.id);
    assertExists(workType.name);
  }
});

// ============================================
// GET STATUSES
// ============================================

Deno.test('GET /api-reference-data/statuses - should return ticket statuses list', async () => {
  const response = await apiGet('api-reference-data/statuses');
  assertEquals(response.status, 200);
  const data = await assertSuccess<Record<string, unknown>[]>(response);
  assertExists(data);
  assertEquals(Array.isArray(data), true);
});

Deno.test('GET /api-reference-data/statuses - technician can access statuses', async () => {
  const response = await apiGet('api-reference-data/statuses', TEST_EMPLOYEES.tech1);
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
});

Deno.test('GET /api-reference-data/statuses - response contains expected fields', async () => {
  const response = await apiGet('api-reference-data/statuses');
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);

  // If there are statuses, check they have expected structure
  if (Array.isArray(data.data) && data.data.length > 0) {
    const status = data.data[0];
    assertExists(status.id);
    assertExists(status.name);
  }
});

// ============================================
// GET LEAVE TYPES
// ============================================

Deno.test('GET /api-reference-data/leave-types - should return leave types list', async () => {
  const response = await apiGet('api-reference-data/leave-types');
  assertEquals(response.status, 200);
  const data = await assertSuccess<Record<string, unknown>[]>(response);
  assertExists(data);
  assertEquals(Array.isArray(data), true);
});

Deno.test('GET /api-reference-data/leave-types - technician can access leave types', async () => {
  const response = await apiGet('api-reference-data/leave-types', TEST_EMPLOYEES.tech1);
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
});

Deno.test('GET /api-reference-data/leave-types - response contains expected fields', async () => {
  const response = await apiGet('api-reference-data/leave-types');
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);

  // If there are leave types, check they have expected structure
  if (Array.isArray(data.data) && data.data.length > 0) {
    const leaveType = data.data[0];
    assertExists(leaveType.id);
    assertExists(leaveType.name);
  }
});

// ============================================
// GET PROVINCES
// ============================================

Deno.test('GET /api-reference-data/provinces - should return provinces list', async () => {
  const response = await apiGet('api-reference-data/provinces');
  assertEquals(response.status, 200);
  const data = await assertSuccess<Record<string, unknown>[]>(response);
  assertExists(data);
  assertEquals(Array.isArray(data), true);
});

Deno.test('GET /api-reference-data/provinces - technician can access provinces', async () => {
  const response = await apiGet('api-reference-data/provinces', TEST_EMPLOYEES.tech1);
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
});

// ============================================
// GET WORK GIVERS
// ============================================

Deno.test('GET /api-reference-data/work-givers - should return work givers list', async () => {
  const response = await apiGet('api-reference-data/work-givers');
  assertEquals(response.status, 200);
  const data = await assertSuccess<Record<string, unknown>[]>(response);
  assertExists(data);
  assertEquals(Array.isArray(data), true);
});

Deno.test('GET /api-reference-data/work-givers - technician can access work givers', async () => {
  const response = await apiGet('api-reference-data/work-givers', TEST_EMPLOYEES.tech1);
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
});

Deno.test('GET /api-reference-data/work-givers - response contains expected fields', async () => {
  const response = await apiGet('api-reference-data/work-givers');
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);

  // If there are work givers, check they have expected structure
  if (Array.isArray(data.data) && data.data.length > 0) {
    const workGiver = data.data[0];
    assertExists(workGiver.id);
    assertExists(workGiver.name);
  }
});

// ============================================
// ERROR HANDLING
// ============================================

Deno.test('GET /api-reference-data/invalid-endpoint - should return 404', async () => {
  const response = await apiGet('api-reference-data/invalid-endpoint');
  await response.text(); // Consume body to avoid leak
  assertEquals(response.status, 404);
});

Deno.test('GET /api-reference-data - root path should return 404', async () => {
  const response = await apiGet('api-reference-data');
  await response.text(); // Consume body to avoid leak
  assertEquals(response.status, 404);
});

// ============================================
// PERMISSION TESTS - ALL ROLES CAN ACCESS
// ============================================

Deno.test('Permission: Super Admin can access all reference data', async () => {
  const response = await apiGet('api-reference-data/work-types', TEST_EMPLOYEES.superAdmin);
  assertEquals(response.status, 200);
  await response.json(); // Consume body
});

Deno.test('Permission: Admin can access all reference data', async () => {
  const response = await apiGet('api-reference-data/statuses', TEST_EMPLOYEES.admin);
  assertEquals(response.status, 200);
  await response.json(); // Consume body
});

Deno.test('Permission: Assigner can access all reference data', async () => {
  const response = await apiGet('api-reference-data/leave-types', TEST_EMPLOYEES.assigner);
  assertEquals(response.status, 200);
  await response.json(); // Consume body
});

Deno.test('Permission: Technician L1 can access all reference data', async () => {
  const response = await apiGet('api-reference-data/provinces', TEST_EMPLOYEES.tech1);
  assertEquals(response.status, 200);
  await response.json(); // Consume body
});

Deno.test('Permission: Sales can access all reference data', async () => {
  const response = await apiGet('api-reference-data/work-givers', TEST_EMPLOYEES.sales1);
  assertEquals(response.status, 200);
  await response.json(); // Consume body
});

Deno.test('Permission: PM can access all reference data', async () => {
  const response = await apiGet('api-reference-data/work-types', TEST_EMPLOYEES.pm1);
  assertEquals(response.status, 200);
  await response.json(); // Consume body
});

Deno.test('Permission: RMA can access all reference data', async () => {
  const response = await apiGet('api-reference-data/statuses', TEST_EMPLOYEES.rma1);
  assertEquals(response.status, 200);
  await response.json(); // Consume body
});

// ============================================
// CONSISTENCY TESTS
// ============================================

Deno.test('Consistency: Multiple requests return same data', async () => {
  const response1 = await apiGet('api-reference-data/work-types');
  const data1 = await response1.json();

  const response2 = await apiGet('api-reference-data/work-types');
  const data2 = await response2.json();

  assertEquals(response1.status, 200);
  assertEquals(response2.status, 200);

  // Reference data should be consistent between requests
  assertEquals(JSON.stringify(data1), JSON.stringify(data2));
});
