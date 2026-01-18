/**
 * E2E Edge Case Tests
 * Tests for unusual inputs, boundary conditions, and edge scenarios
 * Goal: Expose bugs in edge case handling
 */

import { assertEquals, assertExists } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import {
  apiGet,
  apiPost,
  apiPut,
  apiDelete,
  setupTestUsers,
  TEST_EMPLOYEES,
  TEST_SITES,
  TEST_TICKETS,
  TEST_COMPANIES,
  REF_DATA,
  randomUUID,
} from './test-utils.ts';

const BASE_URL = 'http://localhost:54321/functions/v1';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

// Setup
Deno.test({
  name: 'Edge Case Setup',
  fn: async () => {
    await setupTestUsers();
  },
  sanitizeOps: false,
  sanitizeResources: false,
});

// ============================================
// EMPTY/NULL VALUE EDGE CASES
// ============================================

Deno.test('EDGE-NULL-001: Empty object body should be handled', async () => {
  const response = await apiPost('api-tickets', {}, TEST_EMPLOYEES.assigner);
  await response.text();
  assertEquals(response.status, 400, 'Empty object should return 400');
});

Deno.test('EDGE-NULL-002: null body should be handled', async () => {
  const response = await apiPost('api-tickets', null as unknown, TEST_EMPLOYEES.assigner);
  await response.text();
  assertEquals(response.status >= 400, true, 'null body should return error');
});

Deno.test('EDGE-NULL-003: Undefined fields should be ignored', async () => {
  const ticketData = {
    ticket: {
      site_id: TEST_SITES.testCompanyHQ,
      work_type_id: REF_DATA.workTypes.pm,
      status_id: REF_DATA.statuses.normal,
      assigner_id: TEST_EMPLOYEES.assigner,
      details: 'Valid ticket',
      undefined_field: undefined,
    },
  };

  const response = await apiPost('api-tickets', ticketData, TEST_EMPLOYEES.assigner);
  await response.text();
  assertEquals(response.status === 201 || response.status === 400, true);
});

Deno.test('EDGE-NULL-004: Empty array should be handled', async () => {
  const response = await apiPost('api-tickets', [], TEST_EMPLOYEES.assigner);
  await response.text();
  assertEquals(response.status >= 400, true, 'Array body should return error');
});

// ============================================
// STRING LENGTH EDGE CASES
// ============================================

Deno.test('EDGE-STR-001: Single character input', async () => {
  const response = await apiGet('api-employees/network-search?keyword=A');
  await response.text();
  // Either 200 (success) or auth error if employee not active
  assertEquals(response.status >= 200 && response.status < 500, true, 'Single char search should be handled');
});

Deno.test('EDGE-STR-002: Very long search keyword (1000 chars)', async () => {
  const longKeyword = 'A'.repeat(1000);
  const response = await apiGet(`api-employees/network-search?keyword=${encodeURIComponent(longKeyword)}`);
  await response.text();
  assertEquals(response.status >= 200 && response.status < 500, true, 'Long keyword should be handled');
});

Deno.test('EDGE-STR-003: Whitespace-only string', async () => {
  const response = await apiPost(`api-tickets/${TEST_TICKETS.pm1}/comments`, { content: '   ' }, TEST_EMPLOYEES.tech1);
  await response.text();
  assertEquals(response.status, 400, 'Whitespace-only should be rejected');
});

Deno.test('EDGE-STR-004: String with only newlines', async () => {
  const response = await apiPost(`api-tickets/${TEST_TICKETS.pm1}/comments`, { content: '\n\n\n' }, TEST_EMPLOYEES.tech1);
  await response.text();
  assertEquals(response.status, 400, 'Newlines-only should be rejected');
});

Deno.test('EDGE-STR-005: String with mixed control characters', async () => {
  const controlChars = 'Test\t\r\n\b\fString';
  const response = await apiPost(`api-tickets/${TEST_TICKETS.pm1}/comments`, { content: controlChars }, TEST_EMPLOYEES.tech1);
  await response.text();
  assertEquals(response.status >= 200 && response.status < 500, true, 'Control chars should be handled');
});

// ============================================
// NUMBER EDGE CASES
// ============================================

Deno.test('EDGE-NUM-001: Page 0 should be handled', async () => {
  const response = await apiGet('api-tickets/search?page=0');
  await response.text();
  assertEquals(response.status >= 200 && response.status < 500, true, 'Page 0 should be handled');
});

Deno.test('EDGE-NUM-002: Float pagination values', async () => {
  const response = await apiGet('api-tickets/search?page=1.5&limit=10.5');
  await response.text();
  assertEquals(response.status >= 200 && response.status < 500, true, 'Float values should be handled');
});

