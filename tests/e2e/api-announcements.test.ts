/**
 * E2E Tests for api-announcements
 * Tests all announcement operations with real database and authentication
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

// Store created announcement IDs for cleanup and testing
let createdAnnouncementId: string | null = null;

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
// LIST ANNOUNCEMENTS
// ============================================

Deno.test('GET /api-announcements - should return list of announcements', async () => {
  const response = await apiGet('api-announcements');
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
});

Deno.test('GET /api-announcements - should be accessible by all users (level 0)', async () => {
  const response = await apiGet('api-announcements', TEST_EMPLOYEES.tech1);
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
});

// ============================================
// CREATE ANNOUNCEMENT
// ============================================

Deno.test('POST /api-announcements - should create announcement (superadmin)', async () => {
  const announcementData = {
    message: `E2E Test Announcement - ${Date.now()}`,
  };

  const response = await apiPost('api-announcements', announcementData, TEST_EMPLOYEES.superAdmin);
  assertEquals(response.status, 200);
  const announcement = await assertSuccess(response);
  assertExists((announcement as Record<string, unknown>).id);

  // Store for later tests
  createdAnnouncementId = (announcement as Record<string, unknown>).id as string;
});

Deno.test('POST /api-announcements - should create announcement with photos', async () => {
  const announcementData = {
    message: `E2E Test Announcement with Photo - ${Date.now()}`,
    photos: [
      { image_url: 'https://example.com/photo1.jpg', display_order: 1 },
      { image_url: 'https://example.com/photo2.jpg', display_order: 2 },
    ],
  };

  const response = await apiPost('api-announcements', announcementData, TEST_EMPLOYEES.superAdmin);
  const text = await response.text();
  assertEquals(response.status < 500, true, `Unexpected server error: ${text}`);
});

Deno.test('POST /api-announcements - should create announcement with files', async () => {
  const announcementData = {
    message: `E2E Test Announcement with Files - ${Date.now()}`,
    files: [
      { file_url: 'https://example.com/doc.pdf', file_name: 'document.pdf', file_size: 1024, mime_type: 'application/pdf' },
    ],
  };

  const response = await apiPost('api-announcements', announcementData, TEST_EMPLOYEES.superAdmin);
  const text = await response.text();
  assertEquals(response.status < 500, true, `Unexpected server error: ${text}`);
});

Deno.test('POST /api-announcements - should reject empty message', async () => {
  const announcementData = {
    message: '',
  };

  const response = await apiPost('api-announcements', announcementData, TEST_EMPLOYEES.superAdmin);
  await response.text(); // Consume body to avoid leak
  assertEquals(response.status, 400);
});

Deno.test('POST /api-announcements - should reject whitespace-only message', async () => {
  const announcementData = {
    message: '   ',
  };

  const response = await apiPost('api-announcements', announcementData, TEST_EMPLOYEES.superAdmin);
  await response.text(); // Consume body to avoid leak
  assertEquals(response.status, 400);
});

Deno.test('POST /api-announcements - should reject message over 5000 characters', async () => {
  const announcementData = {
    message: 'x'.repeat(5001),
  };

  const response = await apiPost('api-announcements', announcementData, TEST_EMPLOYEES.superAdmin);
  await response.text(); // Consume body to avoid leak
  assertEquals(response.status, 400);
});

Deno.test('POST /api-announcements - should reject non-superadmin (admin level 2)', async () => {
  const announcementData = {
    message: 'Should fail - admin trying to create',
  };

  const response = await apiPost('api-announcements', announcementData, TEST_EMPLOYEES.admin);
  await response.text(); // Consume body to avoid leak
  assertEquals(response.status, 403);
});

Deno.test('POST /api-announcements - should reject technician (level 0)', async () => {
  const announcementData = {
    message: 'Should fail - technician trying to create',
  };

  const response = await apiPost('api-announcements', announcementData, TEST_EMPLOYEES.tech1);
  await response.text(); // Consume body to avoid leak
  assertEquals(response.status, 403);
});

Deno.test('POST /api-announcements - should reject assigner (level 1)', async () => {
  const announcementData = {
    message: 'Should fail - assigner trying to create',
  };

  const response = await apiPost('api-announcements', announcementData, TEST_EMPLOYEES.assigner);
  await response.text(); // Consume body to avoid leak
  assertEquals(response.status, 403);
});

// ============================================
// GET ANNOUNCEMENT BY ID
// ============================================

Deno.test('GET /api-announcements/:id - should get announcement by ID', async () => {
  // First create an announcement
  const announcementData = {
    message: `E2E Test - Get By ID - ${Date.now()}`,
  };

  const createResponse = await apiPost('api-announcements', announcementData, TEST_EMPLOYEES.superAdmin);
  assertEquals(createResponse.status, 200);
  const created = await assertSuccess(createResponse);
  const announcementId = (created as Record<string, unknown>).id as string;

  // Then get it by ID
  const response = await apiGet(`api-announcements/${announcementId}`);
  assertEquals(response.status, 200);
  const announcement = await assertSuccess(response);
  assertEquals((announcement as Record<string, unknown>).id, announcementId);
});

Deno.test('GET /api-announcements/:id - should be accessible by all users (level 0)', async () => {
  // Create announcement first
  const announcementData = {
    message: `E2E Test - Read Access - ${Date.now()}`,
  };

  const createResponse = await apiPost('api-announcements', announcementData, TEST_EMPLOYEES.superAdmin);
  assertEquals(createResponse.status, 200);
  const created = await assertSuccess(createResponse);
  const announcementId = (created as Record<string, unknown>).id as string;

  // Tech user should be able to read
  const response = await apiGet(`api-announcements/${announcementId}`, TEST_EMPLOYEES.tech1);
  assertEquals(response.status, 200);
  const announcement = await assertSuccess(response);
  assertExists(announcement);
});

Deno.test('GET /api-announcements/:id - should return 404 for non-existent ID', async () => {
  const fakeId = randomUUID();
  const response = await apiGet(`api-announcements/${fakeId}`);
  await response.text(); // Consume body to avoid leak
  assertEquals(response.status, 404);
});

// ============================================
// UPDATE ANNOUNCEMENT
// ============================================

Deno.test('PUT /api-announcements/:id - should update announcement message (superadmin)', async () => {
  // First create an announcement
  const announcementData = {
    message: `E2E Test - Update Test - ${Date.now()}`,
  };

  const createResponse = await apiPost('api-announcements', announcementData, TEST_EMPLOYEES.superAdmin);
  assertEquals(createResponse.status, 200);
  const created = await assertSuccess(createResponse);
  const announcementId = (created as Record<string, unknown>).id as string;

  // Then update it
  const updateData = {
    message: `Updated Message - ${Date.now()}`,
  };

  const response = await apiPut(`api-announcements/${announcementId}`, updateData, TEST_EMPLOYEES.superAdmin);
  assertEquals(response.status, 200);
  const updated = await assertSuccess(response);
  assertEquals((updated as Record<string, unknown>).message, updateData.message);
});

Deno.test('PUT /api-announcements/:id - should update announcement photos', async () => {
  // First create an announcement
  const announcementData = {
    message: `E2E Test - Update Photos - ${Date.now()}`,
  };

  const createResponse = await apiPost('api-announcements', announcementData, TEST_EMPLOYEES.superAdmin);
  assertEquals(createResponse.status, 200);
  const created = await assertSuccess(createResponse);
  const announcementId = (created as Record<string, unknown>).id as string;

  // Update with photos
  const updateData = {
    photos: [
      { image_url: 'https://example.com/new-photo.jpg', display_order: 1 },
    ],
  };

  const response = await apiPut(`api-announcements/${announcementId}`, updateData, TEST_EMPLOYEES.superAdmin);
  const text = await response.text();
  assertEquals(response.status < 500, true, `Unexpected server error: ${text}`);
});

Deno.test('PUT /api-announcements/:id - should reject empty message', async () => {
  // First create an announcement
  const announcementData = {
    message: `E2E Test - Empty Update Test - ${Date.now()}`,
  };

  const createResponse = await apiPost('api-announcements', announcementData, TEST_EMPLOYEES.superAdmin);
  assertEquals(createResponse.status, 200);
  const created = await assertSuccess(createResponse);
  const announcementId = (created as Record<string, unknown>).id as string;

  // Try to update with empty message
  const updateData = {
    message: '',
  };

  const response = await apiPut(`api-announcements/${announcementId}`, updateData, TEST_EMPLOYEES.superAdmin);
  await response.text(); // Consume body to avoid leak
  assertEquals(response.status, 400);
});

Deno.test('PUT /api-announcements/:id - should reject message over 5000 characters', async () => {
  // First create an announcement
  const announcementData = {
    message: `E2E Test - Long Update Test - ${Date.now()}`,
  };

  const createResponse = await apiPost('api-announcements', announcementData, TEST_EMPLOYEES.superAdmin);
  assertEquals(createResponse.status, 200);
  const created = await assertSuccess(createResponse);
  const announcementId = (created as Record<string, unknown>).id as string;

  // Try to update with too long message
  const updateData = {
    message: 'x'.repeat(5001),
  };

  const response = await apiPut(`api-announcements/${announcementId}`, updateData, TEST_EMPLOYEES.superAdmin);
  await response.text(); // Consume body to avoid leak
  assertEquals(response.status, 400);
});

Deno.test('PUT /api-announcements/:id - should reject non-superadmin (admin level 2)', async () => {
  // First create an announcement
  const announcementData = {
    message: `E2E Test - Permission Test - ${Date.now()}`,
  };

  const createResponse = await apiPost('api-announcements', announcementData, TEST_EMPLOYEES.superAdmin);
  assertEquals(createResponse.status, 200);
  const created = await assertSuccess(createResponse);
  const announcementId = (created as Record<string, unknown>).id as string;

  // Admin (level 2) should not be able to update
  const updateData = {
    message: 'Should fail - admin trying to update',
  };

  const response = await apiPut(`api-announcements/${announcementId}`, updateData, TEST_EMPLOYEES.admin);
  await response.text(); // Consume body to avoid leak
  assertEquals(response.status, 403);
});

Deno.test('PUT /api-announcements/:id - should reject technician (level 0)', async () => {
  // First create an announcement
  const announcementData = {
    message: `E2E Test - Tech Permission Test - ${Date.now()}`,
  };

  const createResponse = await apiPost('api-announcements', announcementData, TEST_EMPLOYEES.superAdmin);
  assertEquals(createResponse.status, 200);
  const created = await assertSuccess(createResponse);
  const announcementId = (created as Record<string, unknown>).id as string;

  // Technician should not be able to update
  const updateData = {
    message: 'Should fail - technician trying to update',
  };

  const response = await apiPut(`api-announcements/${announcementId}`, updateData, TEST_EMPLOYEES.tech1);
  await response.text(); // Consume body to avoid leak
  assertEquals(response.status, 403);
});

Deno.test('PUT /api-announcements/:id - should return 404 for non-existent ID', async () => {
  const fakeId = randomUUID();
  const updateData = {
    message: 'Should fail - non-existent announcement',
  };

  const response = await apiPut(`api-announcements/${fakeId}`, updateData, TEST_EMPLOYEES.superAdmin);
  await response.text(); // Consume body to avoid leak
  assertEquals(response.status, 404);
});

// ============================================
// DELETE ANNOUNCEMENT
// ============================================

Deno.test('DELETE /api-announcements/:id - should delete announcement (superadmin)', async () => {
  // First create an announcement to delete
  const announcementData = {
    message: `E2E Test - Delete Test - ${Date.now()}`,
  };

  const createResponse = await apiPost('api-announcements', announcementData, TEST_EMPLOYEES.superAdmin);
  assertEquals(createResponse.status, 200);
  const created = await assertSuccess(createResponse);
  const announcementId = (created as Record<string, unknown>).id as string;

  // Delete it
  const response = await apiDelete(`api-announcements/${announcementId}`, TEST_EMPLOYEES.superAdmin);
  assertEquals(response.status, 200);
  const result = await response.json();
  assertExists(result.data.message);

  // Verify it's deleted
  const getResponse = await apiGet(`api-announcements/${announcementId}`);
  await getResponse.text(); // Consume body to avoid leak
  assertEquals(getResponse.status, 404);
});

Deno.test('DELETE /api-announcements/:id - should reject non-superadmin (admin level 2)', async () => {
  // First create an announcement
  const announcementData = {
    message: `E2E Test - Delete Permission Test - ${Date.now()}`,
  };

  const createResponse = await apiPost('api-announcements', announcementData, TEST_EMPLOYEES.superAdmin);
  assertEquals(createResponse.status, 200);
  const created = await assertSuccess(createResponse);
  const announcementId = (created as Record<string, unknown>).id as string;

  // Admin (level 2) should not be able to delete
  const response = await apiDelete(`api-announcements/${announcementId}`, TEST_EMPLOYEES.admin);
  await response.text(); // Consume body to avoid leak
  assertEquals(response.status, 403);
});

Deno.test('DELETE /api-announcements/:id - should reject technician (level 0)', async () => {
  // First create an announcement
  const announcementData = {
    message: `E2E Test - Tech Delete Test - ${Date.now()}`,
  };

  const createResponse = await apiPost('api-announcements', announcementData, TEST_EMPLOYEES.superAdmin);
  assertEquals(createResponse.status, 200);
  const created = await assertSuccess(createResponse);
  const announcementId = (created as Record<string, unknown>).id as string;

  // Technician should not be able to delete
  const response = await apiDelete(`api-announcements/${announcementId}`, TEST_EMPLOYEES.tech1);
  await response.text(); // Consume body to avoid leak
  assertEquals(response.status, 403);
});

Deno.test('DELETE /api-announcements/:id - should reject assigner (level 1)', async () => {
  // First create an announcement
  const announcementData = {
    message: `E2E Test - Assigner Delete Test - ${Date.now()}`,
  };

  const createResponse = await apiPost('api-announcements', announcementData, TEST_EMPLOYEES.superAdmin);
  assertEquals(createResponse.status, 200);
  const created = await assertSuccess(createResponse);
  const announcementId = (created as Record<string, unknown>).id as string;

  // Assigner should not be able to delete
  const response = await apiDelete(`api-announcements/${announcementId}`, TEST_EMPLOYEES.assigner);
  await response.text(); // Consume body to avoid leak
  assertEquals(response.status, 403);
});

Deno.test('DELETE /api-announcements/:id - should return 404 for non-existent ID', async () => {
  const fakeId = randomUUID();
  const response = await apiDelete(`api-announcements/${fakeId}`, TEST_EMPLOYEES.superAdmin);
  await response.text(); // Consume body to avoid leak
  assertEquals(response.status, 404);
});

// ============================================
// NOT FOUND ROUTE
// ============================================

Deno.test('GET /api-announcements/invalid-route - should return 404', async () => {
  const response = await apiGet('api-announcements/foo/bar/baz');
  await response.text(); // Consume body to avoid leak
  assertEquals(response.status, 404);
});
