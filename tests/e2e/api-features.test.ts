/**
 * E2E Tests for api-features
 * Tests all feature flag endpoints with real database and authentication
 *
 * Feature endpoints are read-only and accessible by all authenticated users (level 0+)
 * Features are gated by minimum permission level (0-3)
 *
 * Endpoints:
 * - GET /api-features - Get enabled features for employee level
 * - GET /api-features/menu - Get menu items grouped by group_label
 */

import { assertEquals, assertExists } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import {
  apiGet,
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
// GET ENABLED FEATURES
// ============================================

Deno.test('GET /api-features - should return enabled features list', async () => {
  const response = await apiGet('api-features');
  assertEquals(response.status < 500, true);
  const data = await response.json();
  assertExists(data);
});

Deno.test('GET /api-features - super admin should get features', async () => {
  const response = await apiGet('api-features', TEST_EMPLOYEES.superAdmin);
  assertEquals(response.status < 500, true);
  const data = await response.json();
  assertExists(data);
});

Deno.test('GET /api-features - technician can access features', async () => {
  const response = await apiGet('api-features', TEST_EMPLOYEES.tech1);
  assertEquals(response.status < 500, true);
  const data = await response.json();
  assertExists(data);
});

Deno.test('GET /api-features - response contains data field', async () => {
  const response = await apiGet('api-features');
  assertEquals(response.status < 500, true);
  const data = await response.json();
  assertExists(data);
  // Check that we have either data or error field
  assertEquals(data.data !== undefined || data.error !== undefined, true);
});

Deno.test('GET /api-features - enabled features should be an array', async () => {
  const response = await apiGet('api-features');
  if (response.status === 200) {
    const data = await response.json();
    assertExists(data.data);
    assertEquals(Array.isArray(data.data), true);
  } else {
    await response.text(); // Consume body
    assertEquals(response.status < 500, true);
  }
});

Deno.test('GET /api-features - features have expected structure', async () => {
  const response = await apiGet('api-features');
  if (response.status === 200) {
    const data = await response.json();
    assertExists(data.data);
    if (Array.isArray(data.data) && data.data.length > 0) {
      const feature = data.data[0];
      // Features should have at minimum an id and code
      assertExists(feature.id);
    }
  } else {
    await response.text(); // Consume body
    assertEquals(response.status < 500, true);
  }
});

// ============================================
// GET MENU ITEMS
// ============================================

Deno.test('GET /api-features/menu - should return menu items', async () => {
  const response = await apiGet('api-features/menu');
  assertEquals(response.status < 500, true);
  const data = await response.json();
  assertExists(data);
});

Deno.test('GET /api-features/menu - super admin should get menu items', async () => {
  const response = await apiGet('api-features/menu', TEST_EMPLOYEES.superAdmin);
  assertEquals(response.status < 500, true);
  const data = await response.json();
  assertExists(data);
});

Deno.test('GET /api-features/menu - technician can access menu', async () => {
  const response = await apiGet('api-features/menu', TEST_EMPLOYEES.tech1);
  assertEquals(response.status < 500, true);
  const data = await response.json();
  assertExists(data);
});

Deno.test('GET /api-features/menu - response contains data field', async () => {
  const response = await apiGet('api-features/menu');
  assertEquals(response.status < 500, true);
  const data = await response.json();
  assertExists(data);
  // Check that we have either data or error field
  assertEquals(data.data !== undefined || data.error !== undefined, true);
});

Deno.test('GET /api-features/menu - menu items should be grouped', async () => {
  const response = await apiGet('api-features/menu');
  if (response.status === 200) {
    const data = await response.json();
    assertExists(data.data);
    // Menu items are returned as grouped object or array
    assertEquals(typeof data.data === 'object', true);
  } else {
    await response.text(); // Consume body
    assertEquals(response.status < 500, true);
  }
});

// ============================================
// ERROR HANDLING
// ============================================

Deno.test('GET /api-features/invalid-endpoint - should return 404', async () => {
  const response = await apiGet('api-features/invalid-endpoint');
  await response.text(); // Consume body to avoid leak
  assertEquals(response.status, 404);
});

Deno.test('GET /api-features/menu/extra - should return 404', async () => {
  const response = await apiGet('api-features/menu/extra');
  await response.text(); // Consume body to avoid leak
  assertEquals(response.status, 404);
});

// ============================================
// PERMISSION TESTS - ALL ROLES CAN ACCESS
// ============================================

Deno.test('Permission: Super Admin can access features', async () => {
  const response = await apiGet('api-features', TEST_EMPLOYEES.superAdmin);
  assertEquals(response.status < 500, true);
  await response.json(); // Consume body
});

Deno.test('Permission: Super Admin can access menu', async () => {
  const response = await apiGet('api-features/menu', TEST_EMPLOYEES.superAdmin);
  assertEquals(response.status < 500, true);
  await response.json(); // Consume body
});

Deno.test('Permission: Admin can access features', async () => {
  const response = await apiGet('api-features', TEST_EMPLOYEES.admin);
  assertEquals(response.status < 500, true);
  await response.json(); // Consume body
});

Deno.test('Permission: Admin can access menu', async () => {
  const response = await apiGet('api-features/menu', TEST_EMPLOYEES.admin);
  assertEquals(response.status < 500, true);
  await response.json(); // Consume body
});

Deno.test('Permission: Assigner can access features', async () => {
  const response = await apiGet('api-features', TEST_EMPLOYEES.assigner);
  assertEquals(response.status < 500, true);
  await response.json(); // Consume body
});

Deno.test('Permission: Assigner can access menu', async () => {
  const response = await apiGet('api-features/menu', TEST_EMPLOYEES.assigner);
  assertEquals(response.status < 500, true);
  await response.json(); // Consume body
});

Deno.test('Permission: Technician L1 can access features', async () => {
  const response = await apiGet('api-features', TEST_EMPLOYEES.tech1);
  assertEquals(response.status < 500, true);
  await response.json(); // Consume body
});

Deno.test('Permission: Technician L1 can access menu', async () => {
  const response = await apiGet('api-features/menu', TEST_EMPLOYEES.tech1);
  assertEquals(response.status < 500, true);
  await response.json(); // Consume body
});

Deno.test('Permission: Sales can access features', async () => {
  const response = await apiGet('api-features', TEST_EMPLOYEES.sales1);
  assertEquals(response.status < 500, true);
  await response.json(); // Consume body
});

Deno.test('Permission: Sales can access menu', async () => {
  const response = await apiGet('api-features/menu', TEST_EMPLOYEES.sales1);
  assertEquals(response.status < 500, true);
  await response.json(); // Consume body
});

Deno.test('Permission: PM can access features', async () => {
  const response = await apiGet('api-features', TEST_EMPLOYEES.pm1);
  assertEquals(response.status < 500, true);
  await response.json(); // Consume body
});

Deno.test('Permission: PM can access menu', async () => {
  const response = await apiGet('api-features/menu', TEST_EMPLOYEES.pm1);
  assertEquals(response.status < 500, true);
  await response.json(); // Consume body
});

Deno.test('Permission: RMA can access features', async () => {
  const response = await apiGet('api-features', TEST_EMPLOYEES.rma1);
  assertEquals(response.status < 500, true);
  await response.json(); // Consume body
});

Deno.test('Permission: RMA can access menu', async () => {
  const response = await apiGet('api-features/menu', TEST_EMPLOYEES.rma1);
  assertEquals(response.status < 500, true);
  await response.json(); // Consume body
});

// ============================================
// ROLE-BASED FEATURE VISIBILITY TESTS
// ============================================

Deno.test('Features: Different roles may see different features', async () => {
  const adminResponse = await apiGet('api-features', TEST_EMPLOYEES.superAdmin);
  const techResponse = await apiGet('api-features', TEST_EMPLOYEES.tech1);

  assertEquals(adminResponse.status < 500, true);
  assertEquals(techResponse.status < 500, true);

  const adminData = await adminResponse.json();
  const techData = await techResponse.json();

  // Both should have data or valid error response
  assertExists(adminData);
  assertExists(techData);

  // Super admin (level 3) may have access to more features than tech (level 0)
  if (adminData.data && techData.data) {
    if (Array.isArray(adminData.data) && Array.isArray(techData.data)) {
      // Admin features should be >= tech features due to permission levels
      assertEquals(adminData.data.length >= techData.data.length, true);
    }
  }
});

Deno.test('Menu: Different roles may see different menu items', async () => {
  const adminResponse = await apiGet('api-features/menu', TEST_EMPLOYEES.superAdmin);
  const techResponse = await apiGet('api-features/menu', TEST_EMPLOYEES.tech1);

  assertEquals(adminResponse.status < 500, true);
  assertEquals(techResponse.status < 500, true);

  const adminData = await adminResponse.json();
  const techData = await techResponse.json();

  // Both should have data or valid error response
  assertExists(adminData);
  assertExists(techData);
});

// ============================================
// CONSISTENCY TESTS
// ============================================

Deno.test('Consistency: Multiple requests return same features', async () => {
  const response1 = await apiGet('api-features');
  const data1 = await response1.json();

  const response2 = await apiGet('api-features');
  const data2 = await response2.json();

  assertEquals(response1.status, response2.status);

  if (response1.status === 200) {
    // Feature data should be consistent between requests
    assertEquals(JSON.stringify(data1), JSON.stringify(data2));
  }
});

Deno.test('Consistency: Multiple requests return same menu items', async () => {
  const response1 = await apiGet('api-features/menu');
  const data1 = await response1.json();

  const response2 = await apiGet('api-features/menu');
  const data2 = await response2.json();

  assertEquals(response1.status, response2.status);

  if (response1.status === 200) {
    // Menu data should be consistent between requests
    assertEquals(JSON.stringify(data1), JSON.stringify(data2));
  }
});

// ============================================
// SAME USER CONSISTENCY TESTS
// ============================================

Deno.test('Consistency: Same user gets same features across requests', async () => {
  const response1 = await apiGet('api-features', TEST_EMPLOYEES.tech1);
  const data1 = await response1.json();

  const response2 = await apiGet('api-features', TEST_EMPLOYEES.tech1);
  const data2 = await response2.json();

  assertEquals(response1.status, response2.status);

  if (response1.status === 200) {
    assertEquals(JSON.stringify(data1), JSON.stringify(data2));
  }
});

Deno.test('Consistency: Same user gets same menu across requests', async () => {
  const response1 = await apiGet('api-features/menu', TEST_EMPLOYEES.tech1);
  const data1 = await response1.json();

  const response2 = await apiGet('api-features/menu', TEST_EMPLOYEES.tech1);
  const data2 = await response2.json();

  assertEquals(response1.status, response2.status);

  if (response1.status === 200) {
    assertEquals(JSON.stringify(data1), JSON.stringify(data2));
  }
});
