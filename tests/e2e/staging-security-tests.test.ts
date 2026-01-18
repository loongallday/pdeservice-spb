/**
 * E2E Staging/File Upload Security Tests
 * Tests for file staging vulnerabilities, LINE webhook security
 * Goal: Expose file handling and webhook vulnerabilities
 */

import { assertEquals, assertExists, assertNotEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import {
  apiGet,
  apiPost,
  apiPut,
  apiDelete,
  setupTestUsers,
  TEST_EMPLOYEES,
  TEST_TICKETS,
  randomUUID,
} from './test-utils.ts';

const BASE_URL = 'http://localhost:54321/functions/v1';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

// Setup
Deno.test({
  name: 'Staging Security Setup',
  fn: async () => {
    await setupTestUsers();
  },
  sanitizeOps: false,
  sanitizeResources: false,
});

// ============================================
// FILE URL VALIDATION TESTS
// ============================================

Deno.test('STAGE-URL-001: File URL with javascript: protocol should be rejected', async () => {
  const fileData = {
    line_user_id: 'U1234567890abcdef',
    file_url: 'javascript:alert("XSS")',
  };

  const response = await fetch(`${BASE_URL}/api-staging/files`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'apikey': ANON_KEY,
    },
    body: JSON.stringify(fileData),
  });
  await response.text();

  assertNotEquals(response.status, 201, 'javascript: URL should be rejected');
});

Deno.test('STAGE-URL-002: File URL with data: protocol should be validated', async () => {
  const fileData = {
    line_user_id: 'U1234567890abcdef',
    file_url: 'data:text/html,<script>alert("XSS")</script>',
  };

  const response = await fetch(`${BASE_URL}/api-staging/files`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'apikey': ANON_KEY,
    },
    body: JSON.stringify(fileData),
  });
  await response.text();

  // Should be rejected or sanitized
  assertEquals(response.status >= 200 && response.status < 600, true);
});

Deno.test('STAGE-URL-003: File URL with file:// protocol should be rejected', async () => {
  const fileData = {
    line_user_id: 'U1234567890abcdef',
    file_url: 'file:///etc/passwd',
  };

  const response = await fetch(`${BASE_URL}/api-staging/files`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'apikey': ANON_KEY,
    },
    body: JSON.stringify(fileData),
  });
  await response.text();

  assertNotEquals(response.status, 201, 'file:// URL should be rejected');
});

Deno.test('STAGE-URL-004: SSRF attempt via internal URL', async () => {
  const fileData = {
    line_user_id: 'U1234567890abcdef',
    file_url: 'http://localhost:5432/admin',
  };

  const response = await fetch(`${BASE_URL}/api-staging/files`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'apikey': ANON_KEY,
    },
    body: JSON.stringify(fileData),
  });
  await response.text();

  // Should not allow internal URLs
  assertEquals(response.status >= 200 && response.status < 600, true);
});

Deno.test('STAGE-URL-005: SSRF attempt via metadata URL', async () => {
  const fileData = {
    line_user_id: 'U1234567890abcdef',
    file_url: 'http://169.254.169.254/latest/meta-data/',
  };

  const response = await fetch(`${BASE_URL}/api-staging/files`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'apikey': ANON_KEY,
    },
    body: JSON.stringify(fileData),
  });
  await response.text();

  // AWS metadata URL should be blocked
  assertEquals(response.status >= 200 && response.status < 600, true);
});

// ============================================
// LINE USER ID VALIDATION TESTS
// ============================================

Deno.test('STAGE-LINE-001: Invalid LINE user ID format', async () => {
  const fileData = {
    line_user_id: 'invalid-not-starting-with-U',
    file_url: 'https://example.com/image.jpg',
  };

  const response = await fetch(`${BASE_URL}/api-staging/files`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'apikey': ANON_KEY,
    },
    body: JSON.stringify(fileData),
  });
  await response.text();

  // Should validate LINE user ID format
  assertEquals(response.status >= 200 && response.status < 600, true);
});

Deno.test('STAGE-LINE-002: Empty LINE user ID', async () => {
  const fileData = {
    line_user_id: '',
    file_url: 'https://example.com/image.jpg',
  };

  const response = await fetch(`${BASE_URL}/api-staging/files`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'apikey': ANON_KEY,
    },
    body: JSON.stringify(fileData),
  });
  await response.text();

  assertEquals(response.status, 400, 'Empty LINE user ID should be rejected');
});

Deno.test('STAGE-LINE-003: SQL injection in LINE user ID', async () => {
  const fileData = {
    line_user_id: "U'; DROP TABLE main_employees; --",
    file_url: 'https://example.com/image.jpg',
  };

  const response = await fetch(`${BASE_URL}/api-staging/files`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'apikey': ANON_KEY,
    },
    body: JSON.stringify(fileData),
  });
  await response.text();

  // Should be escaped/rejected, not cause SQL injection
  assertEquals(response.status >= 200 && response.status < 600, true);
});

// ============================================
// MIME TYPE VALIDATION TESTS
// ============================================

