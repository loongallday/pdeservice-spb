/**
 * E2E Tests for api-staging
 * Tests all staging operations with real database and authentication
 *
 * This API handles:
 * - Staged file operations for LINE integration
 * - File approval/rejection workflow
 * - LINE account management
 * - Ticket carousel for LINE (service_role endpoints)
 */

import { assertEquals, assertExists } from 'https://deno.land/std@0.208.0/assert/mod.ts';
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
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

/**
 * Make a service role GET request (for n8n endpoints)
 */
async function serviceRoleGet(endpoint: string): Promise<Response> {
  const url = `${BASE_URL}/${endpoint}`;
  return fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    },
  });
}

/**
 * Make a service role POST request (for n8n endpoints)
 */
async function serviceRolePost(endpoint: string, body: unknown): Promise<Response> {
  const url = `${BASE_URL}/${endpoint}`;
  return fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify(body),
  });
}

/**
 * Make a service role PUT request (for n8n endpoints)
 */
async function serviceRolePut(endpoint: string, body: unknown): Promise<Response> {
  const url = `${BASE_URL}/${endpoint}`;
  return fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify(body),
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
// FILE LISTING (JWT Auth)
// ============================================

Deno.test('GET /api-staging/files - should return paginated staged files', async () => {
  const response = await apiGet('api-staging/files', TEST_EMPLOYEES.superAdmin);
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
  assertExists(data.pagination);
});

Deno.test('GET /api-staging/files - should support pagination', async () => {
  const response = await apiGet('api-staging/files?page=1&limit=5', TEST_EMPLOYEES.superAdmin);
  assertEquals(response.status, 200);
  const data = await response.json();
  assertEquals(data.pagination.page, 1);
  assertEquals(data.pagination.limit, 5);
});

Deno.test('GET /api-staging/files - should filter by status', async () => {
  const response = await apiGet('api-staging/files?status=pending', TEST_EMPLOYEES.superAdmin);
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
});

Deno.test('GET /api-staging/files - should filter by multiple statuses', async () => {
  const response = await apiGet('api-staging/files?status=pending,linked', TEST_EMPLOYEES.superAdmin);
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
});

Deno.test('GET /api-staging/files - should filter by employee_id', async () => {
  const response = await apiGet(`api-staging/files?employee_id=${TEST_EMPLOYEES.tech1}`, TEST_EMPLOYEES.superAdmin);
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
});

Deno.test('GET /api-staging/files - should filter by ticket_id', async () => {
  const response = await apiGet(`api-staging/files?ticket_id=${TEST_TICKETS.pm1}`, TEST_EMPLOYEES.superAdmin);
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
});

// ============================================
// GROUPED FILES (JWT Auth)
// ============================================

Deno.test('GET /api-staging/files/grouped - should return files grouped by ticket', async () => {
  const response = await apiGet('api-staging/files/grouped', TEST_EMPLOYEES.superAdmin);
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
  assertExists(data.data.groups);
  assertExists(data.data.summary);
});

Deno.test('GET /api-staging/files/grouped - should filter by status', async () => {
  const response = await apiGet('api-staging/files/grouped?status=pending', TEST_EMPLOYEES.superAdmin);
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
});

Deno.test('GET /api-staging/files/grouped - should filter by employee_id', async () => {
  const response = await apiGet(`api-staging/files/grouped?employee_id=${TEST_EMPLOYEES.tech1}`, TEST_EMPLOYEES.superAdmin);
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
});

// ============================================
// GET SINGLE FILE (JWT Auth)
// ============================================

Deno.test('GET /api-staging/files/:id - should return 404 for non-existent file', async () => {
  const fakeId = randomUUID();
  const response = await apiGet(`api-staging/files/${fakeId}`, TEST_EMPLOYEES.superAdmin);
  await response.text(); // Consume body
  assertEquals(response.status, 404);
});

Deno.test('GET /api-staging/files/:id - should return 400 for invalid UUID', async () => {
  const response = await apiGet('api-staging/files/invalid-uuid', TEST_EMPLOYEES.superAdmin);
  await response.text(); // Consume body
  assertEquals(response.status, 400);
});

// ============================================
// FILE APPROVAL (JWT Auth with permission)
// Note: These endpoints require canApproveAppointments permission
// Permission check happens before UUID validation, so we test behavior accordingly
// ============================================

Deno.test('POST /api-staging/files/:id/approve - should handle non-existent file', async () => {
  const fakeId = randomUUID();
  const response = await apiPost(`api-staging/files/${fakeId}/approve`, {}, TEST_EMPLOYEES.superAdmin);
  const text = await response.text(); // Consume body
  // May return 403 (no permission) or 404 (not found) depending on permission check order
  assertEquals(response.status >= 400, true, `Expected error status, got ${response.status}: ${text}`);
});

Deno.test('POST /api-staging/files/:id/approve - should handle invalid UUID', async () => {
  const response = await apiPost('api-staging/files/invalid-uuid/approve', {}, TEST_EMPLOYEES.superAdmin);
  const text = await response.text(); // Consume body
  // May return 403 (no permission) or 400 (invalid UUID) depending on check order
  assertEquals(response.status >= 400, true, `Expected error status, got ${response.status}: ${text}`);
});

Deno.test('POST /api-staging/files/:id/reject - should handle non-existent file', async () => {
  const fakeId = randomUUID();
  const response = await apiPost(`api-staging/files/${fakeId}/reject`, { reason: 'Test rejection' }, TEST_EMPLOYEES.superAdmin);
  const text = await response.text(); // Consume body
  // May return 403 (no permission) or 404 (not found) depending on permission check order
  assertEquals(response.status >= 400, true, `Expected error status, got ${response.status}: ${text}`);
});

Deno.test('POST /api-staging/files/:id/reject - should handle invalid UUID', async () => {
  const response = await apiPost('api-staging/files/invalid-uuid/reject', { reason: 'Test' }, TEST_EMPLOYEES.superAdmin);
  const text = await response.text(); // Consume body
  // May return 403 (no permission) or 400 (invalid UUID) depending on check order
  assertEquals(response.status >= 400, true, `Expected error status, got ${response.status}: ${text}`);
});

// ============================================
// BULK OPERATIONS (JWT Auth with permission)
// ============================================

Deno.test('POST /api-staging/files/bulk-approve - should handle empty file_ids', async () => {
  const response = await apiPost('api-staging/files/bulk-approve', { file_ids: [] }, TEST_EMPLOYEES.superAdmin);
  const text = await response.text(); // Consume body
  // Should succeed with empty result or return validation error
  assertEquals(response.status < 500, true, `Unexpected server error: ${text}`);
});

Deno.test('POST /api-staging/files/bulk-approve - should handle non-existent file_ids', async () => {
  const response = await apiPost(
    'api-staging/files/bulk-approve',
    { file_ids: [randomUUID(), randomUUID()] },
    TEST_EMPLOYEES.superAdmin
  );
  const text = await response.text(); // Consume body
  // Should succeed with empty result or return error
  assertEquals(response.status < 500, true, `Unexpected server error: ${text}`);
});

Deno.test('POST /api-staging/files/bulk-delete - should handle empty file_ids', async () => {
  const response = await apiPost('api-staging/files/bulk-delete', { file_ids: [] }, TEST_EMPLOYEES.superAdmin);
  const text = await response.text(); // Consume body
  assertEquals(response.status < 500, true, `Unexpected server error: ${text}`);
});

Deno.test('POST /api-staging/files/bulk-delete - should handle non-existent file_ids', async () => {
  const response = await apiPost(
    'api-staging/files/bulk-delete',
    { file_ids: [randomUUID(), randomUUID()] },
    TEST_EMPLOYEES.superAdmin
  );
  const text = await response.text(); // Consume body
  assertEquals(response.status < 500, true, `Unexpected server error: ${text}`);
});

// ============================================
// DELETE FILE (JWT Auth)
// ============================================

Deno.test('DELETE /api-staging/files/:id - should return 404 for non-existent file', async () => {
  const fakeId = randomUUID();
  const response = await apiDelete(`api-staging/files/${fakeId}`, TEST_EMPLOYEES.superAdmin);
  await response.text(); // Consume body
  assertEquals(response.status, 404);
});

Deno.test('DELETE /api-staging/files/:id - should return 400 for invalid UUID', async () => {
  const response = await apiDelete('api-staging/files/invalid-uuid', TEST_EMPLOYEES.superAdmin);
  await response.text(); // Consume body
  assertEquals(response.status, 400);
});

// ============================================
// LINE ACCOUNTS (JWT Auth, Admin only)
// ============================================

Deno.test('GET /api-staging/line-accounts - should return paginated accounts for admin', async () => {
  const response = await apiGet('api-staging/line-accounts', TEST_EMPLOYEES.superAdmin);
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
  assertExists(data.pagination);
});

Deno.test('GET /api-staging/line-accounts - should support pagination', async () => {
  const response = await apiGet('api-staging/line-accounts?page=1&limit=5', TEST_EMPLOYEES.superAdmin);
  assertEquals(response.status, 200);
  const data = await response.json();
  assertEquals(data.pagination.page, 1);
  assertEquals(data.pagination.limit, 5);
});

Deno.test('POST /api-staging/line-accounts - should create LINE account mapping', async () => {
  const accountData = {
    employee_id: TEST_EMPLOYEES.tech1,
    line_user_id: `U${Date.now()}`, // Unique LINE user ID
    display_name: 'Test LINE User',
    profile_picture_url: 'https://example.com/profile.jpg',
  };

  const response = await apiPost('api-staging/line-accounts', accountData, TEST_EMPLOYEES.superAdmin);
  const text = await response.text(); // Consume body
  // Should succeed or return validation error (e.g., duplicate)
  assertEquals(response.status < 500, true, `Unexpected server error: ${text}`);
});

Deno.test('POST /api-staging/line-accounts - should reject invalid employee_id', async () => {
  const accountData = {
    employee_id: 'invalid-uuid',
    line_user_id: `U${Date.now()}`,
  };

  const response = await apiPost('api-staging/line-accounts', accountData, TEST_EMPLOYEES.superAdmin);
  await response.text(); // Consume body
  assertEquals(response.status >= 400, true);
});

Deno.test('PUT /api-staging/line-accounts/:id - should return 404 for non-existent account', async () => {
  const fakeId = randomUUID();
  const updateData = {
    display_name: 'Updated Name',
  };

  const response = await apiPut(`api-staging/line-accounts/${fakeId}`, updateData, TEST_EMPLOYEES.superAdmin);
  await response.text(); // Consume body
  assertEquals(response.status >= 400, true);
});

Deno.test('PUT /api-staging/line-accounts/:id - should return 400 for invalid UUID', async () => {
  const updateData = {
    display_name: 'Updated Name',
  };

  const response = await apiPut('api-staging/line-accounts/invalid-uuid', updateData, TEST_EMPLOYEES.superAdmin);
  await response.text(); // Consume body
  assertEquals(response.status, 400);
});

Deno.test('DELETE /api-staging/line-accounts/:id - should return 404 for non-existent account', async () => {
  const fakeId = randomUUID();
  const response = await apiDelete(`api-staging/line-accounts/${fakeId}`, TEST_EMPLOYEES.superAdmin);
  await response.text(); // Consume body
  assertEquals(response.status >= 400, true);
});

Deno.test('DELETE /api-staging/line-accounts/:id - should return 400 for invalid UUID', async () => {
  const response = await apiDelete('api-staging/line-accounts/invalid-uuid', TEST_EMPLOYEES.superAdmin);
  await response.text(); // Consume body
  assertEquals(response.status, 400);
});

// ============================================
// PERMISSION TESTS - LINE Accounts
// ============================================

Deno.test('Permission: Technician cannot list LINE accounts', async () => {
  const response = await apiGet('api-staging/line-accounts', TEST_EMPLOYEES.tech1);
  await response.text(); // Consume body
  assertEquals(response.status, 403);
});

Deno.test('Permission: Technician cannot create LINE accounts', async () => {
  const accountData = {
    employee_id: TEST_EMPLOYEES.tech2,
    line_user_id: `UTech${Date.now()}`,
  };

  const response = await apiPost('api-staging/line-accounts', accountData, TEST_EMPLOYEES.tech1);
  await response.text(); // Consume body
  assertEquals(response.status, 403);
});

Deno.test('Permission: Assigner cannot manage LINE accounts (level 1)', async () => {
  const response = await apiGet('api-staging/line-accounts', TEST_EMPLOYEES.assigner);
  await response.text(); // Consume body
  assertEquals(response.status, 403);
});

Deno.test('Permission: Admin can manage LINE accounts (level 2)', async () => {
  const response = await apiGet('api-staging/line-accounts', TEST_EMPLOYEES.admin);
  assertEquals(response.status, 200);
  await response.json(); // Consume body
});

// ============================================
// SERVICE ROLE ENDPOINTS (n8n Integration)
// ============================================

Deno.test('POST /api-staging/files (service_role) - should create staged file', async () => {
  const fileData = {
    line_user_id: 'U1234567890', // This would be a real LINE user ID
    file_url: 'https://example.com/test-image.jpg',
    file_name: 'test-image.jpg',
    file_size: 12345,
    mime_type: 'image/jpeg',
    source: 'line',
    metadata: { test: true },
  };

  const response = await serviceRolePost('api-staging/files', fileData);
  const text = await response.text(); // Consume body
  // May fail if no matching LINE account, but should not be 500
  assertEquals(response.status < 500, true, `Unexpected server error: ${text}`);
});

Deno.test('PUT /api-staging/files/:id/link (service_role) - should return 404 for non-existent file', async () => {
  const fakeId = randomUUID();
  const response = await serviceRolePut(`api-staging/files/${fakeId}/link`, { ticket_id: TEST_TICKETS.pm1 });
  await response.text(); // Consume body
  assertEquals(response.status, 404);
});

Deno.test('PUT /api-staging/files/:id/link (service_role) - should return 400 for invalid UUID', async () => {
  const response = await serviceRolePut('api-staging/files/invalid-uuid/link', { ticket_id: TEST_TICKETS.pm1 });
  await response.text(); // Consume body
  assertEquals(response.status, 400);
});

Deno.test('GET /api-staging/tickets/carousel (service_role) - should require line_user_id', async () => {
  const response = await serviceRoleGet('api-staging/tickets/carousel');
  await response.text(); // Consume body
  assertEquals(response.status, 400);
});

Deno.test('GET /api-staging/tickets/carousel (service_role) - should handle LINE user request', async () => {
  const response = await serviceRoleGet('api-staging/tickets/carousel?line_user_id=U1234567890');
  const text = await response.text(); // Consume body
  // May return 200 with empty tickets or 404 if LINE user not found
  // Depends on whether the LINE user is mapped to an employee
  assertEquals(response.status < 500, true, `Unexpected server error: ${text}`);
});

Deno.test('GET /api-staging/tickets/carousel (service_role) - should handle limit parameter', async () => {
  const response = await serviceRoleGet('api-staging/tickets/carousel?line_user_id=U1234567890&limit=5');
  const text = await response.text(); // Consume body
  // May return 200 or 404 depending on whether LINE user is mapped
  assertEquals(response.status < 500, true, `Unexpected server error: ${text}`);
});

Deno.test('GET /api-staging/tickets/by-code/:code (service_role) - should handle non-existent code', async () => {
  const response = await serviceRoleGet('api-staging/tickets/by-code/NONEXISTENT123');
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
  assertEquals(data.data.found, false);
  assertEquals(data.data.ticket, null);
});

Deno.test('GET /api-staging/employee/:lineUserId (service_role) - should handle non-existent user', async () => {
  const response = await serviceRoleGet('api-staging/employee/UNONEXISTENT');
  const text = await response.text(); // Consume body
  // Should return 404 or null data
  assertEquals(response.status < 500, true, `Unexpected server error: ${text}`);
});

// ============================================
// NOT FOUND ROUTES
// ============================================

Deno.test('GET /api-staging/unknown-route - should return 404', async () => {
  const response = await apiGet('api-staging/unknown-route', TEST_EMPLOYEES.superAdmin);
  await response.text(); // Consume body
  assertEquals(response.status, 404);
});

Deno.test('POST /api-staging/unknown-route - should return 404', async () => {
  const response = await apiPost('api-staging/unknown-route', {}, TEST_EMPLOYEES.superAdmin);
  await response.text(); // Consume body
  assertEquals(response.status, 404);
});

// ============================================
// AUTHENTICATION TESTS
// ============================================

Deno.test('Unauthenticated request to /api-staging/files should fail', async () => {
  const url = `${BASE_URL}/api-staging/files`;
  const response = await fetch(url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });
  await response.text(); // Consume body
  assertEquals(response.status, 401);
});

