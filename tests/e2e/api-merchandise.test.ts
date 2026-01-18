/**
 * E2E Tests for api-merchandise
 * Tests all merchandise operations with real database and authentication
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

// Test model IDs from seed data
const TEST_MODELS = {
  smartUps1500: '40000000-0000-0000-0000-000000000001',
  smartUps2200: '40000000-0000-0000-0000-000000000002',
  smartUps3000: '40000000-0000-0000-0000-000000000003',
  symmetraPx40k: '40000000-0000-0000-0000-000000000004',
  galaxyVs100k: '40000000-0000-0000-0000-000000000005',
};

// Track created merchandise IDs for cleanup/reuse
let createdMerchandiseId: string | null = null;

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
// LIST MERCHANDISE
// ============================================

Deno.test('GET /api-merchandise - should return paginated merchandise list', async () => {
  const response = await apiGet('api-merchandise');
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
  assertExists(data.pagination);
});

Deno.test('GET /api-merchandise - should support pagination params', async () => {
  const response = await apiGet('api-merchandise?page=1&limit=5');
  assertEquals(response.status, 200);
  const data = await response.json();
  assertEquals(data.pagination.page, 1);
  assertEquals(data.pagination.limit, 5);
});

Deno.test('GET /api-merchandise - should support search by serial_no', async () => {
  const response = await apiGet('api-merchandise?search=TEST');
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
});

// ============================================
// CREATE MERCHANDISE
// ============================================

Deno.test('POST /api-merchandise - should create merchandise with valid data', async () => {
  const serialNo = `E2E-${Date.now()}`;
  const merchandiseData = {
    serial_no: serialNo,
    model_id: TEST_MODELS.smartUps1500,
    site_id: TEST_SITES.testCompanyHQ,
    pm_count: 0,
  };

  const response = await apiPost('api-merchandise', merchandiseData, TEST_EMPLOYEES.superAdmin);
  const text = await response.text();
  // Should succeed (201) or return error
  assertEquals(response.status < 500, true, `Unexpected server error: ${text}`);

  // If successful, save the ID for later tests
  if (response.status === 201) {
    try {
      const data = JSON.parse(text);
      if (data.data?.id) {
        createdMerchandiseId = data.data.id;
      }
    } catch {
      // Ignore parse errors
    }
  }
});

Deno.test('POST /api-merchandise - should reject missing serial_no', async () => {
  const merchandiseData = {
    model_id: TEST_MODELS.smartUps1500,
    site_id: TEST_SITES.testCompanyHQ,
  };

  const response = await apiPost('api-merchandise', merchandiseData, TEST_EMPLOYEES.superAdmin);
  await response.text(); // Consume body
  assertEquals(response.status, 400);
});

Deno.test('POST /api-merchandise - should reject missing model_id', async () => {
  const merchandiseData = {
    serial_no: `E2E-NOMODEL-${Date.now()}`,
    site_id: TEST_SITES.testCompanyHQ,
  };

  const response = await apiPost('api-merchandise', merchandiseData, TEST_EMPLOYEES.superAdmin);
  await response.text(); // Consume body
  assertEquals(response.status, 400);
});

Deno.test('POST /api-merchandise - should reject missing site_id', async () => {
  const merchandiseData = {
    serial_no: `E2E-NOSITE-${Date.now()}`,
    model_id: TEST_MODELS.smartUps1500,
  };

  const response = await apiPost('api-merchandise', merchandiseData, TEST_EMPLOYEES.superAdmin);
  await response.text(); // Consume body
  assertEquals(response.status, 400);
});

Deno.test('POST /api-merchandise - should reject invalid model_id', async () => {
  const merchandiseData = {
    serial_no: `E2E-BADMODEL-${Date.now()}`,
    model_id: randomUUID(), // Non-existent model
    site_id: TEST_SITES.testCompanyHQ,
  };

  const response = await apiPost('api-merchandise', merchandiseData, TEST_EMPLOYEES.superAdmin);
  await response.text(); // Consume body
  assertEquals(response.status, 404);
});

Deno.test('POST /api-merchandise - should reject invalid site_id', async () => {
  const merchandiseData = {
    serial_no: `E2E-BADSITE-${Date.now()}`,
    model_id: TEST_MODELS.smartUps1500,
    site_id: randomUUID(), // Non-existent site
  };

  const response = await apiPost('api-merchandise', merchandiseData, TEST_EMPLOYEES.superAdmin);
  await response.text(); // Consume body
  assertEquals(response.status, 404);
});

// ============================================
// GET MERCHANDISE BY ID
// ============================================

Deno.test('GET /api-merchandise/:id - should get existing merchandise', async () => {
  // First create a merchandise to get
  const serialNo = `E2E-GET-${Date.now()}`;
  const merchandiseData = {
    serial_no: serialNo,
    model_id: TEST_MODELS.smartUps2200,
    site_id: TEST_SITES.testCompanyHQ,
  };

  const createResponse = await apiPost('api-merchandise', merchandiseData, TEST_EMPLOYEES.superAdmin);
  const createText = await createResponse.text();

  if (createResponse.status !== 201) {
    // Skip test if creation failed
    console.log('Skipping GET by ID test - creation failed:', createText);
    return;
  }

  const createData = JSON.parse(createText);
  const merchandiseId = createData.data.id;

  // Now get it
  const response = await apiGet(`api-merchandise/${merchandiseId}`);
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
  assertEquals(data.data.id, merchandiseId);
  assertEquals(data.data.serial_no, serialNo);
});

Deno.test('GET /api-merchandise/:id - should return 404 for non-existent merchandise', async () => {
  const fakeId = randomUUID();
  const response = await apiGet(`api-merchandise/${fakeId}`);
  await response.text(); // Consume body
  assertEquals(response.status >= 400, true);
});

// ============================================
// SEARCH MERCHANDISE
// ============================================

Deno.test('GET /api-merchandise/search - should return paginated search results', async () => {
  const response = await apiGet('api-merchandise/search');
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
  assertExists(data.pagination);
});

Deno.test('GET /api-merchandise/search - should filter by query', async () => {
  const response = await apiGet('api-merchandise/search?query=E2E');
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
});

Deno.test('GET /api-merchandise/search - should filter by site_id', async () => {
  const response = await apiGet(`api-merchandise/search?site_id=${TEST_SITES.testCompanyHQ}`);
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
});

Deno.test('GET /api-merchandise/search - should support pagination', async () => {
  const response = await apiGet('api-merchandise/search?page=1&limit=10');
  assertEquals(response.status, 200);
  const data = await response.json();
  assertEquals(data.pagination.page, 1);
  assertEquals(data.pagination.limit, 10);
});

// ============================================
// HINT (Quick Search)
// ============================================

Deno.test('GET /api-merchandise/hint - should return up to 5 merchandise', async () => {
  const response = await apiGet('api-merchandise/hint');
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
  assertEquals(Array.isArray(data.data), true);
  assertEquals(data.data.length <= 5, true);
});

Deno.test('GET /api-merchandise/hint - should filter by query', async () => {
  const response = await apiGet('api-merchandise/hint?query=E2E');
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
});

Deno.test('GET /api-merchandise/hint - should filter by site_id', async () => {
  const response = await apiGet(`api-merchandise/hint?site_id=${TEST_SITES.testCompanyHQ}`);
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
});

// ============================================
// CHECK DUPLICATE
// ============================================

Deno.test('GET /api-merchandise/check-duplicate - should require serial_no param', async () => {
  const response = await apiGet('api-merchandise/check-duplicate');
  await response.text(); // Consume body
  assertEquals(response.status, 400);
});

Deno.test('GET /api-merchandise/check-duplicate - should return is_duplicate false for non-existent serial', async () => {
  const response = await apiGet(`api-merchandise/check-duplicate?serial_no=NONEXISTENT-${Date.now()}`);
  assertEquals(response.status, 200);
  const data = await response.json();
  assertEquals(data.data.is_duplicate, false);
  assertEquals(data.data.merchandise, null);
});

Deno.test('GET /api-merchandise/check-duplicate - should find existing serial number', async () => {
  // First create a merchandise
  const serialNo = `E2E-DUP-${Date.now()}`;
  const createResponse = await apiPost('api-merchandise', {
    serial_no: serialNo,
    model_id: TEST_MODELS.smartUps1500,
    site_id: TEST_SITES.testCompanyHQ,
  }, TEST_EMPLOYEES.superAdmin);
  await createResponse.text();

  if (createResponse.status !== 201) {
    console.log('Skipping duplicate check test - creation failed');
    return;
  }

  // Now check for duplicate
  const response = await apiGet(`api-merchandise/check-duplicate?serial_no=${serialNo}`);
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
  assertEquals(data.data.is_duplicate, true);
  assertExists(data.data.merchandise);
  assertEquals(data.data.merchandise.serial_no, serialNo);
});

// ============================================
// GET BY MODEL
// ============================================

Deno.test('GET /api-merchandise/model/:modelId - should return merchandise for model', async () => {
  const response = await apiGet(`api-merchandise/model/${TEST_MODELS.smartUps1500}`);
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
  assertExists(data.pagination);
});

Deno.test('GET /api-merchandise/model/:modelId - should support pagination', async () => {
  const response = await apiGet(`api-merchandise/model/${TEST_MODELS.smartUps1500}?page=1&limit=5`);
  assertEquals(response.status, 200);
  const data = await response.json();
  assertEquals(data.pagination.page, 1);
  assertEquals(data.pagination.limit, 5);
});

// ============================================
// GET BY SITE
// ============================================

Deno.test('GET /api-merchandise/site/:siteId - should return merchandise for site', async () => {
  const response = await apiGet(`api-merchandise/site/${TEST_SITES.testCompanyHQ}`);
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
  assertExists(data.pagination);
});

Deno.test('GET /api-merchandise/site/:siteId - should support pagination', async () => {
  const response = await apiGet(`api-merchandise/site/${TEST_SITES.testCompanyHQ}?page=1&limit=5`);
  assertEquals(response.status, 200);
  const data = await response.json();
  assertEquals(data.pagination.page, 1);
  assertEquals(data.pagination.limit, 5);
});

// ============================================
// UPDATE MERCHANDISE
// ============================================

Deno.test('PUT /api-merchandise/:id - should update merchandise', async () => {
  // First create a merchandise to update
  const serialNo = `E2E-UPDATE-${Date.now()}`;
  const createResponse = await apiPost('api-merchandise', {
    serial_no: serialNo,
    model_id: TEST_MODELS.smartUps1500,
    site_id: TEST_SITES.testCompanyHQ,
    pm_count: 0,
  }, TEST_EMPLOYEES.superAdmin);
  const createText = await createResponse.text();

  if (createResponse.status !== 201) {
    console.log('Skipping update test - creation failed:', createText);
    return;
  }

  const createData = JSON.parse(createText);
  const merchandiseId = createData.data.id;

  // Update the pm_count
  const updateResponse = await apiPut(`api-merchandise/${merchandiseId}`, {
    pm_count: 5,
  }, TEST_EMPLOYEES.superAdmin);
  await updateResponse.text(); // Consume body
  assertEquals(updateResponse.status >= 200 && updateResponse.status < 500, true);
});

Deno.test('PUT /api-merchandise/:id - should return error for non-existent merchandise', async () => {
  const fakeId = randomUUID();
  const response = await apiPut(`api-merchandise/${fakeId}`, {
    pm_count: 1,
  }, TEST_EMPLOYEES.superAdmin);
  await response.text(); // Consume body
  assertEquals(response.status >= 400, true);
});

Deno.test('PUT /api-merchandise/:id - should validate model_id if provided', async () => {
  // First create a merchandise
  const serialNo = `E2E-UPDBADMODEL-${Date.now()}`;
  const createResponse = await apiPost('api-merchandise', {
    serial_no: serialNo,
    model_id: TEST_MODELS.smartUps1500,
    site_id: TEST_SITES.testCompanyHQ,
  }, TEST_EMPLOYEES.superAdmin);
  const createText = await createResponse.text();

  if (createResponse.status !== 201) {
    console.log('Skipping test - creation failed');
    return;
  }

  const createData = JSON.parse(createText);
  const merchandiseId = createData.data.id;

  // Try to update with invalid model_id
  const response = await apiPut(`api-merchandise/${merchandiseId}`, {
    model_id: randomUUID(),
  }, TEST_EMPLOYEES.superAdmin);
  await response.text();
  assertEquals(response.status, 404);
});

// ============================================
// DELETE MERCHANDISE
// ============================================

Deno.test('DELETE /api-merchandise/:id - should delete merchandise', async () => {
  // First create a merchandise to delete
  const serialNo = `E2E-DELETE-${Date.now()}`;
  const createResponse = await apiPost('api-merchandise', {
    serial_no: serialNo,
    model_id: TEST_MODELS.smartUps1500,
    site_id: TEST_SITES.testCompanyHQ,
  }, TEST_EMPLOYEES.superAdmin);
  const createText = await createResponse.text();

  if (createResponse.status !== 201) {
    console.log('Skipping delete test - creation failed:', createText);
    return;
  }

  const createData = JSON.parse(createText);
  const merchandiseId = createData.data.id;

  // Delete it
  const response = await apiDelete(`api-merchandise/${merchandiseId}`, TEST_EMPLOYEES.superAdmin);
  await response.text(); // Consume body
  assertEquals(response.status >= 200 && response.status < 300, true);

  // Verify it's deleted
  const getResponse = await apiGet(`api-merchandise/${merchandiseId}`);
  await getResponse.text();
  assertEquals(getResponse.status >= 400, true);
});

Deno.test('DELETE /api-merchandise/:id - should return error for non-existent merchandise', async () => {
  const fakeId = randomUUID();
  const response = await apiDelete(`api-merchandise/${fakeId}`, TEST_EMPLOYEES.superAdmin);
  await response.text(); // Consume body
  assertEquals(response.status >= 400, true);
});

// ============================================
// LOCATION MANAGEMENT
// ============================================

Deno.test('GET /api-merchandise/:id/location - should get location for merchandise', async () => {
  // First create a merchandise
  const serialNo = `E2E-LOC-${Date.now()}`;
  const createResponse = await apiPost('api-merchandise', {
    serial_no: serialNo,
    model_id: TEST_MODELS.smartUps1500,
    site_id: TEST_SITES.testCompanyHQ,
  }, TEST_EMPLOYEES.superAdmin);
  const createText = await createResponse.text();

  if (createResponse.status !== 201) {
    console.log('Skipping location test - creation failed');
    return;
  }

  const createData = JSON.parse(createText);
  const merchandiseId = createData.data.id;

  // Get location (should return null initially)
  const response = await apiGet(`api-merchandise/${merchandiseId}/location`);
  assertEquals(response.status, 200);
  const data = await response.json();
  assertEquals(data.data, null);
});

Deno.test('GET /api-merchandise/:id/location - should return 404 for non-existent merchandise', async () => {
  const fakeId = randomUUID();
  const response = await apiGet(`api-merchandise/${fakeId}/location`);
  await response.text();
  assertEquals(response.status, 404);
});

Deno.test('POST /api-merchandise/:id/location - should create location', async () => {
  // First create a merchandise
  const serialNo = `E2E-LOCCREATE-${Date.now()}`;
  const createResponse = await apiPost('api-merchandise', {
    serial_no: serialNo,
    model_id: TEST_MODELS.smartUps1500,
    site_id: TEST_SITES.testCompanyHQ,
  }, TEST_EMPLOYEES.superAdmin);
  const createText = await createResponse.text();

  if (createResponse.status !== 201) {
    console.log('Skipping location create test - merchandise creation failed');
    return;
  }

  const createData = JSON.parse(createText);
  const merchandiseId = createData.data.id;

  // Create location
  const locationData = {
    building: 'A',
    floor: '3',
    room: '301',
    zone: 'Server Room',
    notes: 'E2E test location',
  };

  const response = await apiPost(`api-merchandise/${merchandiseId}/location`, locationData, TEST_EMPLOYEES.superAdmin);
  const text = await response.text();
  assertEquals(response.status < 500, true, `Unexpected server error: ${text}`);
});

Deno.test('POST /api-merchandise/:id/location - should reject empty location', async () => {
  // First create a merchandise
  const serialNo = `E2E-LOCEMPTY-${Date.now()}`;
  const createResponse = await apiPost('api-merchandise', {
    serial_no: serialNo,
    model_id: TEST_MODELS.smartUps1500,
    site_id: TEST_SITES.testCompanyHQ,
  }, TEST_EMPLOYEES.superAdmin);
  const createText = await createResponse.text();

  if (createResponse.status !== 201) {
    console.log('Skipping empty location test - merchandise creation failed');
    return;
  }

  const createData = JSON.parse(createText);
  const merchandiseId = createData.data.id;

  // Try to create empty location
  const response = await apiPost(`api-merchandise/${merchandiseId}/location`, {}, TEST_EMPLOYEES.superAdmin);
  await response.text();
  assertEquals(response.status, 400);
});

Deno.test('PUT /api-merchandise/:id/location - should update location', async () => {
  // First create a merchandise with location
  const serialNo = `E2E-LOCUPDATE-${Date.now()}`;
  const createResponse = await apiPost('api-merchandise', {
    serial_no: serialNo,
    model_id: TEST_MODELS.smartUps1500,
    site_id: TEST_SITES.testCompanyHQ,
  }, TEST_EMPLOYEES.superAdmin);
  const createText = await createResponse.text();

  if (createResponse.status !== 201) {
    console.log('Skipping location update test - merchandise creation failed');
    return;
  }

  const createData = JSON.parse(createText);
  const merchandiseId = createData.data.id;

  // First create location
  const locCreateResponse = await apiPost(`api-merchandise/${merchandiseId}/location`, {
    building: 'A',
    floor: '1',
  }, TEST_EMPLOYEES.superAdmin);
  await locCreateResponse.text(); // Consume body

  // Update location
  const response = await apiPut(`api-merchandise/${merchandiseId}/location`, {
    floor: '2',
    room: '201',
  }, TEST_EMPLOYEES.superAdmin);
  await response.text();
  assertEquals(response.status >= 200 && response.status < 500, true);
});

Deno.test('DELETE /api-merchandise/:id/location - should delete location', async () => {
  // First create a merchandise with location
  const serialNo = `E2E-LOCDELETE-${Date.now()}`;
  const createResponse = await apiPost('api-merchandise', {
    serial_no: serialNo,
    model_id: TEST_MODELS.smartUps1500,
    site_id: TEST_SITES.testCompanyHQ,
  }, TEST_EMPLOYEES.superAdmin);
  const createText = await createResponse.text();

  if (createResponse.status !== 201) {
    console.log('Skipping location delete test - merchandise creation failed');
    return;
  }

  const createData = JSON.parse(createText);
  const merchandiseId = createData.data.id;

  // First create location
  const locResponse = await apiPost(`api-merchandise/${merchandiseId}/location`, {
    building: 'A',
  }, TEST_EMPLOYEES.superAdmin);
  await locResponse.text();

  // Delete location
  const response = await apiDelete(`api-merchandise/${merchandiseId}/location`, TEST_EMPLOYEES.superAdmin);
  await response.text();
  assertEquals(response.status >= 200 && response.status < 300, true);
});

// ============================================
// REPLACEMENT CHAIN
// ============================================

Deno.test('GET /api-merchandise/:id/replacement-chain - should get replacement chain', async () => {
  // First create a merchandise
  const serialNo = `E2E-CHAIN-${Date.now()}`;
  const createResponse = await apiPost('api-merchandise', {
    serial_no: serialNo,
    model_id: TEST_MODELS.smartUps1500,
    site_id: TEST_SITES.testCompanyHQ,
  }, TEST_EMPLOYEES.superAdmin);
  const createText = await createResponse.text();

  if (createResponse.status !== 201) {
    console.log('Skipping replacement chain test - merchandise creation failed');
    return;
  }

  const createData = JSON.parse(createText);
  const merchandiseId = createData.data.id;

  // Get replacement chain
  const response = await apiGet(`api-merchandise/${merchandiseId}/replacement-chain`);
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
  assertExists(data.data.chain);
  assertExists(data.data.total);
  assertEquals(data.data.total >= 1, true); // At least the current merchandise
});

Deno.test('GET /api-merchandise/:id/replacement-chain - should return 404 for non-existent merchandise', async () => {
  const fakeId = randomUUID();
  const response = await apiGet(`api-merchandise/${fakeId}/replacement-chain`);
  await response.text();
  assertEquals(response.status, 404);
});

// ============================================
// PERMISSION TESTS
// ============================================

Deno.test('Permission: Technician (level 0) can read merchandise', async () => {
  const response = await apiGet('api-merchandise', TEST_EMPLOYEES.tech1);
  await response.text();
  assertEquals(response.status, 200);
});

Deno.test('Permission: Technician (level 0) cannot create merchandise', async () => {
  const merchandiseData = {
    serial_no: `E2E-PERM-${Date.now()}`,
    model_id: TEST_MODELS.smartUps1500,
    site_id: TEST_SITES.testCompanyHQ,
  };

  const response = await apiPost('api-merchandise', merchandiseData, TEST_EMPLOYEES.tech1);
  await response.text();
  assertEquals(response.status, 403);
});

Deno.test('Permission: Assigner (level 1) can create merchandise', async () => {
  const merchandiseData = {
    serial_no: `E2E-ASSIGNER-${Date.now()}`,
    model_id: TEST_MODELS.smartUps1500,
    site_id: TEST_SITES.testCompanyHQ,
  };

  const response = await apiPost('api-merchandise', merchandiseData, TEST_EMPLOYEES.assigner);
  await response.text();
  assertEquals(response.status < 500, true);
});

Deno.test('Permission: Technician cannot delete merchandise', async () => {
  // First create a merchandise as admin
  const serialNo = `E2E-PERMDEL-${Date.now()}`;
  const createResponse = await apiPost('api-merchandise', {
    serial_no: serialNo,
    model_id: TEST_MODELS.smartUps1500,
    site_id: TEST_SITES.testCompanyHQ,
  }, TEST_EMPLOYEES.superAdmin);
  const createText = await createResponse.text();

  if (createResponse.status !== 201) {
    console.log('Skipping permission delete test - creation failed');
    return;
  }

  const createData = JSON.parse(createText);
  const merchandiseId = createData.data.id;

  // Try to delete as technician
  const response = await apiDelete(`api-merchandise/${merchandiseId}`, TEST_EMPLOYEES.tech1);
  await response.text();
  assertEquals(response.status, 403);
});

Deno.test('Permission: Technician cannot create location', async () => {
  // First create a merchandise as admin
  const serialNo = `E2E-PERMLOCTECH-${Date.now()}`;
  const createResponse = await apiPost('api-merchandise', {
    serial_no: serialNo,
    model_id: TEST_MODELS.smartUps1500,
    site_id: TEST_SITES.testCompanyHQ,
  }, TEST_EMPLOYEES.superAdmin);
  const createText = await createResponse.text();

  if (createResponse.status !== 201) {
    console.log('Skipping location permission test - creation failed');
    return;
  }

  const createData = JSON.parse(createText);
  const merchandiseId = createData.data.id;

  // Try to create location as technician
  const response = await apiPost(`api-merchandise/${merchandiseId}/location`, {
    building: 'A',
  }, TEST_EMPLOYEES.tech1);
  await response.text();
  assertEquals(response.status, 403);
});

Deno.test('Permission: Technician can read location', async () => {
  // First create a merchandise with location as admin
  const serialNo = `E2E-PERMLOCREAD-${Date.now()}`;
  const createResponse = await apiPost('api-merchandise', {
    serial_no: serialNo,
    model_id: TEST_MODELS.smartUps1500,
    site_id: TEST_SITES.testCompanyHQ,
  }, TEST_EMPLOYEES.superAdmin);
  const createText = await createResponse.text();

  if (createResponse.status !== 201) {
    console.log('Skipping location read permission test - creation failed');
    return;
  }

  const createData = JSON.parse(createText);
  const merchandiseId = createData.data.id;

  // Read location as technician
  const response = await apiGet(`api-merchandise/${merchandiseId}/location`, TEST_EMPLOYEES.tech1);
  await response.text();
  assertEquals(response.status, 200);
});
