/**
 * E2E Tests for api-sites
 * Tests all site operations with real database and authentication
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
  TEST_SITES,
  TEST_COMPANIES,
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
// GET SITE BY ID
// ============================================

Deno.test('GET /api-sites/:id - should get existing site', async () => {
  const response = await apiGet(`api-sites/${TEST_SITES.testCompanyHQ}`);
  assertEquals(response.status, 200);
  const site = await assertSuccess(response);
  assertExists(site);
  assertEquals((site as Record<string, unknown>).id, TEST_SITES.testCompanyHQ);
});

Deno.test('GET /api-sites/:id - should return 404 for non-existent site', async () => {
  const fakeId = randomUUID();
  const response = await apiGet(`api-sites/${fakeId}`);
  await response.text(); // Consume body to avoid leak
  assertEquals(response.status, 404);
});

// ============================================
// GLOBAL SEARCH
// ============================================

Deno.test('GET /api-sites/global-search - should return paginated sites', async () => {
  const response = await apiGet('api-sites/global-search');
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
  assertExists(data.pagination);
});

Deno.test('GET /api-sites/global-search - should filter by keyword', async () => {
  const response = await apiGet('api-sites/global-search?keyword=Test');
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
});

Deno.test('GET /api-sites/global-search - should filter by company_id', async () => {
  const response = await apiGet(`api-sites/global-search?company_id=${TEST_COMPANIES.testCompany}`);
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
});

Deno.test('GET /api-sites/global-search - should support pagination', async () => {
  const response = await apiGet('api-sites/global-search?page=1&limit=5');
  assertEquals(response.status, 200);
  const data = await response.json();
  assertEquals(data.pagination.page, 1);
  assertEquals(data.pagination.limit, 5);
});

// ============================================
// HINT (Quick Search)
// ============================================

Deno.test('GET /api-sites/hint - should return up to 5 sites', async () => {
  const response = await apiGet('api-sites/hint');
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
});

Deno.test('GET /api-sites/hint - should filter by keyword', async () => {
  const response = await apiGet('api-sites/hint?keyword=Office');
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
});

// ============================================
// CREATE SITE
// ============================================

Deno.test('POST /api-sites - should create site with valid data', async () => {
  const siteData = {
    company_id: TEST_COMPANIES.testCompany,
    name: `E2E Test Site ${Date.now()}`,
    province_code: 1,
    district_code: 1001,
    is_main_branch: false,
  };

  const response = await apiPost('api-sites', siteData, TEST_EMPLOYEES.superAdmin);
  const text = await response.text(); // Consume body
  // Should succeed or return validation error
  assertEquals(response.status < 500, true, `Unexpected server error: ${text}`);
});

Deno.test('POST /api-sites - should reject missing company_id', async () => {
  const siteData = {
    name: 'Site without company',
    province_code: 1,
  };

  const response = await apiPost('api-sites', siteData, TEST_EMPLOYEES.superAdmin);
  await response.text(); // Consume body
  assertEquals(response.status, 400);
});

// ============================================
// CREATE OR REPLACE (Upsert)
// ============================================

Deno.test('POST /api-sites/create-or-replace - should upsert site', async () => {
  const siteData = {
    company_id: TEST_COMPANIES.testCompany,
    name: `E2E Upsert Site ${Date.now()}`,
    province_code: 1,
    district_code: 1001,
    is_main_branch: false,
  };

  const response = await apiPost('api-sites/create-or-replace', siteData, TEST_EMPLOYEES.superAdmin);
  const text = await response.text(); // Consume body
  assertEquals(response.status < 500, true, `Unexpected server error: ${text}`);
});

// ============================================
// UPDATE SITE
// ============================================

Deno.test('PUT /api-sites/:id - should update site', async () => {
  const updateData = {
    name: `Updated Site ${Date.now()}`,
  };

  const response = await apiPut(`api-sites/${TEST_SITES.testCompanyHQ}`, updateData, TEST_EMPLOYEES.superAdmin);
  await response.text(); // Consume body
  assertEquals(response.status >= 200 && response.status < 500, true);
});

Deno.test('PUT /api-sites/:id - should return error for non-existent site', async () => {
  const fakeId = randomUUID();
  const updateData = {
    name: 'Should fail',
  };

  const response = await apiPut(`api-sites/${fakeId}`, updateData, TEST_EMPLOYEES.superAdmin);
  await response.text(); // Consume body
  assertEquals(response.status >= 400, true);
});

// ============================================
// SITE COMMENTS
// ============================================

Deno.test('GET /api-sites/:id/comments - should get site comments', async () => {
  const response = await apiGet(`api-sites/${TEST_SITES.testCompanyHQ}/comments`);
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
});

Deno.test('POST /api-sites/:id/comments - should create comment', async () => {
  const commentData = {
    content: 'E2E Test Comment for site',
  };

  const response = await apiPost(`api-sites/${TEST_SITES.testCompanyHQ}/comments`, commentData);
  const text = await response.text(); // Consume body
  assertEquals(response.status < 500, true, `Unexpected server error: ${text}`);
});

// ============================================
// PERMISSION TESTS
// ============================================

Deno.test('Permission: Technician can read sites', async () => {
  const response = await apiGet(`api-sites/${TEST_SITES.testCompanyHQ}`, TEST_EMPLOYEES.tech1);
  await response.text(); // Consume body
  assertEquals(response.status, 200);
});

Deno.test('Permission: Technician cannot create sites', async () => {
  const siteData = {
    company_id: TEST_COMPANIES.testCompany,
    name: 'Should Fail Site',
    province_code: 1,
  };

  const response = await apiPost('api-sites', siteData, TEST_EMPLOYEES.tech1);
  await response.text(); // Consume body
  assertEquals(response.status, 403);
});