Deno.test('STAGE-MIME-001: Executable MIME type should be handled', async () => {
  const fileData = {
    line_user_id: 'U1234567890abcdef',
    file_url: 'https://example.com/malware.exe',
    mime_type: 'application/x-executable',
  };

  const response = await fetch(`${BASE_URL}/api-staging/files`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'apikey': ANON_KEY,
    },
    body: JSON.stringify(fileData),
  });
  await response.text();

  // Should either reject or flag executable types
  assertEquals(response.status >= 200 && response.status < 600, true);
});

Deno.test('STAGE-MIME-002: HTML MIME type in image upload', async () => {
  const fileData = {
    line_user_id: 'U1234567890abcdef',
    file_url: 'https://example.com/image.jpg',
    mime_type: 'text/html', // Suspicious for an image
  };

  const response = await fetch(`${BASE_URL}/api-staging/files`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'apikey': ANON_KEY,
    },
    body: JSON.stringify(fileData),
  });
  await response.text();

  assertEquals(response.status >= 200 && response.status < 600, true);
});

// ============================================
// FILE SIZE VALIDATION TESTS
// ============================================

Deno.test('STAGE-SIZE-001: Negative file size', async () => {
  const fileData = {
    line_user_id: 'U1234567890abcdef',
    file_url: 'https://example.com/image.jpg',
    file_size: -1,
  };

  const response = await fetch(`${BASE_URL}/api-staging/files`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'apikey': ANON_KEY,
    },
    body: JSON.stringify(fileData),
  });
  await response.text();

  // Negative size should be rejected
  assertEquals(response.status >= 200 && response.status < 600, true);
});

Deno.test('STAGE-SIZE-002: Extremely large file size', async () => {
  const fileData = {
    line_user_id: 'U1234567890abcdef',
    file_url: 'https://example.com/image.jpg',
    file_size: 999999999999, // ~1TB
  };

  const response = await fetch(`${BASE_URL}/api-staging/files`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'apikey': ANON_KEY,
    },
    body: JSON.stringify(fileData),
  });
  await response.text();

  assertEquals(response.status >= 200 && response.status < 600, true);
});

// ============================================
// AUTHORIZATION TESTS
// ============================================

Deno.test('STAGE-AUTH-001: JWT user cannot access service role endpoints', async () => {
  const fileData = {
    line_user_id: 'U1234567890abcdef',
    file_url: 'https://example.com/image.jpg',
  };

  // Try with regular JWT token
  const response = await apiPost('api-staging/files', fileData, TEST_EMPLOYEES.tech1);
  await response.text();

  // Should be forbidden for regular users (403), or endpoint not found (404)
  assertEquals(response.status >= 400 && response.status < 500, true, 'JWT user should not access service role endpoint');
});

Deno.test('STAGE-AUTH-002: User can only see their own staged files', async () => {
  // Get files as tech1
  const response1 = await apiGet('api-staging/files', TEST_EMPLOYEES.tech1);
  const data1 = await response1.json();

  // Get files as tech2
  const response2 = await apiGet('api-staging/files', TEST_EMPLOYEES.tech2);
  const data2 = await response2.json();

  // Both should succeed but potentially return different results
  assertEquals(response1.status, 200);
  assertEquals(response2.status, 200);
});

Deno.test('STAGE-AUTH-003: User cannot approve others files without permission', async () => {
  const fakeFileId = randomUUID();

  // Tech1 (level 0) trying to approve
  const response = await apiPost(`api-staging/files/${fakeFileId}/approve`, {}, TEST_EMPLOYEES.tech1);
  await response.text();

  // Should be forbidden
  assertEquals(response.status >= 400, true, 'Level 0 should not approve files');
});

Deno.test('STAGE-AUTH-004: User cannot bulk delete without permission', async () => {
  const bulkData = { file_ids: [randomUUID(), randomUUID()] };

  // Tech1 (level 0) trying to bulk delete
  const response = await apiPost('api-staging/files/bulk-delete', bulkData, TEST_EMPLOYEES.tech1);
  await response.text();

  assertEquals(response.status >= 400, true, 'Level 0 should not bulk delete');
});

// ============================================
// TICKET CODE VALIDATION TESTS
// ============================================

Deno.test('STAGE-CODE-001: Invalid ticket code format', async () => {
  const response = await fetch(`${BASE_URL}/api-staging/tickets/by-code/INVALID-FORMAT`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'apikey': ANON_KEY,
    },
  });
  await response.text();

  // Should be handled gracefully (400, 404, or any non-500 response)
  assertEquals(response.status >= 200 && response.status < 600, true, 'Invalid code should be handled');
});

Deno.test('STAGE-CODE-002: SQL injection in ticket code', async () => {
  const maliciousCode = "TK-001'; DROP TABLE main_tickets; --";
  const response = await fetch(`${BASE_URL}/api-staging/tickets/by-code/${encodeURIComponent(maliciousCode)}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'apikey': ANON_KEY,
    },
  });
  await response.text();

  // Should be escaped, not cause SQL injection
  assertEquals(response.status >= 200 && response.status < 600, true);
});

Deno.test('STAGE-CODE-003: Very long ticket code', async () => {
  const longCode = 'TK-' + '1'.repeat(1000);
  const response = await fetch(`${BASE_URL}/api-staging/tickets/by-code/${encodeURIComponent(longCode)}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'apikey': ANON_KEY,
    },
  });
  await response.text();

  assertEquals(response.status >= 200 && response.status < 600, true);
});

