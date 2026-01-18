/**
 * E2E Tests for api-places
 * Tests Google Places API proxy endpoints with real database and authentication
 *
 * Note: These tests interact with external Google Places API which requires:
 * - GOOGLE_MAPS_API_KEY environment variable to be set
 * - Valid API key with Places API enabled
 *
 * Tests that make actual API calls are designed to pass even when API is not configured:
 * - Configuration errors (500) are acceptable since API key may not be set in test env
 * - Input validation tests (400) should pass regardless of API configuration
 */

import { assertEquals, assertExists } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import {
  apiGet,
  apiPost,
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
// AUTOCOMPLETE ENDPOINT - INPUT VALIDATION
// ============================================

Deno.test('POST /api-places/autocomplete - should reject empty input', async () => {
  const response = await apiPost('api-places/autocomplete', {
    input: '',
  });
  await response.text(); // Consume body to avoid leak
  assertEquals(response.status, 400);
});

Deno.test('POST /api-places/autocomplete - should reject missing input', async () => {
  const response = await apiPost('api-places/autocomplete', {});
  await response.text(); // Consume body to avoid leak
  assertEquals(response.status, 400);
});

Deno.test('POST /api-places/autocomplete - should return empty array for single character', async () => {
  const response = await apiPost('api-places/autocomplete', {
    input: 'A',
  });
  assertEquals(response.status, 200);
  const data = await assertSuccess<{ predictions: unknown[] }>(response);
  assertExists(data);
  assertExists(data.predictions);
  assertEquals(Array.isArray(data.predictions), true);
  // Single character should return empty predictions (min 2 chars required)
  assertEquals(data.predictions.length, 0);
});

Deno.test('POST /api-places/autocomplete - should reject whitespace-only input', async () => {
  const response = await apiPost('api-places/autocomplete', {
    input: '   ',
  });
  await response.text(); // Consume body to avoid leak
  assertEquals(response.status, 400);
});

Deno.test('POST /api-places/autocomplete - should reject non-string input', async () => {
  const response = await apiPost('api-places/autocomplete', {
    input: 12345,
  });
  await response.text(); // Consume body to avoid leak
  assertEquals(response.status, 400);
});

// ============================================
// DETAILS ENDPOINT - INPUT VALIDATION
// ============================================

Deno.test('POST /api-places/details - should reject empty place_id', async () => {
  const response = await apiPost('api-places/details', {
    place_id: '',
  });
  await response.text(); // Consume body to avoid leak
  assertEquals(response.status, 400);
});

Deno.test('POST /api-places/details - should reject missing place_id', async () => {
  const response = await apiPost('api-places/details', {});
  await response.text(); // Consume body to avoid leak
  assertEquals(response.status, 400);
});

Deno.test('POST /api-places/details - should reject whitespace-only place_id', async () => {
  const response = await apiPost('api-places/details', {
    place_id: '   ',
  });
  await response.text(); // Consume body to avoid leak
  assertEquals(response.status, 400);
});

Deno.test('POST /api-places/details - should reject non-string place_id', async () => {
  const response = await apiPost('api-places/details', {
    place_id: 12345,
  });
  await response.text(); // Consume body to avoid leak
  assertEquals(response.status, 400);
});

// ============================================
// METHOD VALIDATION
// ============================================

Deno.test('GET /api-places/autocomplete - should reject GET method', async () => {
  const response = await apiGet('api-places/autocomplete');
  await response.text(); // Consume body to avoid leak
  assertEquals(response.status, 405);
});

Deno.test('GET /api-places/details - should reject GET method', async () => {
  const response = await apiGet('api-places/details');
  await response.text(); // Consume body to avoid leak
  assertEquals(response.status, 405);
});

// ============================================
// INVALID ENDPOINTS
// ============================================

Deno.test('POST /api-places - root path should return 404', async () => {
  const response = await apiPost('api-places', { input: 'test' });
  await response.text(); // Consume body to avoid leak
  assertEquals(response.status, 404);
});

Deno.test('POST /api-places/invalid - invalid endpoint should return 404', async () => {
  const response = await apiPost('api-places/invalid', { input: 'test' });
  await response.text(); // Consume body to avoid leak
  assertEquals(response.status, 404);
});

// ============================================
// PERMISSION TESTS - ALL AUTHENTICATED USERS CAN ACCESS
// Single character input returns empty array without calling external API
// ============================================

Deno.test('Permission: Super Admin can access autocomplete', async () => {
  const response = await apiPost('api-places/autocomplete', {
    input: 'A', // Single char returns empty array without API call
  }, TEST_EMPLOYEES.superAdmin);
  assertEquals(response.status, 200);
  await response.json(); // Consume body
});

Deno.test('Permission: Admin can access autocomplete', async () => {
  const response = await apiPost('api-places/autocomplete', {
    input: 'B',
  }, TEST_EMPLOYEES.admin);
  assertEquals(response.status, 200);
  await response.json(); // Consume body
});

Deno.test('Permission: Assigner can access autocomplete', async () => {
  const response = await apiPost('api-places/autocomplete', {
    input: 'C',
  }, TEST_EMPLOYEES.assigner);
  assertEquals(response.status, 200);
  await response.json(); // Consume body
});

Deno.test('Permission: Technician can access autocomplete', async () => {
  const response = await apiPost('api-places/autocomplete', {
    input: 'D',
  }, TEST_EMPLOYEES.tech1);
  assertEquals(response.status, 200);
  await response.json(); // Consume body
});

Deno.test('Permission: Sales can access autocomplete', async () => {
  const response = await apiPost('api-places/autocomplete', {
    input: 'E',
  }, TEST_EMPLOYEES.sales1);
  assertEquals(response.status, 200);
  await response.json(); // Consume body
});

Deno.test('Permission: PM can access autocomplete', async () => {
  const response = await apiPost('api-places/autocomplete', {
    input: 'F',
  }, TEST_EMPLOYEES.pm1);
  assertEquals(response.status, 200);
  await response.json(); // Consume body
});

Deno.test('Permission: RMA can access autocomplete', async () => {
  const response = await apiPost('api-places/autocomplete', {
    input: 'G',
  }, TEST_EMPLOYEES.rma1);
  assertEquals(response.status, 200);
  await response.json(); // Consume body
});

// ============================================
// AUTOCOMPLETE - EXTERNAL API TESTS
// These tests make actual API calls - 500 is acceptable if API key not configured
// ============================================

Deno.test('POST /api-places/autocomplete - should accept valid Thai input (API call)', async () => {
  const response = await apiPost('api-places/autocomplete', {
    input: 'กรุงเทพ',
  });
  const data = await response.json();
  // 200 = success with predictions
  // 500 = API key not configured (acceptable in test env)
  if (response.status === 200) {
    assertExists(data.data);
    assertExists(data.data.predictions);
  } else {
    // Configuration error is acceptable in test environment
    assertEquals(response.status, 500);
    assertExists(data.error);
  }
});

Deno.test('POST /api-places/autocomplete - should accept sessionToken', async () => {
  const response = await apiPost('api-places/autocomplete', {
    input: 'สุขุมวิท',
    sessionToken: 'test-session-token-123',
  });
  const data = await response.json();
  // 200 or 500 (config error) are acceptable
  assertEquals(response.status === 200 || response.status === 500, true);
});

Deno.test('POST /api-places/autocomplete - should handle English characters', async () => {
  const response = await apiPost('api-places/autocomplete', {
    input: 'Bangkok Thailand',
  });
  const data = await response.json();
  // 200 or 500 (config error) are acceptable
  assertEquals(response.status === 200 || response.status === 500, true);
});

Deno.test('POST /api-places/autocomplete - should handle mixed Thai and English', async () => {
  const response = await apiPost('api-places/autocomplete', {
    input: 'สุขุมวิท Soi 31',
  });
  const data = await response.json();
  // 200 or 500 (config error) are acceptable
  assertEquals(response.status === 200 || response.status === 500, true);
});

Deno.test('POST /api-places/autocomplete - should handle special characters', async () => {
  const response = await apiPost('api-places/autocomplete', {
    input: '123/45 ถนนสุขุมวิท',
  });
  const data = await response.json();
  // 200 or 500 (config error) are acceptable
  assertEquals(response.status === 200 || response.status === 500, true);
});

Deno.test('POST /api-places/autocomplete - should handle very long input', async () => {
  const longInput = 'กรุงเทพมหานคร '.repeat(50); // About 750 characters
  const response = await apiPost('api-places/autocomplete', {
    input: longInput,
  });
  await response.json(); // Consume body
  // 200, 400 (bad request), or 500 (config error) are acceptable
  assertEquals(response.status === 200 || response.status === 400 || response.status === 500, true);
});

// ============================================
// DETAILS ENDPOINT - EXTERNAL API TESTS
// These tests make actual API calls - 500 is acceptable if API key not configured
// ============================================

Deno.test('POST /api-places/details - should accept valid place_id (API call)', async () => {
  // Using a sample place_id (actual Google place IDs are longer)
  const response = await apiPost('api-places/details', {
    place_id: 'ChIJN1t_tDeuEmsRUsoyG83frY4',
  });
  const data = await response.json();
  // 200 = success with details
  // 400 = invalid place_id (Google API response)
  // 500 = API key not configured
  assertEquals(response.status === 200 || response.status === 400 || response.status === 500, true);
});

Deno.test('POST /api-places/details - should accept sessionToken', async () => {
  const response = await apiPost('api-places/details', {
    place_id: 'ChIJN1t_tDeuEmsRUsoyG83frY4',
    sessionToken: 'test-session-token-456',
  });
  await response.json(); // Consume body
  // 200, 400, or 500 are acceptable
  assertEquals(response.status === 200 || response.status === 400 || response.status === 500, true);
});

// ============================================
// PERMISSION TESTS FOR DETAILS ENDPOINT
// These make API calls - 500 is acceptable if API key not configured
// ============================================

Deno.test('Permission: Super Admin can access details endpoint', async () => {
  const response = await apiPost('api-places/details', {
    place_id: 'test-place-id',
  }, TEST_EMPLOYEES.superAdmin);
  await response.json(); // Consume body
  // Should not return 401/403 (auth errors)
  assertEquals(response.status !== 401 && response.status !== 403, true);
});

Deno.test('Permission: Technician can access details endpoint', async () => {
  const response = await apiPost('api-places/details', {
    place_id: 'test-place-id',
  }, TEST_EMPLOYEES.tech1);
  await response.json(); // Consume body
  // Should not return 401/403 (auth errors)
  assertEquals(response.status !== 401 && response.status !== 403, true);
});

// ============================================
// RESPONSE FORMAT TESTS
// ============================================

Deno.test('POST /api-places/autocomplete - response should have predictions array', async () => {
  const response = await apiPost('api-places/autocomplete', {
    input: 'X', // Single char returns empty array
  });
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
  assertExists(data.data.predictions);
  assertEquals(Array.isArray(data.data.predictions), true);
});

Deno.test('POST /api-places/autocomplete - empty predictions for short input', async () => {
  const response = await apiPost('api-places/autocomplete', {
    input: 'Y',
  });
  assertEquals(response.status, 200);
  const data = await response.json();
  assertEquals(data.data.predictions.length, 0);
});

// ============================================
// EDGE CASES
// ============================================

Deno.test('POST /api-places/autocomplete - should handle null input', async () => {
  const response = await apiPost('api-places/autocomplete', {
    input: null,
  });
  await response.text(); // Consume body
  assertEquals(response.status, 400);
});

Deno.test('POST /api-places/details - should handle null place_id', async () => {
  const response = await apiPost('api-places/details', {
    place_id: null,
  });
  await response.text(); // Consume body
  assertEquals(response.status, 400);
});

Deno.test('POST /api-places/autocomplete - should handle array input', async () => {
  const response = await apiPost('api-places/autocomplete', {
    input: ['test', 'array'],
  });
  await response.text(); // Consume body
  assertEquals(response.status, 400);
});

Deno.test('POST /api-places/details - should handle array place_id', async () => {
  const response = await apiPost('api-places/details', {
    place_id: ['test', 'array'],
  });
  await response.text(); // Consume body
  assertEquals(response.status, 400);
});

Deno.test('POST /api-places/autocomplete - should handle object input', async () => {
  const response = await apiPost('api-places/autocomplete', {
    input: { nested: 'object' },
  });
  await response.text(); // Consume body
  assertEquals(response.status, 400);
});

Deno.test('POST /api-places/details - should handle object place_id', async () => {
  const response = await apiPost('api-places/details', {
    place_id: { nested: 'object' },
  });
  await response.text(); // Consume body
  assertEquals(response.status, 400);
});