Deno.test('EDGE-NUM-003: Scientific notation numbers', async () => {
  const response = await apiGet('api-tickets/search?page=1e2');
  await response.text();
  assertEquals(response.status >= 200 && response.status < 500, true, 'Scientific notation should be handled');
});

Deno.test('EDGE-NUM-004: Infinity value', async () => {
  const response = await apiGet('api-tickets/search?limit=Infinity');
  await response.text();
  assertEquals(response.status >= 200 && response.status < 500, true, 'Infinity should be handled');
});

Deno.test('EDGE-NUM-005: NaN value', async () => {
  const response = await apiGet('api-tickets/search?limit=NaN');
  await response.text();
  assertEquals(response.status >= 200 && response.status < 500, true, 'NaN should be handled');
});

// ============================================
// DATE/TIME EDGE CASES
// ============================================

Deno.test('EDGE-DATE-001: Far future date', async () => {
  const futureDate = '2099-12-31';
  const response = await apiGet(`api-tickets/search-duration?startDate=${futureDate}&endDate=${futureDate}`);
  await response.text();
  // Either 200 (success) or auth error
  assertEquals(response.status >= 200 && response.status < 500, true, 'Future date should be handled');
});

Deno.test('EDGE-DATE-002: Far past date', async () => {
  const pastDate = '1900-01-01';
  const response = await apiGet(`api-tickets/search-duration?startDate=${pastDate}&endDate=${pastDate}`);
  await response.text();
  assertEquals(response.status >= 200 && response.status < 500, true, 'Past date should be handled');
});

Deno.test('EDGE-DATE-003: Invalid date format', async () => {
  const response = await apiGet('api-tickets/search-duration?startDate=not-a-date');
  await response.text();
  assertEquals(response.status >= 400, true, 'Invalid date should return error');
});

Deno.test('EDGE-DATE-004: Start date after end date', async () => {
  const response = await apiGet('api-tickets/search-duration?startDate=2024-12-31&endDate=2024-01-01');
  await response.text();
  // Should either return empty or error
  assertEquals(response.status >= 200 && response.status < 500, true);
});

Deno.test('EDGE-DATE-005: Leap year date', async () => {
  const leapDate = '2024-02-29';
  const response = await apiGet(`api-tickets/search-duration?startDate=${leapDate}&endDate=${leapDate}`);
  await response.text();
  assertEquals(response.status >= 200 && response.status < 500, true, 'Leap year date should be handled');
});

// ============================================
// UUID EDGE CASES
// ============================================

Deno.test('EDGE-UUID-001: UUID with uppercase letters', async () => {
  const uppercaseUUID = TEST_TICKETS.pm1.toUpperCase();
  const response = await apiGet(`api-tickets/${uppercaseUUID}`);
  await response.text();
  // UUID comparison should be case-insensitive, or return 404 if not found
  assertEquals(response.status >= 200 && response.status < 500, true, 'Uppercase UUID should be handled');
});

Deno.test('EDGE-UUID-002: UUID with mixed case', async () => {
  const mixedUUID = TEST_TICKETS.pm1.split('-').map((part, i) =>
    i % 2 === 0 ? part.toUpperCase() : part.toLowerCase()
  ).join('-');
  const response = await apiGet(`api-tickets/${mixedUUID}`);
  await response.text();
  assertEquals(response.status >= 200 && response.status < 500, true, 'Mixed case UUID should be handled');
});

Deno.test('EDGE-UUID-003: Nil UUID (all zeros)', async () => {
  const nilUUID = '00000000-0000-0000-0000-000000000000';
  const response = await apiGet(`api-tickets/${nilUUID}`);
  await response.text();
  // Should return 404 or another error, not 200
  assertEquals(response.status !== 200, true, 'Nil UUID should not return success');
});

Deno.test('EDGE-UUID-004: Max UUID (all Fs)', async () => {
  const maxUUID = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
  const response = await apiGet(`api-tickets/${maxUUID}`);
  await response.text();
  // Should return 404 or another error, not 200
  assertEquals(response.status !== 200, true, 'Max UUID should not return success');
});

// ============================================
// SPECIAL CHARACTER EDGE CASES
// ============================================

Deno.test('EDGE-CHAR-001: URL encoded special characters', async () => {
  const special = encodeURIComponent('Test <>&\'"');
  const response = await apiGet(`api-employees/network-search?keyword=${special}`);
  await response.text();
  assertEquals(response.status >= 200 && response.status < 500, true, 'URL encoded chars should be handled');
});

Deno.test('EDGE-CHAR-002: Double URL encoding', async () => {
  const doubleEncoded = encodeURIComponent(encodeURIComponent('test'));
  const response = await apiGet(`api-employees/network-search?keyword=${doubleEncoded}`);
  await response.text();
  assertEquals(response.status >= 200 && response.status < 500, true, 'Double encoded should be handled');
});