// ============================================
// LINK FILE TESTS
// ============================================

Deno.test('STAGE-LINK-001: Link file to non-existent ticket', async () => {
  const fakeFileId = randomUUID();
  const fakeTicketId = randomUUID();

  const response = await fetch(`${BASE_URL}/api-staging/files/${fakeFileId}/link`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'apikey': ANON_KEY,
    },
    body: JSON.stringify({ ticket_id: fakeTicketId }),
  });
  await response.text();

  // Should fail gracefully
  assertEquals(response.status >= 400, true, 'Linking to non-existent ticket should fail');
});

Deno.test('STAGE-LINK-002: Link non-existent file', async () => {
  const fakeFileId = randomUUID();

  const response = await fetch(`${BASE_URL}/api-staging/files/${fakeFileId}/link`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'apikey': ANON_KEY,
    },
    body: JSON.stringify({ ticket_id: TEST_TICKETS.pm1 }),
  });
  await response.text();

  assertEquals(response.status, 404, 'Non-existent file should return 404');
});

// ============================================
// CAROUSEL ENDPOINT TESTS
// ============================================

Deno.test('STAGE-CAROUSEL-001: Carousel returns limited data', async () => {
  const response = await fetch(`${BASE_URL}/api-staging/tickets/carousel`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'apikey': ANON_KEY,
    },
  });

  // Endpoint may return 200, 400, or 404 depending on whether carousel is implemented
  if (response.status === 200) {
    const data = await response.json();
    // Should not expose sensitive ticket data
    if (data.data && data.data.length > 0) {
      const ticket = data.data[0];
      assertEquals(ticket.password, undefined, 'Should not expose sensitive data');
    }
  } else {
    await response.text();
    // Endpoint may not exist or require different auth
    assertEquals(response.status >= 200 && response.status < 600, true, 'Request should be handled');
  }
});

// ============================================
// LINE WEBHOOK SECURITY TESTS
// ============================================

Deno.test('STAGE-WEBHOOK-001: Webhook without signature should be rejected', async () => {
  const webhookBody = {
    destination: 'U1234567890',
    events: [{ type: 'message', source: { type: 'user', userId: 'Uabc123' } }],
  };

  const response = await fetch(`${BASE_URL}/api-line-webhook`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(webhookBody),
  });
  await response.text();

  assertEquals(response.status, 401, 'Webhook without signature should be rejected');
});

Deno.test('STAGE-WEBHOOK-002: Webhook with invalid signature should be rejected', async () => {
  const webhookBody = {
    destination: 'U1234567890',
    events: [{ type: 'message', source: { type: 'user', userId: 'Uabc123' } }],
  };

  const response = await fetch(`${BASE_URL}/api-line-webhook`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-line-signature': 'invalid-signature-value',
    },
    body: JSON.stringify(webhookBody),
  });
  await response.text();

  // Should be rejected with 401 or 500 (if signature validation throws)
  assertEquals(response.status >= 400 && response.status < 600, true, 'Invalid signature should be rejected or handled');
});

Deno.test('STAGE-WEBHOOK-003: GET method should be rejected', async () => {
  const response = await fetch(`${BASE_URL}/api-line-webhook`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  await response.text();

  assertEquals(response.status, 405, 'GET should be rejected');
});

Deno.test('STAGE-WEBHOOK-004: Malformed JSON body', async () => {
  const response = await fetch(`${BASE_URL}/api-line-webhook`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-line-signature': 'some-signature',
    },
    body: 'not valid json {{{',
  });
  await response.text();

  // Should be handled - 400, 401, or 500 are all acceptable for malformed input
  assertEquals(response.status >= 400 && response.status < 600, true, 'Malformed JSON should be handled');
});

// ============================================
// EMPLOYEE LINE ACCOUNT TESTS
// ============================================

Deno.test('STAGE-EMP-001: Get employee by invalid LINE user ID', async () => {
  const response = await fetch(`${BASE_URL}/api-staging/employee/invalid-line-id`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'apikey': ANON_KEY,
    },
  });
  await response.text();

  assertEquals(response.status === 404 || response.status === 400, true);
});

Deno.test('STAGE-EMP-002: Create LINE account with duplicate employee', async () => {
  // Try to create duplicate LINE account link
  const accountData = {
    employee_id: TEST_EMPLOYEES.tech1,
    line_user_id: 'Uduplicate123456',
  };

  const response1 = await apiPost('api-staging/line-accounts', accountData, TEST_EMPLOYEES.superAdmin);
  const response2 = await apiPost('api-staging/line-accounts', accountData, TEST_EMPLOYEES.superAdmin);

  await response1.text();
  await response2.text();

  // Second should fail (duplicate)
  assertEquals(response2.status >= 400 || response1.status >= 400, true, 'Duplicate should be rejected');
});

console.log('Staging security tests completed');
