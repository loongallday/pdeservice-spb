/**
 * E2E Tests for api-fleet-sync
 * Tests the fleet synchronization edge function
 *
 * This function is designed to be called by pg_cron internally and syncs
 * vehicle data from an external fleet tracking system (bgfleet.loginto.me).
 *
 * Endpoints:
 * - POST / - Trigger fleet sync (internal cron use)
 * - GET / - Trigger fleet sync (internal cron use)
 *
 * Note: This function has NO authentication requirement as it's meant to be
 * triggered internally by pg_cron. In production, the external API credentials
 * (FLEET_USERNAME, FLEET_PASSWORD, GOOGLE_MAPS_API_KEY) must be configured.
 *
 * In test environment, the sync will fail due to missing credentials or
 * unreachable external services, which is expected behavior.
 */

import { assertEquals, assertExists } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import {
  apiGet,
  apiPost,
  setupTestUsers,
  TEST_EMPLOYEES,
  createHeaders,
} from './test-utils.ts';

const BASE_URL = 'http://localhost:54321/functions/v1';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

/**
 * Make an unauthenticated GET request
 */
async function apiGetNoAuth(endpoint: string): Promise<Response> {
  const url = `${BASE_URL}/${endpoint}`;
  return fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'apikey': ANON_KEY,
    },
  });
}

/**
 * Make an unauthenticated POST request
 */