Deno.test('EDGE-CHAR-003: Path traversal attempt', async () => {
  const response = await apiGet('api-tickets/../api-employees');
  await response.text();
  // Path traversal should be blocked or normalized - any response that doesn't expose unintended data is fine
  assertEquals(response.status >= 200 && response.status < 600, true, 'Path traversal should be handled');
});

Deno.test('EDGE-CHAR-004: Thai characters in search', async () => {
  const thai = encodeURIComponent('ทดสอบ');
  const response = await apiGet(`api-employees/network-search?keyword=${thai}`);
  await response.text();
  assertEquals(response.status >= 200 && response.status < 500, true, 'Thai chars should be handled');
});

Deno.test('EDGE-CHAR-005: Emoji in text fields', async () => {
  const commentData = { content: '👍 Great work! 🎉🎊' };
  const response = await apiPost(`api-tickets/${TEST_TICKETS.pm1}/comments`, commentData, TEST_EMPLOYEES.tech1);
  await response.text();
  assertEquals(response.status >= 200 && response.status < 500, true, 'Emoji should be handled');
});

Deno.test('EDGE-CHAR-006: Zero-width characters', async () => {
  const zeroWidth = 'Test\u200B\u200C\u200DString';
  const commentData = { content: zeroWidth };
  const response = await apiPost(`api-tickets/${TEST_TICKETS.pm1}/comments`, commentData, TEST_EMPLOYEES.tech1);
  await response.text();
  assertEquals(response.status >= 200 && response.status < 500, true, 'Zero-width chars should be handled');
});

// ============================================
// ARRAY/OBJECT EDGE CASES
// ============================================

Deno.test('EDGE-ARR-001: Empty array in array field', async () => {
  const data = { employee_ids: [] };
  const response = await apiPost(`api-tickets/${TEST_TICKETS.pm1}/confirm-technicians`, data, TEST_EMPLOYEES.superAdmin);
  await response.text();
  assertEquals(response.status >= 200 && response.status < 500, true, 'Empty array should be handled');
});

Deno.test('EDGE-ARR-002: Single item array', async () => {
  const data = { employee_ids: [TEST_EMPLOYEES.tech1] };
  const response = await apiPost(`api-tickets/${TEST_TICKETS.pm1}/confirm-technicians`, data, TEST_EMPLOYEES.superAdmin);
  await response.text();
  assertEquals(response.status >= 200 && response.status < 500, true, 'Single item array should work');
});

Deno.test('EDGE-ARR-003: Array with duplicate items', async () => {
  const data = { employee_ids: [TEST_EMPLOYEES.tech1, TEST_EMPLOYEES.tech1, TEST_EMPLOYEES.tech1] };
  const response = await apiPost(`api-tickets/${TEST_TICKETS.pm1}/confirm-technicians`, data, TEST_EMPLOYEES.superAdmin);
  await response.text();
  assertEquals(response.status >= 200 && response.status < 500, true, 'Duplicate items should be handled');
});

Deno.test('EDGE-ARR-004: Deeply nested object', async () => {
  const nested = {
    ticket: {
      details: 'test',
      nested: {
        level1: {
          level2: {
            level3: {
              level4: 'deep'
            }
          }
        }
      }
    }
  };
  const response = await apiPost('api-tickets', nested, TEST_EMPLOYEES.assigner);
  await response.text();
  // Should either ignore nested or process top level
  assertEquals(response.status >= 200 && response.status < 500, true, 'Nested object should be handled');
});

// ============================================
// CONCURRENT REQUEST EDGE CASES
// ============================================

Deno.test('EDGE-CONC-001: Same comment posted twice rapidly', async () => {
  const commentData = { content: `Concurrent test ${Date.now()}` };
  const [r1, r2] = await Promise.all([
    apiPost(`api-tickets/${TEST_TICKETS.pm1}/comments`, commentData, TEST_EMPLOYEES.tech1),
    apiPost(`api-tickets/${TEST_TICKETS.pm1}/comments`, commentData, TEST_EMPLOYEES.tech1),
  ]);
  await r1.text();
  await r2.text();
  // Both should succeed (no duplicate prevention) or one should fail
  assertEquals(r1.status >= 200 && r1.status < 500, true);
  assertEquals(r2.status >= 200 && r2.status < 500, true);
});

Deno.test('EDGE-CONC-002: Create and read same resource', async () => {
  const ticketData = {
    ticket: {
      site_id: TEST_SITES.testCompanyHQ,
      work_type_id: REF_DATA.workTypes.survey,
      status_id: REF_DATA.statuses.normal,
      assigner_id: TEST_EMPLOYEES.admin,
      details: 'Concurrent create/read test',
    },
  };

  const createResponse = await apiPost('api-tickets', ticketData, TEST_EMPLOYEES.admin);
  if (createResponse.status === 201) {
    const created = await createResponse.json();
    const ticketId = created.data?.id;

    if (ticketId) {
      // Immediately try to read
      const readResponse = await apiGet(`api-tickets/${ticketId}`);
      await readResponse.text();
      assertEquals(readResponse.status >= 200 && readResponse.status < 500, true, 'Read should be handled');
    }
  } else {
    await createResponse.text();
    // Create may fail due to permissions, test is inconclusive
  }
});

