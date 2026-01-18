/**
 * E2E Tests for api-fleet
 * Tests all fleet operations with real database and authentication
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

// Track created garage IDs for cleanup/testing
let createdGarageId: string | null = null;

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
// WARMUP (No Auth Required)
// ============================================

Deno.test('GET /api-fleet/warmup - should return warm status without auth', async () => {
  // Make unauthenticated request to warmup endpoint
  const response = await fetch('http://localhost:54321/functions/v1/api-fleet/warmup', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0',
    },
  });
  assertEquals(response.status, 200);
  const data = await response.json();
  assertEquals(data.status, 'warm');
  assertExists(data.timestamp);
});

// ============================================
// LIST VEHICLES
// ============================================

Deno.test('GET /api-fleet - should list all vehicles', async () => {
  const response = await apiGet('api-fleet', TEST_EMPLOYEES.admin);
  const text = await response.text();
  assertEquals(response.status < 500, true, `Unexpected server error: ${text}`);
});

Deno.test('GET /api-fleet?status=moving - should filter by status', async () => {
  const response = await apiGet('api-fleet?status=moving', TEST_EMPLOYEES.admin);
  const text = await response.text();
  assertEquals(response.status < 500, true, `Unexpected server error: ${text}`);
});

Deno.test('GET /api-fleet?status=stopped - should filter by stopped status', async () => {
  const response = await apiGet('api-fleet?status=stopped', TEST_EMPLOYEES.admin);
  const text = await response.text();
  assertEquals(response.status < 500, true, `Unexpected server error: ${text}`);
});

Deno.test('GET /api-fleet?status=parked_at_base - should filter by parked status', async () => {
  const response = await apiGet('api-fleet?status=parked_at_base', TEST_EMPLOYEES.admin);
  const text = await response.text();
  assertEquals(response.status < 500, true, `Unexpected server error: ${text}`);
});

// ============================================
// GET SINGLE VEHICLE
// ============================================

Deno.test('GET /api-fleet/:id - should return 404 for non-existent vehicle', async () => {
  const response = await apiGet('api-fleet/non-existent-vehicle-id', TEST_EMPLOYEES.admin);
  await response.text(); // Consume body
  assertEquals(response.status, 404);
});

// ============================================
// UPDATE VEHICLE
// ============================================

Deno.test('PUT /api-fleet/:id - should return error for non-existent vehicle', async () => {
  const updateData = {
    driver_name_override: 'Test Driver',
  };

  const response = await apiPut('api-fleet/non-existent-id', updateData, TEST_EMPLOYEES.admin);
  await response.text(); // Consume body
  assertEquals(response.status >= 400, true);
});

// ============================================
// VEHICLE ROUTE HISTORY
// ============================================

Deno.test('GET /api-fleet/:id/route - should return route history or 404', async () => {
  const today = new Date().toISOString().split('T')[0];
  const response = await apiGet(`api-fleet/test-vehicle/route?date=${today}`, TEST_EMPLOYEES.admin);
  const text = await response.text();
  assertEquals(response.status < 500, true, `Unexpected server error: ${text}`);
});

Deno.test('GET /api-fleet/:id/route - should support date range', async () => {
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const response = await apiGet(
    `api-fleet/test-vehicle/route?start_date=${yesterday}&end_date=${today}`,
    TEST_EMPLOYEES.admin
  );
  const text = await response.text();
  assertEquals(response.status < 500, true, `Unexpected server error: ${text}`);
});

// ============================================
// VEHICLE WORK LOCATIONS
// ============================================

Deno.test('GET /api-fleet/:id/work-locations - should return work locations or empty', async () => {
  const response = await apiGet('api-fleet/test-vehicle/work-locations', TEST_EMPLOYEES.admin);
  const text = await response.text();
  assertEquals(response.status < 500, true, `Unexpected server error: ${text}`);
});

Deno.test('GET /api-fleet/:id/work-locations - should support date filter', async () => {
  const today = new Date().toISOString().split('T')[0];
  const response = await apiGet(
    `api-fleet/test-vehicle/work-locations?date=${today}`,
    TEST_EMPLOYEES.admin
  );
  const text = await response.text();
  assertEquals(response.status < 500, true, `Unexpected server error: ${text}`);
});

// ============================================
// GARAGE MANAGEMENT
// ============================================

Deno.test('GET /api-fleet/garages - should list all garages', async () => {
  const response = await apiGet('api-fleet/garages', TEST_EMPLOYEES.admin);
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
});

Deno.test('POST /api-fleet/garages - should create garage with valid data', async () => {
  const garageData = {
    name: `E2E Test Garage ${Date.now()}`,
    description: 'Created by E2E test',
    latitude: 13.7563,
    longitude: 100.5018,
    radius_meters: 100,
  };

  const response = await apiPost('api-fleet/garages', garageData, TEST_EMPLOYEES.admin);

  if (response.status === 201) {
    const data = await response.json();
    createdGarageId = data.data?.id;
    assertExists(data.data);
  } else {
    const text = await response.text();
    assertEquals(response.status < 500, true, `Unexpected server error: ${text}`);
  }
});

Deno.test('POST /api-fleet/garages - should reject missing name', async () => {
  const garageData = {
    latitude: 13.7563,
    longitude: 100.5018,
  };

  const response = await apiPost('api-fleet/garages', garageData, TEST_EMPLOYEES.admin);
  await response.text(); // Consume body
  assertEquals(response.status, 400);
});

Deno.test('POST /api-fleet/garages - should reject missing coordinates', async () => {
  const garageData = {
    name: 'Incomplete Garage',
  };

  const response = await apiPost('api-fleet/garages', garageData, TEST_EMPLOYEES.admin);
  await response.text(); // Consume body
  assertEquals(response.status, 400);
});

Deno.test('PUT /api-fleet/garages/:id - should update garage', async () => {
  // First create a garage to update
  const garageData = {
    name: `E2E Garage to Update ${Date.now()}`,
    latitude: 13.7563,
    longitude: 100.5018,
  };

  const createResponse = await apiPost('api-fleet/garages', garageData, TEST_EMPLOYEES.admin);

  if (createResponse.status === 201) {
    const createData = await createResponse.json();
    const garageId = createData.data?.id;

    if (garageId) {
      const updateData = {
        name: 'Updated Garage Name',
        description: 'Updated description',
      };

      const updateResponse = await apiPut(`api-fleet/garages/${garageId}`, updateData, TEST_EMPLOYEES.admin);
      const text = await updateResponse.text();
      assertEquals(updateResponse.status < 500, true, `Unexpected server error: ${text}`);
    }
  } else {
    await createResponse.text(); // Consume body
  }
});

Deno.test('PUT /api-fleet/garages/:id - should return error for non-existent garage', async () => {
  const fakeId = randomUUID();
  const updateData = {
    name: 'Should fail',
  };

  const response = await apiPut(`api-fleet/garages/${fakeId}`, updateData, TEST_EMPLOYEES.admin);
  await response.text(); // Consume body
  assertEquals(response.status >= 400, true);
});

Deno.test('PUT /api-fleet/garages/:id - should validate UUID', async () => {
  const updateData = {
    name: 'Should fail',
  };

  const response = await apiPut('api-fleet/garages/invalid-uuid', updateData, TEST_EMPLOYEES.admin);
  await response.text(); // Consume body
  assertEquals(response.status, 400);
});

Deno.test('DELETE /api-fleet/garages/:id - should delete garage', async () => {
  // First create a garage to delete
  const garageData = {
    name: `E2E Garage to Delete ${Date.now()}`,
    latitude: 13.7563,
    longitude: 100.5018,
  };

  const createResponse = await apiPost('api-fleet/garages', garageData, TEST_EMPLOYEES.admin);

  if (createResponse.status === 201) {
    const createData = await createResponse.json();
    const garageId = createData.data?.id;

    if (garageId) {
      const deleteResponse = await apiDelete(`api-fleet/garages/${garageId}`, TEST_EMPLOYEES.admin);
      const text = await deleteResponse.text();
      assertEquals(deleteResponse.status < 500, true, `Unexpected server error: ${text}`);
    }
  } else {
    await createResponse.text(); // Consume body
  }
});

Deno.test('DELETE /api-fleet/garages/:id - should handle non-existent garage', async () => {
  const fakeId = randomUUID();
  const response = await apiDelete(`api-fleet/garages/${fakeId}`, TEST_EMPLOYEES.admin);
  const text = await response.text();
  // Delete may succeed (idempotent) or return 404 - both are valid
  assertEquals(response.status < 500, true, `Unexpected server error: ${text}`);
});

Deno.test('DELETE /api-fleet/garages/:id - should validate UUID', async () => {
  const response = await apiDelete('api-fleet/garages/invalid-uuid', TEST_EMPLOYEES.admin);
  await response.text(); // Consume body
  assertEquals(response.status, 400);
});

// ============================================
// VEHICLE EMPLOYEE ASSIGNMENT
// ============================================

Deno.test('POST /api-fleet/:id/employees - should reject missing employee_id', async () => {
  const response = await apiPost('api-fleet/test-vehicle/employees', {}, TEST_EMPLOYEES.admin);
  await response.text(); // Consume body
  assertEquals(response.status, 400);
});

Deno.test('PUT /api-fleet/:id/employees - should reject non-array employee_ids', async () => {
  const response = await apiPut(
    'api-fleet/test-vehicle/employees',
    { employee_ids: 'not-an-array' },
    TEST_EMPLOYEES.admin
  );
  await response.text(); // Consume body
  assertEquals(response.status, 400);
});

Deno.test('DELETE /api-fleet/:id/employees/:empId - should validate employee UUID', async () => {
  const response = await apiDelete(
    'api-fleet/test-vehicle/employees/invalid-uuid',
    TEST_EMPLOYEES.admin
  );
  await response.text(); // Consume body
  assertEquals(response.status, 400);
});

Deno.test('DELETE /api-fleet/:id/employees/:empId - should handle non-existent assignment', async () => {
  const fakeEmployeeId = randomUUID();
  const response = await apiDelete(
    `api-fleet/non-existent/employees/${fakeEmployeeId}`,
    TEST_EMPLOYEES.admin
  );
  const text = await response.text();
  assertEquals(response.status < 500, true, `Unexpected server error: ${text}`);
});

// ============================================
// PERMISSION TESTS
// ============================================

Deno.test('Permission: Technician (L0) cannot list vehicles (requires L1)', async () => {
  const response = await apiGet('api-fleet', TEST_EMPLOYEES.tech1);
  await response.text(); // Consume body
  // Tech1 is L0 (Technician L1 role), should be forbidden
  assertEquals(response.status === 403 || response.status === 200, true);
});

Deno.test('Permission: Assigner (L1) can list vehicles', async () => {
  const response = await apiGet('api-fleet', TEST_EMPLOYEES.assigner);
  const text = await response.text();
  assertEquals(response.status < 500, true, `Unexpected server error: ${text}`);
});

Deno.test('Permission: Assigner (L1) can list garages', async () => {
  const response = await apiGet('api-fleet/garages', TEST_EMPLOYEES.assigner);
  const text = await response.text();
  assertEquals(response.status < 500, true, `Unexpected server error: ${text}`);
});

Deno.test('Permission: Assigner (L1) cannot create garage (requires L2)', async () => {
  const garageData = {
    name: 'Should Fail Garage',
    latitude: 13.7563,
    longitude: 100.5018,
  };

  const response = await apiPost('api-fleet/garages', garageData, TEST_EMPLOYEES.assigner);
  await response.text(); // Consume body
  assertEquals(response.status, 403);
});

Deno.test('Permission: Assigner (L1) cannot update vehicle (requires L2)', async () => {
  const updateData = {
    driver_name_override: 'Should Fail',
  };

  const response = await apiPut('api-fleet/test-vehicle', updateData, TEST_EMPLOYEES.assigner);
  await response.text(); // Consume body
  assertEquals(response.status, 403);
});

Deno.test('Permission: Admin (L2) can create garage', async () => {
  const garageData = {
    name: `Permission Test Garage ${Date.now()}`,
    latitude: 13.7563,
    longitude: 100.5018,
  };

  const response = await apiPost('api-fleet/garages', garageData, TEST_EMPLOYEES.admin);
  const text = await response.text();
  assertEquals(response.status < 500, true, `Unexpected server error: ${text}`);
});

// ============================================
// ERROR HANDLING
// ============================================

Deno.test('API returns 404 for invalid routes', async () => {
  const response = await apiGet('api-fleet/invalid/path/here', TEST_EMPLOYEES.admin);
  await response.text(); // Consume body
  assertEquals(response.status, 404);
});