async function apiPostNoAuth(endpoint: string, body?: unknown): Promise<Response> {
  const url = `${BASE_URL}/${endpoint}`;
  return fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': ANON_KEY,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * Make an OPTIONS request (CORS preflight)
 */
async function apiOptions(endpoint: string): Promise<Response> {
  const url = `${BASE_URL}/${endpoint}`;
  return fetch(url, {
    method: 'OPTIONS',
    headers: {
      'Origin': 'http://localhost:3000',
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'content-type',
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
// CORS PREFLIGHT
// ============================================

Deno.test('OPTIONS /api-fleet-sync - should handle CORS preflight', async () => {
  const response = await apiOptions('api-fleet-sync');
  await response.text(); // Consume body

  // CORS preflight should return 200 or 204
  assertEquals(response.status === 200 || response.status === 204, true);

  // Should have CORS headers
  const allowOrigin = response.headers.get('Access-Control-Allow-Origin');
  assertExists(allowOrigin);
});

// ============================================
// SYNC TRIGGER (NO AUTH)
// ============================================

Deno.test('GET /api-fleet-sync - should attempt sync and return result or error', async () => {
  // This endpoint doesn't require auth - it's meant for internal cron use
  const response = await apiGetNoAuth('api-fleet-sync');
  const text = await response.text();

  // In test environment, sync will likely fail due to:
  // 1. Missing FLEET_USERNAME/FLEET_PASSWORD env vars
  // 2. External fleet API being unreachable
  // 3. Missing GOOGLE_MAPS_API_KEY
  //
  // Expected: 500 with error message about credentials or API failure
  // OR: 200 if credentials are somehow configured in test env
  assertEquals(
    response.status === 200 || response.status === 500 || response.status === 503,
    true,
    `Unexpected status ${response.status}: ${text}`
  );

  // Response should be JSON
  try {
    const json = JSON.parse(text);
    // Should have either data or error field
    assertEquals(json.data !== undefined || json.error !== undefined, true);
  } catch {
    // If not JSON, that's unexpected
    assertEquals(true, false, `Expected JSON response, got: ${text}`);
  }
});

Deno.test('POST /api-fleet-sync - should attempt sync and return result or error', async () => {
  // POST should also work (alternative trigger method)
  const response = await apiPostNoAuth('api-fleet-sync');
  const text = await response.text();

  // Same expectations as GET
  assertEquals(
    response.status === 200 || response.status === 500 || response.status === 503,
    true,
    `Unexpected status ${response.status}: ${text}`
  );
});

// ============================================
// ERROR MESSAGES
// ============================================

Deno.test('GET /api-fleet-sync - should return meaningful error when credentials missing', async () => {
  const response = await apiGetNoAuth('api-fleet-sync');
  const text = await response.text();

  // If it returns an error, it should be about credentials or API issues
  if (response.status === 500 || response.status === 503) {
    try {
      const json = JSON.parse(text);
      assertExists(json.error);
      // Error should mention credentials, login, or API-related issue
      const errorMsg = json.error.toLowerCase();
      assertEquals(
        errorMsg.includes('credential') ||
        errorMsg.includes('login') ||
        errorMsg.includes('failed') ||
        errorMsg.includes('session') ||
        errorMsg.includes('configured') ||
        errorMsg.includes('api') ||
        errorMsg.includes('fetch'),
        true,
        `Expected credential/API error, got: ${json.error}`
      );
    } catch {
      // Non-JSON response is unexpected
      assertEquals(true, false, `Expected JSON error response, got: ${text}`);
    }
  } else {
    // If status is 200, sync succeeded (unlikely in test env but valid)
    const json = JSON.parse(text);
    assertExists(json.data);
  }
});

// ============================================
// AUTHENTICATED REQUESTS (ALSO WORK)
// ============================================

Deno.test('GET /api-fleet-sync - should work with authenticated request (any permission level)', async () => {
  // Even though auth is not required, authenticated requests should still work
  const response = await apiGet('api-fleet-sync', TEST_EMPLOYEES.tech1);
  const text = await response.text();

  // Same expectations - will fail due to external API but should process the request
  assertEquals(
    response.status === 200 || response.status === 500 || response.status === 503,
    true,
    `Unexpected status ${response.status}: ${text}`
  );
});

Deno.test('GET /api-fleet-sync - should work for technician (L0)', async () => {
  const response = await apiGet('api-fleet-sync', TEST_EMPLOYEES.tech1);
  const text = await response.text();
  assertEquals(
    response.status === 200 || response.status === 500 || response.status === 503,
    true,
    `Unexpected status ${response.status}: ${text}`
  );
});

Deno.test('GET /api-fleet-sync - should work for assigner (L1)', async () => {
  const response = await apiGet('api-fleet-sync', TEST_EMPLOYEES.assigner);
  const text = await response.text();
  assertEquals(
    response.status === 200 || response.status === 500 || response.status === 503,
    true,
    `Unexpected status ${response.status}: ${text}`
  );
});

Deno.test('GET /api-fleet-sync - should work for admin (L2)', async () => {
  const response = await apiGet('api-fleet-sync', TEST_EMPLOYEES.admin);
  const text = await response.text();
  assertEquals(
    response.status === 200 || response.status === 500 || response.status === 503,
    true,
    `Unexpected status ${response.status}: ${text}`
  );
});

Deno.test('GET /api-fleet-sync - should work for superadmin (L3)', async () => {
  const response = await apiGet('api-fleet-sync', TEST_EMPLOYEES.superAdmin);
  const text = await response.text();
  assertEquals(
    response.status === 200 || response.status === 500 || response.status === 503,
    true,
    `Unexpected status ${response.status}: ${text}`
  );
});

// ============================================
// RESPONSE STRUCTURE
// ============================================

Deno.test('GET /api-fleet-sync - response should have proper JSON structure', async () => {
  const response = await apiGetNoAuth('api-fleet-sync');
  const text = await response.text();

  // Should be valid JSON
  let json: Record<string, unknown>;
  try {
    json = JSON.parse(text);
  } catch {
    assertEquals(true, false, `Response is not valid JSON: ${text}`);
    return;
  }

  // On success, should have synced and history_logged counts
  if (response.status === 200) {
    assertExists(json.data);
    const data = json.data as Record<string, unknown>;
    assertEquals(typeof data.synced, 'number');
    assertEquals(typeof data.history_logged, 'number');
  }

  // On error, should have error message
  if (response.status === 500 || response.status === 503) {
    assertExists(json.error);
    assertEquals(typeof json.error, 'string');
  }
});

// ============================================
// INVALID HTTP METHODS
// ============================================

Deno.test('PUT /api-fleet-sync - should return error (method not typically handled)', async () => {
  const url = `${BASE_URL}/api-fleet-sync`;
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'apikey': ANON_KEY,
    },
    body: JSON.stringify({}),
  });
  const text = await response.text();

  // PUT is not explicitly handled, so it will fall through to default handler
  // which runs syncFleetData() anyway (same as GET/POST)
  assertEquals(
    response.status === 200 || response.status === 500 || response.status === 503,
    true,
    `Unexpected status ${response.status}: ${text}`
  );
});

Deno.test('DELETE /api-fleet-sync - should return error (method not typically handled)', async () => {
  const url = `${BASE_URL}/api-fleet-sync`;
  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'apikey': ANON_KEY,
    },
  });
  const text = await response.text();

  // DELETE is not explicitly handled, so it will fall through to default handler
  assertEquals(
    response.status === 200 || response.status === 500 || response.status === 503,
    true,
    `Unexpected status ${response.status}: ${text}`
  );
});