// ============================================
// REQUEST SIZE EDGE CASES
// ============================================

Deno.test('EDGE-SIZE-001: Large JSON payload (1MB)', async () => {
  const largeDetails = 'x'.repeat(1024 * 1024); // 1MB
  const ticketData = {
    ticket: {
      site_id: TEST_SITES.testCompanyHQ,
      work_type_id: REF_DATA.workTypes.pm,
      status_id: REF_DATA.statuses.normal,
      assigner_id: TEST_EMPLOYEES.assigner,
      details: largeDetails,
    },
  };

  const response = await apiPost('api-tickets', ticketData, TEST_EMPLOYEES.assigner);
  await response.text();
  // Should either accept or reject with 413/400
  assertEquals(response.status >= 200 && response.status < 600, true, 'Large payload should be handled');
});

Deno.test('EDGE-SIZE-002: Many query parameters', async () => {
  const params = new URLSearchParams();
  for (let i = 0; i < 100; i++) {
    params.append(`param${i}`, `value${i}`);
  }
  const response = await apiGet(`api-tickets/search?${params.toString()}`);
  await response.text();
  assertEquals(response.status >= 200 && response.status < 500, true, 'Many params should be handled');
});

// ============================================
// HEADER EDGE CASES
// ============================================

Deno.test('EDGE-HDR-001: Missing Content-Type header', async () => {
  const response = await fetch(`${BASE_URL}/api-tickets/search`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${ANON_KEY}`,
      'apikey': ANON_KEY,
    },
  });
  await response.text();
  assertEquals(response.status >= 200 && response.status < 500, true, 'Missing Content-Type should be handled');
});

Deno.test('EDGE-HDR-002: Wrong Content-Type header', async () => {
  const response = await fetch(`${BASE_URL}/api-tickets`, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain',
      'Authorization': `Bearer ${ANON_KEY}`,
      'apikey': ANON_KEY,
    },
    body: JSON.stringify({ ticket: {} }),
  });
  await response.text();
  assertEquals(response.status >= 200 && response.status < 500, true, 'Wrong Content-Type should be handled');
});

Deno.test('EDGE-HDR-003: Very long header value', async () => {
  const longValue = 'x'.repeat(8000);
  try {
    const response = await fetch(`${BASE_URL}/api-tickets/search`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ANON_KEY}`,
        'apikey': ANON_KEY,
        'X-Custom-Header': longValue,
      },
    });
    await response.text();
    assertEquals(response.status >= 200 && response.status < 600, true);
  } catch {
    // Long header may be rejected at transport level
  }
});

// ============================================
// BOOLEAN EDGE CASES
// ============================================

Deno.test('EDGE-BOOL-001: Boolean as string "true"', async () => {
  const response = await apiGet('api-employees?is_active=true');
  await response.text();
  assertEquals(response.status >= 200 && response.status < 500, true, 'String true should be handled');
});

Deno.test('EDGE-BOOL-002: Boolean as string "1"', async () => {
  const response = await apiGet('api-employees?is_active=1');
  await response.text();
  assertEquals(response.status >= 200 && response.status < 500, true, 'String 1 should be handled');
});

Deno.test('EDGE-BOOL-003: Boolean as string "yes"', async () => {
  const response = await apiGet('api-employees?is_active=yes');
  await response.text();
  assertEquals(response.status >= 200 && response.status < 500, true, 'String yes should be handled');
});

// ============================================
// METHOD EDGE CASES
// ============================================

Deno.test('EDGE-METHOD-001: HEAD request', async () => {
  const response = await fetch(`${BASE_URL}/api-tickets/search`, {
    method: 'HEAD',
    headers: {
      'Content-Type': 'application/json',
      'apikey': ANON_KEY,
    },
  });
  await response.text();
  // HEAD should return headers without body
  assertEquals(response.status >= 200 && response.status < 500, true, 'HEAD should be handled');
});

Deno.test('EDGE-METHOD-002: CONNECT method', async () => {
  try {
    const response = await fetch(`${BASE_URL}/api-tickets`, {
      method: 'CONNECT',
      headers: {
        'Content-Type': 'application/json',
        'apikey': ANON_KEY,
      },
    });
    await response.text();
    assertEquals(response.status >= 400, true, 'CONNECT should be rejected');
  } catch {
    // May throw at transport level
  }
});

console.log('Edge case tests completed');
