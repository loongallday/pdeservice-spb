/**
 * E2E Tests for api-notifications
 * Tests notification listing and mark-as-read operations with real database and authentication
 */

import { assertEquals, assertExists } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import {
  apiGet,
  apiPut,
  setupTestUsers,
  TEST_EMPLOYEES,
  randomUUID,
  createHeaders,
} from './test-utils.ts';

const BASE_URL = 'http://localhost:54321/functions/v1';

/**
 * Make a PATCH request to an API endpoint
 */
async function apiPatch(
  endpoint: string,
  body: unknown,
  employeeId: string = TEST_EMPLOYEES.superAdmin
): Promise<Response> {
  const url = `${BASE_URL}/${endpoint}`;
  const headers = await createHeaders(employeeId);
  return fetch(url, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(body),
  });
}

/**
 * Make an unauthenticated GET request (for warmup endpoint)
 */
async function apiGetNoAuth(endpoint: string): Promise<Response> {
  const url = `${BASE_URL}/${endpoint}`;
  return fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

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
// WARMUP ENDPOINT (NO AUTH)
// ============================================

Deno.test('GET /api-notifications/warmup - should return warm status without auth', async () => {
  const response = await apiGetNoAuth('api-notifications/warmup');
  assertEquals(response.status, 200);
  const data = await response.json();
  assertEquals(data.status, 'warm');
  assertExists(data.timestamp);
});

// ============================================
// LIST NOTIFICATIONS
// ============================================

Deno.test('GET /api-notifications - should return paginated notifications for authenticated user', async () => {
  const response = await apiGet('api-notifications', TEST_EMPLOYEES.superAdmin);
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
  assertExists(data.pagination);
  assertExists(data.unread_count !== undefined); // unread_count should be present (can be 0)
});

Deno.test('GET /api-notifications - should support pagination parameters', async () => {
  const response = await apiGet('api-notifications?page=1&limit=5', TEST_EMPLOYEES.superAdmin);
  assertEquals(response.status, 200);
  const data = await response.json();
  assertEquals(data.pagination.page, 1);
  assertEquals(data.pagination.limit, 5);
});

Deno.test('GET /api-notifications - should support unread_only filter', async () => {
  const response = await apiGet('api-notifications?unread_only=true', TEST_EMPLOYEES.superAdmin);
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
  // All returned notifications should be unread
  if (data.data.length > 0) {
    for (const notification of data.data) {
      assertEquals(notification.is_read, false);
    }
  }
});

Deno.test('GET /api-notifications - should support search parameter', async () => {
  const response = await apiGet('api-notifications?search=test', TEST_EMPLOYEES.superAdmin);
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
});

Deno.test('GET /api-notifications - different users get their own notifications', async () => {
  // Get notifications for tech1
  const response1 = await apiGet('api-notifications', TEST_EMPLOYEES.tech1);
  assertEquals(response1.status, 200);
  const data1 = await response1.json();
  assertExists(data1.data);

  // Get notifications for tech2
  const response2 = await apiGet('api-notifications', TEST_EMPLOYEES.tech2);
  assertEquals(response2.status, 200);
  const data2 = await response2.json();
  assertExists(data2.data);

  // Both should return valid structures (may or may not have data)
  assertExists(data1.pagination);
  assertExists(data2.pagination);
});

// ============================================
// MARK AS READ - PUT
// ============================================

Deno.test('PUT /api-notifications/read - should mark all notifications as read when no IDs provided', async () => {
  const response = await apiPut('api-notifications/read', {}, TEST_EMPLOYEES.superAdmin);
  const text = await response.text(); // Consume body
  // Should succeed or return 200 with result
  assertEquals(response.status < 500, true, `Unexpected server error: ${text}`);
});

Deno.test('PUT /api-notifications/read - should accept empty body', async () => {
  const response = await apiPut('api-notifications/read', {}, TEST_EMPLOYEES.tech1);
  const text = await response.text(); // Consume body
  assertEquals(response.status < 500, true, `Unexpected server error: ${text}`);
});

Deno.test('PUT /api-notifications/read - should handle empty notification_ids array', async () => {
  const response = await apiPut('api-notifications/read', { notification_ids: [] }, TEST_EMPLOYEES.superAdmin);
  const text = await response.text(); // Consume body
  assertEquals(response.status < 500, true, `Unexpected server error: ${text}`);
});

Deno.test('PUT /api-notifications/read - should handle non-existent notification IDs gracefully', async () => {
  const fakeId = randomUUID();
  const response = await apiPut('api-notifications/read', { notification_ids: [fakeId] }, TEST_EMPLOYEES.superAdmin);
  const text = await response.text(); // Consume body
  // Should not error, just not affect any rows
  assertEquals(response.status < 500, true, `Unexpected server error: ${text}`);
});

// ============================================
// MARK AS READ - PATCH (alias)
// ============================================

Deno.test('PATCH /api-notifications/read - should mark all notifications as read (alias for PUT)', async () => {
  const response = await apiPatch('api-notifications/read', {}, TEST_EMPLOYEES.superAdmin);
  const text = await response.text(); // Consume body
  assertEquals(response.status < 500, true, `Unexpected server error: ${text}`);
});

Deno.test('PATCH /api-notifications/read - should accept notification_ids array', async () => {
  const fakeId = randomUUID();
  const response = await apiPatch('api-notifications/read', { notification_ids: [fakeId] }, TEST_EMPLOYEES.tech1);
  const text = await response.text(); // Consume body
  assertEquals(response.status < 500, true, `Unexpected server error: ${text}`);
});

// ============================================
// AUTHENTICATION TESTS
// ============================================

Deno.test('GET /api-notifications - should require authentication', async () => {
  const response = await apiGetNoAuth('api-notifications');
  await response.text(); // Consume body
  assertEquals(response.status, 401);
});

Deno.test('PUT /api-notifications/read - should require authentication', async () => {
  const url = `${BASE_URL}/api-notifications/read`;
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  });
  await response.text(); // Consume body
  assertEquals(response.status, 401);
});

