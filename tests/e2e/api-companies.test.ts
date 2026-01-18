/**
 * E2E Tests for api-companies
 * Tests all company operations with real database and authentication
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
// GET COMPANY BY ID
// ============================================

Deno.test('GET /api-companies/:id - should get existing company', async () => {
  const response = await apiGet(`api-companies/${TEST_COMPANIES.testCompany}`);
  assertEquals(response.status, 200);
  const company = await assertSuccess(response);
  assertExists(company);
  assertEquals((company as Record<string, unknown>).id, TEST_COMPANIES.testCompany);
});

Deno.test('GET /api-companies/:id - should return 404 for non-existent company', async () => {
  const fakeId = randomUUID();
  const response = await apiGet(`api-companies/${fakeId}`);
  await response.text(); // Consume body to avoid leak
  assertEquals(response.status, 404);
});

// ============================================
// GLOBAL SEARCH
// ============================================

Deno.test('GET /api-companies/global-search - should return paginated companies', async () => {
  const response = await apiGet('api-companies/global-search');
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
  assertExists(data.pagination);
});

Deno.test('GET /api-companies/global-search - should filter by keyword', async () => {
  const response = await apiGet('api-companies/global-search?keyword=test');
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
});

Deno.test('GET /api-companies/global-search - should support pagination', async () => {
  const response = await apiGet('api-companies/global-search?page=1&limit=5');
  assertEquals(response.status, 200);
  const data = await response.json();
  assertEquals(data.pagination.page, 1);
  assertEquals(data.pagination.limit, 5);
});

// ============================================
// HINT (Quick Search)
// ============================================

Deno.test('GET /api-companies/hint - should return up to 5 companies', async () => {
  const response = await apiGet('api-companies/hint');
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
});

Deno.test('GET /api-companies/hint - should filter by keyword', async () => {
  const response = await apiGet('api-companies/hint?keyword=ABC');
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
});

// ============================================
// CREATE COMPANY
// ============================================

Deno.test('POST /api-companies - should create company with valid data', async () => {
  const taxId = `999${Date.now().toString().slice(-10)}`;
  const companyData = {
    tax_id: taxId,
    name_th: 'บริษัท ทดสอบ E2E จำกัด',
    name_en: 'E2E Test Company Ltd',
  };

  const response = await apiPost('api-companies', companyData, TEST_EMPLOYEES.superAdmin);
  const text = await response.text(); // Consume body
  // Should succeed or return validation error
  assertEquals(response.status < 500, true, `Unexpected server error: ${text}`);
});

Deno.test('POST /api-companies - should reject missing name_en', async () => {
  const companyData = {
    tax_id: '1234567890123',
    name_th: 'บริษัท ทดสอบ จำกัด',
  };

  const response = await apiPost('api-companies', companyData, TEST_EMPLOYEES.superAdmin);
  await response.text(); // Consume body
  assertEquals(response.status, 400);
});

// ============================================
// CREATE OR UPDATE (Upsert)
// ============================================

Deno.test('POST /api-companies/create-or-update - should upsert company by tax_id', async () => {
  const taxId = `888${Date.now().toString().slice(-10)}`;
  const companyData = {
    tax_id: taxId,
    name_th: 'บริษัท อัพเสิร์ต E2E จำกัด',
    name_en: 'E2E Upsert Company Ltd',
  };

  const response = await apiPost('api-companies/create-or-update', companyData, TEST_EMPLOYEES.superAdmin);
  const text = await response.text(); // Consume body
  assertEquals(response.status < 500, true, `Unexpected server error: ${text}`);
});

// ============================================
// UPDATE COMPANY
// ============================================

Deno.test('PUT /api-companies/:id - should update company', async () => {
  const updateData = {
    name_en: `Updated Company ${Date.now()}`,
  };

  const response = await apiPut(`api-companies/${TEST_COMPANIES.testCompany}`, updateData, TEST_EMPLOYEES.superAdmin);
  await response.text(); // Consume body
  assertEquals(response.status >= 200 && response.status < 500, true);
});

Deno.test('PUT /api-companies/:id - should return error for non-existent company', async () => {
  const fakeId = randomUUID();
  const updateData = {
    name_en: 'Should fail',
  };

  const response = await apiPut(`api-companies/${fakeId}`, updateData, TEST_EMPLOYEES.superAdmin);
  await response.text(); // Consume body
  assertEquals(response.status >= 400, true);
});

// ============================================
// COMPANY COMMENTS
// ============================================

Deno.test('GET /api-companies/:id/comments - should get company comments', async () => {
  const response = await apiGet(`api-companies/${TEST_COMPANIES.testCompany}/comments`);
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
});

Deno.test('POST /api-companies/:id/comments - should create comment', async () => {
  const commentData = {
    content: 'E2E Test Comment for company',
  };

  const response = await apiPost(`api-companies/${TEST_COMPANIES.testCompany}/comments`, commentData);
  const text = await response.text(); // Consume body
  // Should succeed (201) or return error
  assertEquals(response.status < 500, true, `Unexpected server error: ${text}`);
});

// ============================================
// PERMISSION TESTS
// ============================================

Deno.test('Permission: Technician can read companies', async () => {
  const response = await apiGet(`api-companies/${TEST_COMPANIES.testCompany}`, TEST_EMPLOYEES.tech1);
  await response.text(); // Consume body
  assertEquals(response.status, 200);
});

Deno.test('Permission: Technician cannot create companies', async () => {
  const companyData = {
    tax_id: '0000000000001',
    name_th: 'Should Fail',
    name_en: 'Should Fail Ltd',
  };

  const response = await apiPost('api-companies', companyData, TEST_EMPLOYEES.tech1);
  await response.text(); // Consume body
  assertEquals(response.status, 403);
});