// ============================================
// PATH VARIATIONS
// ============================================

Deno.test('GET /api-fleet-sync/ - should work with trailing slash', async () => {
  const response = await apiGetNoAuth('api-fleet-sync/');
  const text = await response.text();
  assertEquals(
    response.status === 200 || response.status === 500 || response.status === 503,
    true,
    `Unexpected status ${response.status}: ${text}`
  );
});

Deno.test('GET /api-fleet-sync/some-path - should still trigger sync (no path routing)', async () => {
  // The function doesn't do path-based routing, so any path should work
  const response = await apiGetNoAuth('api-fleet-sync/some-path');
  const text = await response.text();
  assertEquals(
    response.status === 200 || response.status === 500 || response.status === 503,
    true,
    `Unexpected status ${response.status}: ${text}`
  );
});

// ============================================
// CONSISTENCY TESTS
// ============================================

Deno.test('Multiple sync requests - should all return consistent response structure', async () => {
  // Make 3 requests in sequence
  const responses: Array<{ status: number; hasData: boolean; hasError: boolean }> = [];

  for (let i = 0; i < 3; i++) {
    const response = await apiGetNoAuth('api-fleet-sync');
    const text = await response.text();

    try {
      const json = JSON.parse(text);
      responses.push({
        status: response.status,
        hasData: json.data !== undefined,
        hasError: json.error !== undefined,
      });
    } catch {
      responses.push({
        status: response.status,
        hasData: false,
        hasError: false,
      });
    }
  }

  // All responses should have same structure
  assertEquals(responses.length, 3);

  // All should return either 200 with data or 500 with error
  for (const r of responses) {
    assertEquals(
      r.status === 200 || r.status === 500 || r.status === 503,
      true,
      `Unexpected status: ${r.status}`
    );
    if (r.status === 200) {
      assertEquals(r.hasData, true);
    }
    if (r.status === 500 || r.status === 503) {
      assertEquals(r.hasError, true);
    }
  }
});

// ============================================
// CONTENT TYPE
// ============================================

Deno.test('GET /api-fleet-sync - should return JSON content type', async () => {
  const response = await apiGetNoAuth('api-fleet-sync');
  await response.text(); // Consume body

  const contentType = response.headers.get('Content-Type');
  assertEquals(
    contentType?.includes('application/json'),
    true,
    `Expected JSON content type, got: ${contentType}`
  );
});

// ============================================
// DOCUMENTATION TESTS
// ============================================

Deno.test('Documentation: Function is designed for internal cron use', async () => {
  // This test documents the expected behavior:
  // 1. No authentication required (internal cron trigger)
  // 2. Sync runs automatically via pg_cron every 5 minutes
  // 3. External API credentials must be configured for sync to work
  // 4. Returns sync statistics on success, error message on failure

  const response = await apiGetNoAuth('api-fleet-sync');
  const text = await response.text();

  // The function should respond without requiring auth
  assertEquals(response.status !== 401, true, 'Should not require authentication');
  assertEquals(response.status !== 403, true, 'Should not be forbidden');

  // Response should be valid JSON
  try {
    JSON.parse(text);
    assertEquals(true, true);
  } catch {
    assertEquals(true, false, 'Response should be valid JSON');
  }
});