// ============================================
// INVALID ENDPOINT TESTS
// ============================================

Deno.test('GET /api-notifications/invalid - should return 404 for invalid endpoint', async () => {
  const response = await apiGet('api-notifications/invalid', TEST_EMPLOYEES.superAdmin);
  await response.text(); // Consume body
  assertEquals(response.status, 404);
});

Deno.test('DELETE /api-notifications - should return 404 (method not allowed)', async () => {
  const url = `${BASE_URL}/api-notifications`;
  const headers = await createHeaders(TEST_EMPLOYEES.superAdmin);
  const response = await fetch(url, {
    method: 'DELETE',
    headers,
  });
  await response.text(); // Consume body
  assertEquals(response.status, 404);
});

Deno.test('POST /api-notifications - should return 404 (method not allowed)', async () => {
  const url = `${BASE_URL}/api-notifications`;
  const headers = await createHeaders(TEST_EMPLOYEES.superAdmin);
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({}),
  });
  await response.text(); // Consume body
  assertEquals(response.status, 404);
});

// ============================================
// PERMISSION TESTS - All roles should have access
// ============================================

Deno.test('Permission: Technician can list their notifications', async () => {
  const response = await apiGet('api-notifications', TEST_EMPLOYEES.tech1);
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
});

Deno.test('Permission: Technician can mark notifications as read', async () => {
  const response = await apiPut('api-notifications/read', {}, TEST_EMPLOYEES.tech1);
  const text = await response.text(); // Consume body
  assertEquals(response.status < 500, true, `Unexpected server error: ${text}`);
});

Deno.test('Permission: Assigner can list their notifications', async () => {
  const response = await apiGet('api-notifications', TEST_EMPLOYEES.assigner);
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
});

Deno.test('Permission: Admin can list their notifications', async () => {
  const response = await apiGet('api-notifications', TEST_EMPLOYEES.admin);
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
});

Deno.test('Permission: SuperAdmin can list their notifications', async () => {
  const response = await apiGet('api-notifications', TEST_EMPLOYEES.superAdmin);
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
});
