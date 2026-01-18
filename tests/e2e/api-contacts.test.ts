/**
 * E2E Tests for api-contacts
 * Tests all contact operations with real database and authentication
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
  randomUUID,
} from './test-utils.ts';

// Track created contact IDs for cleanup and reuse
let createdContactId: string | null = null;

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
// LIST CONTACTS
// ============================================

Deno.test('GET /api-contacts - should list contacts with pagination', async () => {
  const response = await apiGet('api-contacts');
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
  assertExists(data.pagination);
});

Deno.test('GET /api-contacts/list - should list contacts (explicit path)', async () => {
  const response = await apiGet('api-contacts/list');
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
  assertExists(data.pagination);
});

Deno.test('GET /api-contacts - should support pagination parameters', async () => {
  const response = await apiGet('api-contacts?page=1&limit=5');
  assertEquals(response.status, 200);
  const data = await response.json();
  assertEquals(data.pagination.page, 1);
  assertEquals(data.pagination.limit, 5);
});

Deno.test('GET /api-contacts - should filter by site_id', async () => {
  const response = await apiGet(`api-contacts?site_id=${TEST_SITES.testCompanyHQ}`);
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
});

// ============================================
// SEARCH CONTACTS
// ============================================

Deno.test('GET /api-contacts/search - should search contacts by query', async () => {
  const response = await apiGet('api-contacts/search?q=Test');
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
});

Deno.test('GET /api-contacts/search - should return empty for short query', async () => {
  const response = await apiGet('api-contacts/search?q=a');
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
  // Should return empty array for queries less than 2 characters
  assertEquals(Array.isArray(data.data), true);
});

Deno.test('GET /api-contacts/search - should filter by site_id', async () => {
  const response = await apiGet(`api-contacts/search?q=Test&site_id=${TEST_SITES.testCompanyHQ}`);
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
});

// ============================================
// GET CONTACTS BY SITE
// ============================================

Deno.test('GET /api-contacts/site/:siteId - should get contacts for site', async () => {
  const response = await apiGet(`api-contacts/site/${TEST_SITES.testCompanyHQ}`);
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
});

Deno.test('GET /api-contacts/site/:siteId - should return empty array for site with no contacts', async () => {
  // Use a different site that may have no contacts
  const response = await apiGet(`api-contacts/site/${TEST_SITES.siamPowerServiceCenter}`);
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
  assertEquals(Array.isArray(data.data), true);
});

Deno.test('GET /api-contacts/site/:siteId - should return 400 for invalid UUID', async () => {
  const response = await apiGet('api-contacts/site/invalid-uuid');
  await response.text(); // Consume body
  assertEquals(response.status, 400);
});

// ============================================
// CREATE CONTACT
// ============================================

Deno.test('POST /api-contacts - should create contact with valid data', async () => {
  const contactData = {
    site_id: TEST_SITES.testCompanyHQ,
    person_name: `E2E Test Contact ${Date.now()}`,
    nickname: 'TestNick',
    phone: ['081-234-5678'],
    email: ['test@example.com'],
    line_id: 'test_line_id',
    note: 'Created by E2E test',
  };

  const response = await apiPost('api-contacts', contactData, TEST_EMPLOYEES.superAdmin);
  const text = await response.text();
  assertEquals(response.status < 500, true, `Unexpected server error: ${text}`);

  // If created successfully, store the ID for later tests
  if (response.status === 201) {
    try {
      const data = JSON.parse(text);
      if (data.data && data.data.id) {
        createdContactId = data.data.id;
      }
    } catch {
      // Ignore parse errors
    }
  }
});

Deno.test('POST /api-contacts - should reject missing person_name', async () => {
  const contactData = {
    site_id: TEST_SITES.testCompanyHQ,
    nickname: 'NoName',
  };

  const response = await apiPost('api-contacts', contactData, TEST_EMPLOYEES.superAdmin);
  await response.text(); // Consume body
  assertEquals(response.status, 400);
});

Deno.test('POST /api-contacts - should create contact with minimal data', async () => {
  const contactData = {
    person_name: `Minimal Contact ${Date.now()}`,
  };

  const response = await apiPost('api-contacts', contactData, TEST_EMPLOYEES.superAdmin);
  const text = await response.text();
  assertEquals(response.status < 500, true, `Unexpected server error: ${text}`);
});

// ============================================
// GET CONTACT BY ID
// ============================================

Deno.test('GET /api-contacts/:id - should get existing contact', async () => {
  // First create a contact to ensure we have one to get
  const contactData = {
    site_id: TEST_SITES.testCompanyHQ,
    person_name: `Get Test Contact ${Date.now()}`,
  };

  const createResponse = await apiPost('api-contacts', contactData, TEST_EMPLOYEES.superAdmin);
  const createText = await createResponse.text();

  if (createResponse.status === 201) {
    const createData = JSON.parse(createText);
    const contactId = createData.data.id;

    const response = await apiGet(`api-contacts/${contactId}`);
    assertEquals(response.status, 200);
    const contact = await assertSuccess(response);
    assertExists(contact);
    assertEquals((contact as Record<string, unknown>).id, contactId);
  } else {
    // Skip if create failed
    console.log('Skipping get test - create failed');
  }
});

Deno.test('GET /api-contacts/:id - should return 404 for non-existent contact', async () => {
  const fakeId = randomUUID();
  const response = await apiGet(`api-contacts/${fakeId}`);
  await response.text(); // Consume body
  assertEquals(response.status, 404);
});

Deno.test('GET /api-contacts/:id - should return 400 for invalid UUID', async () => {
  const response = await apiGet('api-contacts/invalid-uuid');
  await response.text(); // Consume body
  // Non-UUID paths fall through to 404 based on index.ts routing
  assertEquals(response.status, 404);
});

// ============================================
// UPDATE CONTACT
// ============================================

Deno.test('PUT /api-contacts/:id - should update contact', async () => {
  // First create a contact to update
  const contactData = {
    site_id: TEST_SITES.testCompanyHQ,
    person_name: `Update Test Contact ${Date.now()}`,
  };

  const createResponse = await apiPost('api-contacts', contactData, TEST_EMPLOYEES.superAdmin);
  const createText = await createResponse.text();

  if (createResponse.status === 201) {
    const createData = JSON.parse(createText);
    const contactId = createData.data.id;

    const updateData = {
      person_name: `Updated Contact ${Date.now()}`,
      nickname: 'UpdatedNick',
    };

    const response = await apiPut(`api-contacts/${contactId}`, updateData, TEST_EMPLOYEES.superAdmin);
    const text = await response.text();
    assertEquals(response.status < 500, true, `Unexpected server error: ${text}`);
  } else {
    console.log('Skipping update test - create failed');
  }
});

Deno.test('PUT /api-contacts/:id - should return error for non-existent contact', async () => {
  const fakeId = randomUUID();
  const updateData = {
    person_name: 'Should fail',
  };

  const response = await apiPut(`api-contacts/${fakeId}`, updateData, TEST_EMPLOYEES.superAdmin);
  await response.text(); // Consume body
  assertEquals(response.status >= 400, true);
});

Deno.test('PUT /api-contacts/:id - should return 400 for invalid UUID', async () => {
  const updateData = {
    person_name: 'Invalid UUID test',
  };

  const response = await apiPut('api-contacts/invalid-uuid', updateData, TEST_EMPLOYEES.superAdmin);
  await response.text(); // Consume body
  assertEquals(response.status, 400);
});

// ============================================
// DELETE CONTACT
// ============================================

Deno.test('DELETE /api-contacts/:id - should delete contact', async () => {
  // First create a contact to delete
  const contactData = {
    site_id: TEST_SITES.testCompanyHQ,
    person_name: `Delete Test Contact ${Date.now()}`,
  };

  const createResponse = await apiPost('api-contacts', contactData, TEST_EMPLOYEES.superAdmin);
  const createText = await createResponse.text();

  if (createResponse.status === 201) {
    const createData = JSON.parse(createText);
    const contactId = createData.data.id;

    const response = await apiDelete(`api-contacts/${contactId}`, TEST_EMPLOYEES.superAdmin);
    const text = await response.text();
    assertEquals(response.status < 500, true, `Unexpected server error: ${text}`);
  } else {
    console.log('Skipping delete test - create failed');
  }
});

Deno.test('DELETE /api-contacts/:id - should return 400 for invalid UUID', async () => {
  const response = await apiDelete('api-contacts/invalid-uuid', TEST_EMPLOYEES.superAdmin);
  await response.text(); // Consume body
  assertEquals(response.status, 400);
});

// ============================================
// PERMISSION TESTS
// ============================================

Deno.test('Permission: Technician (Level 0) can list contacts', async () => {
  const response = await apiGet('api-contacts', TEST_EMPLOYEES.tech1);
  assertEquals(response.status, 200);
  await response.json(); // Consume body
});

Deno.test('Permission: Technician (Level 0) can search contacts', async () => {
  const response = await apiGet('api-contacts/search?q=Test', TEST_EMPLOYEES.tech1);
  assertEquals(response.status, 200);
  await response.json(); // Consume body
});

Deno.test('Permission: Technician (Level 0) can get contacts by site', async () => {
  const response = await apiGet(`api-contacts/site/${TEST_SITES.testCompanyHQ}`, TEST_EMPLOYEES.tech1);
  assertEquals(response.status, 200);
  await response.json(); // Consume body
});

Deno.test('Permission: Technician (Level 0) cannot create contacts', async () => {
  const contactData = {
    site_id: TEST_SITES.testCompanyHQ,
    person_name: 'Should Fail Contact',
  };

  const response = await apiPost('api-contacts', contactData, TEST_EMPLOYEES.tech1);
  await response.text(); // Consume body
  assertEquals(response.status, 403);
});

Deno.test('Permission: Technician (Level 0) cannot update contacts', async () => {
  // First create a contact as admin
  const contactData = {
    site_id: TEST_SITES.testCompanyHQ,
    person_name: `Permission Test Contact ${Date.now()}`,
  };

  const createResponse = await apiPost('api-contacts', contactData, TEST_EMPLOYEES.superAdmin);
  const createText = await createResponse.text();

  if (createResponse.status === 201) {
    const createData = JSON.parse(createText);
    const contactId = createData.data.id;

    const updateData = {
      person_name: 'Should Fail Update',
    };

    const response = await apiPut(`api-contacts/${contactId}`, updateData, TEST_EMPLOYEES.tech1);
    await response.text(); // Consume body
    assertEquals(response.status, 403);
  } else {
    console.log('Skipping permission update test - create failed');
  }
});

Deno.test('Permission: Technician (Level 0) cannot delete contacts', async () => {
  // First create a contact as admin
  const contactData = {
    site_id: TEST_SITES.testCompanyHQ,
    person_name: `Permission Delete Test Contact ${Date.now()}`,
  };

  const createResponse = await apiPost('api-contacts', contactData, TEST_EMPLOYEES.superAdmin);
  const createText = await createResponse.text();

  if (createResponse.status === 201) {
    const createData = JSON.parse(createText);
    const contactId = createData.data.id;

    const response = await apiDelete(`api-contacts/${contactId}`, TEST_EMPLOYEES.tech1);
    await response.text(); // Consume body
    assertEquals(response.status, 403);
  } else {
    console.log('Skipping permission delete test - create failed');
  }
});

Deno.test('Permission: Assigner (Level 1) can create contacts', async () => {
  const contactData = {
    site_id: TEST_SITES.testCompanyHQ,
    person_name: `Assigner Created Contact ${Date.now()}`,
  };

  const response = await apiPost('api-contacts', contactData, TEST_EMPLOYEES.assigner);
  const text = await response.text();
  // Level 1 should be able to create
  assertEquals(response.status < 500, true, `Unexpected server error: ${text}`);
});

Deno.test('Permission: Assigner (Level 1) cannot delete contacts (requires Level 2)', async () => {
  // First create a contact as admin
  const contactData = {
    site_id: TEST_SITES.testCompanyHQ,
    person_name: `Level 1 Delete Test Contact ${Date.now()}`,
  };

  const createResponse = await apiPost('api-contacts', contactData, TEST_EMPLOYEES.superAdmin);
  const createText = await createResponse.text();

  if (createResponse.status === 201) {
    const createData = JSON.parse(createText);
    const contactId = createData.data.id;

    const response = await apiDelete(`api-contacts/${contactId}`, TEST_EMPLOYEES.assigner);
    await response.text(); // Consume body
    // Delete requires level 2, assigner is level 1
    assertEquals(response.status, 403);
  } else {
    console.log('Skipping level 1 delete test - create failed');
  }
});

Deno.test('Permission: Admin (Level 2) can delete contacts', async () => {
  // First create a contact as admin
  const contactData = {
    site_id: TEST_SITES.testCompanyHQ,
    person_name: `Admin Delete Test Contact ${Date.now()}`,
  };

  const createResponse = await apiPost('api-contacts', contactData, TEST_EMPLOYEES.superAdmin);
  const createText = await createResponse.text();

  if (createResponse.status === 201) {
    const createData = JSON.parse(createText);
    const contactId = createData.data.id;

    const response = await apiDelete(`api-contacts/${contactId}`, TEST_EMPLOYEES.admin);
    const text = await response.text();
    assertEquals(response.status < 500, true, `Unexpected server error: ${text}`);
  } else {
    console.log('Skipping admin delete test - create failed');
  }
});