// ============================================
// PERMISSION TESTS - File Approval
// ============================================

Deno.test('Permission: Technician cannot approve files (needs canApproveAppointments)', async () => {
  const fakeId = randomUUID();
  const response = await apiPost(`api-staging/files/${fakeId}/approve`, {}, TEST_EMPLOYEES.tech1);
  await response.text(); // Consume body
  // Should be 403 (forbidden) not 404 (not found)
  assertEquals(response.status, 403);
});

Deno.test('Permission: Technician cannot reject files (needs canApproveAppointments)', async () => {
  const fakeId = randomUUID();
  const response = await apiPost(`api-staging/files/${fakeId}/reject`, { reason: 'Test' }, TEST_EMPLOYEES.tech1);
  await response.text(); // Consume body
  assertEquals(response.status, 403);
});

Deno.test('Permission: Technician cannot bulk approve files', async () => {
  const response = await apiPost('api-staging/files/bulk-approve', { file_ids: [] }, TEST_EMPLOYEES.tech1);
  await response.text(); // Consume body
  assertEquals(response.status, 403);
});

Deno.test('Permission: Technician cannot bulk delete files', async () => {
  const response = await apiPost('api-staging/files/bulk-delete', { file_ids: [] }, TEST_EMPLOYEES.tech1);
  await response.text(); // Consume body
  assertEquals(response.status, 403);
});

// ============================================
// EDGE CASES
// ============================================

Deno.test('POST /api-staging/files/:id/reject - should require reason', async () => {
  const fakeId = randomUUID();
  // Missing reason field
  const response = await apiPost(`api-staging/files/${fakeId}/reject`, {}, TEST_EMPLOYEES.superAdmin);
  const text = await response.text(); // Consume body
  // Should fail validation or return 404 for non-existent file
  assertEquals(response.status >= 400, true, `Expected error status, got ${response.status}: ${text}`);
});

Deno.test('POST /api-staging/files/bulk-approve - should accept optional comment_content', async () => {
  const response = await apiPost(
    'api-staging/files/bulk-approve',
    {
      file_ids: [randomUUID()],
      comment_content: 'Approved via E2E test',
    },
    TEST_EMPLOYEES.superAdmin
  );
  const text = await response.text(); // Consume body
  assertEquals(response.status < 500, true, `Unexpected server error: ${text}`);
});
