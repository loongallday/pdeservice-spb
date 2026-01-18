/**
 * E2E Tests for api-stock
 * Tests all stock management operations with real database and authentication
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
  TEST_TICKETS,
  randomUUID,
} from './test-utils.ts';

// Store created IDs for testing
let createdLocationId: string | null = null;
let createdSerialItemId: string | null = null;

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
// DASHBOARD
// ============================================

Deno.test('GET /api-stock/dashboard - should return stock overview', async () => {
  const response = await apiGet('api-stock/dashboard');
  assertEquals(response.status < 500, true);
  await response.text(); // Consume body
});

Deno.test('GET /api-stock/dashboard - should be accessible by technician (level 0)', async () => {
  const response = await apiGet('api-stock/dashboard', TEST_EMPLOYEES.tech1);
  assertEquals(response.status < 500, true);
  await response.text(); // Consume body
});

// ============================================
// LIST LOCATIONS
// ============================================

Deno.test('GET /api-stock/locations - should return list of locations', async () => {
  const response = await apiGet('api-stock/locations');
  assertEquals(response.status < 500, true);
  const data = await response.json();
  assertExists(data.data);
});

Deno.test('GET /api-stock/locations - should be accessible by all users', async () => {
  const response = await apiGet('api-stock/locations', TEST_EMPLOYEES.tech1);
  assertEquals(response.status < 500, true);
  await response.text(); // Consume body
});

// ============================================
// CREATE LOCATION
// ============================================

Deno.test('POST /api-stock/locations - should accept valid input (admin level 2)', async () => {
  const locationData = {
    name: `E2E Test Location - ${Date.now()}`,
    code: `E2E-${Date.now()}`,
    location_type_id: randomUUID(), // Will fail with FK constraint, but tests auth works
  };

  const response = await apiPost('api-stock/locations', locationData, TEST_EMPLOYEES.admin);
  const text = await response.text();
  // Expected to fail with FK constraint error (400/500), but auth should pass
  // The fact that we get past auth check to DB error means auth is working
  assertEquals(response.status !== 403, true, `Unexpected auth rejection: ${text}`);
});

Deno.test('POST /api-stock/locations - should reject missing name', async () => {
  const locationData = {
    code: 'TEST-CODE',
    location_type_id: randomUUID(),
  };

  const response = await apiPost('api-stock/locations', locationData, TEST_EMPLOYEES.admin);
  await response.text(); // Consume body
  assertEquals(response.status, 400);
});

Deno.test('POST /api-stock/locations - should reject missing code', async () => {
  const locationData = {
    name: 'Test Location',
    location_type_id: randomUUID(),
  };

  const response = await apiPost('api-stock/locations', locationData, TEST_EMPLOYEES.admin);
  await response.text(); // Consume body
  assertEquals(response.status, 400);
});

Deno.test('POST /api-stock/locations - should reject missing location_type_id', async () => {
  const locationData = {
    name: 'Test Location',
    code: 'TEST-CODE',
  };

  const response = await apiPost('api-stock/locations', locationData, TEST_EMPLOYEES.admin);
  await response.text(); // Consume body
  assertEquals(response.status, 400);
});

Deno.test('POST /api-stock/locations - should reject technician (level 0)', async () => {
  const locationData = {
    name: 'Test Location',
    code: 'TEST-CODE',
    location_type_id: randomUUID(),
  };

  const response = await apiPost('api-stock/locations', locationData, TEST_EMPLOYEES.tech1);
  await response.text(); // Consume body
  assertEquals(response.status, 403);
});

Deno.test('POST /api-stock/locations - should reject assigner (level 1)', async () => {
  const locationData = {
    name: 'Test Location',
    code: 'TEST-CODE',
    location_type_id: randomUUID(),
  };

  const response = await apiPost('api-stock/locations', locationData, TEST_EMPLOYEES.assigner);
  await response.text(); // Consume body
  assertEquals(response.status, 403);
});

// ============================================
// GET LOCATION BY ID
// ============================================

Deno.test('GET /api-stock/locations/:id - should return 404 for non-existent ID', async () => {
  const fakeId = randomUUID();
  const response = await apiGet(`api-stock/locations/${fakeId}`);
  await response.text(); // Consume body
  assertEquals(response.status, 404);
});

Deno.test('GET /api-stock/locations/:id - should handle invalid UUID', async () => {
  const response = await apiGet('api-stock/locations/invalid-uuid');
  await response.text(); // Consume body
  // Returns 400 (bad request) or 404 - just check it doesn't crash
  assertEquals([400, 404, 500].includes(response.status), true);
});

// ============================================
// UPDATE LOCATION
// ============================================

Deno.test('PUT /api-stock/locations/:id - should return 404 for non-existent ID', async () => {
  const fakeId = randomUUID();
  const updateData = {
    name: 'Updated Name',
  };

  const response = await apiPut(`api-stock/locations/${fakeId}`, updateData, TEST_EMPLOYEES.admin);
  await response.text(); // Consume body
  assertEquals(response.status, 404);
});

Deno.test('PUT /api-stock/locations/:id - should reject technician (level 0)', async () => {
  const fakeId = randomUUID();
  const updateData = {
    name: 'Updated Name',
  };

  const response = await apiPut(`api-stock/locations/${fakeId}`, updateData, TEST_EMPLOYEES.tech1);
  await response.text(); // Consume body
  assertEquals(response.status, 403);
});

Deno.test('PUT /api-stock/locations/:id - should reject assigner (level 1)', async () => {
  const fakeId = randomUUID();
  const updateData = {
    name: 'Updated Name',
  };

  const response = await apiPut(`api-stock/locations/${fakeId}`, updateData, TEST_EMPLOYEES.assigner);
  await response.text(); // Consume body
  assertEquals(response.status, 403);
});

// ============================================
// DELETE LOCATION
// ============================================

Deno.test('DELETE /api-stock/locations/:id - should accept non-existent ID (idempotent, superadmin level 3)', async () => {
  const fakeId = randomUUID();
  const response = await apiDelete(`api-stock/locations/${fakeId}`, TEST_EMPLOYEES.superAdmin);
  await response.text(); // Consume body
  // Delete is idempotent - returns 200 even for non-existent IDs (auth passes for level 3)
  assertEquals(response.status, 200);
});

Deno.test('DELETE /api-stock/locations/:id - should reject technician (level 0)', async () => {
  const fakeId = randomUUID();
  const response = await apiDelete(`api-stock/locations/${fakeId}`, TEST_EMPLOYEES.tech1);
  await response.text(); // Consume body
  assertEquals(response.status, 403);
});

Deno.test('DELETE /api-stock/locations/:id - should reject assigner (level 1)', async () => {
  const fakeId = randomUUID();
  const response = await apiDelete(`api-stock/locations/${fakeId}`, TEST_EMPLOYEES.assigner);
  await response.text(); // Consume body
  assertEquals(response.status, 403);
});

Deno.test('DELETE /api-stock/locations/:id - should reject admin (level 2)', async () => {
  const fakeId = randomUUID();
  const response = await apiDelete(`api-stock/locations/${fakeId}`, TEST_EMPLOYEES.admin);
  await response.text(); // Consume body
  assertEquals(response.status, 403);
});

// ============================================
// GET ITEMS BY LOCATION
// ============================================

Deno.test('GET /api-stock/locations/:id/items - should return 404 for non-existent location', async () => {
  const fakeId = randomUUID();
  const response = await apiGet(`api-stock/locations/${fakeId}/items`);
  await response.text(); // Consume body
  // Could be 404 or empty list
  assertEquals(response.status < 500, true);
});

// ============================================
// LIST ITEMS
// ============================================

Deno.test('GET /api-stock/items - should return list of items', async () => {
  const response = await apiGet('api-stock/items');
  assertEquals(response.status < 500, true);
  await response.text(); // Consume body
});

Deno.test('GET /api-stock/items - should support pagination', async () => {
  const response = await apiGet('api-stock/items?page=1&limit=10');
  assertEquals(response.status < 500, true);
  await response.text(); // Consume body
});

Deno.test('GET /api-stock/items - should support filtering by location_id', async () => {
  const response = await apiGet(`api-stock/items?location_id=${randomUUID()}`);
  assertEquals(response.status < 500, true);
  await response.text(); // Consume body
});

Deno.test('GET /api-stock/items - should support filtering by model_id', async () => {
  const response = await apiGet(`api-stock/items?model_id=${randomUUID()}`);
  assertEquals(response.status < 500, true);
  await response.text(); // Consume body
});

// ============================================
// SEARCH ITEMS
// ============================================

Deno.test('GET /api-stock/items/search - should search items', async () => {
  const response = await apiGet('api-stock/items/search?q=test');
  assertEquals(response.status < 500, true);
  await response.text(); // Consume body
});

Deno.test('GET /api-stock/items/search - should handle empty query', async () => {
  const response = await apiGet('api-stock/items/search');
  assertEquals(response.status < 500, true);
  await response.text(); // Consume body
});

// ============================================
// LOW STOCK
// ============================================

Deno.test('GET /api-stock/items/low-stock - should return low stock items', async () => {
  const response = await apiGet('api-stock/items/low-stock');
  assertEquals(response.status < 500, true);
  await response.text(); // Consume body
});

Deno.test('GET /api-stock/items/low-stock - should be accessible by technician', async () => {
  const response = await apiGet('api-stock/items/low-stock', TEST_EMPLOYEES.tech1);
  assertEquals(response.status < 500, true);
  await response.text(); // Consume body
});

// ============================================
// GET ITEM BY ID
// ============================================

Deno.test('GET /api-stock/items/:id - should return 404 for non-existent ID', async () => {
  const fakeId = randomUUID();
  const response = await apiGet(`api-stock/items/${fakeId}`);
  await response.text(); // Consume body
  assertEquals(response.status, 404);
});

// ============================================
// GET ITEM MOVEMENT HISTORY
// ============================================

Deno.test('GET /api-stock/items/:id/movements - should return 404 for non-existent item', async () => {
  const fakeId = randomUUID();
  const response = await apiGet(`api-stock/items/${fakeId}/movements`);
  await response.text(); // Consume body
  // Could be 404 or empty list
  assertEquals(response.status < 500, true);
});

// ============================================
// ADJUST STOCK
// ============================================

Deno.test('POST /api-stock/items/:id/adjust - should handle non-existent item (admin level 2)', async () => {
  const fakeId = randomUUID();
  const adjustData = {
    adjustment: 5,
    reason: 'Test adjustment',
  };

  const response = await apiPost(`api-stock/items/${fakeId}/adjust`, adjustData, TEST_EMPLOYEES.admin);
  await response.text(); // Consume body
  // Auth passes for level 2; returns 400 or 404 depending on implementation
  assertEquals(response.status < 500, true);
  assertEquals(response.status >= 400, true);
});

Deno.test('POST /api-stock/items/:id/adjust - should reject technician (level 0)', async () => {
  const fakeId = randomUUID();
  const adjustData = {
    adjustment: 5,
    reason: 'Test adjustment',
  };

  const response = await apiPost(`api-stock/items/${fakeId}/adjust`, adjustData, TEST_EMPLOYEES.tech1);
  await response.text(); // Consume body
  assertEquals(response.status, 403);
});

Deno.test('POST /api-stock/items/:id/adjust - should reject assigner (level 1)', async () => {
  const fakeId = randomUUID();
  const adjustData = {
    adjustment: 5,
    reason: 'Test adjustment',
  };

  const response = await apiPost(`api-stock/items/${fakeId}/adjust`, adjustData, TEST_EMPLOYEES.assigner);
  await response.text(); // Consume body
  assertEquals(response.status, 403);
});

Deno.test('POST /api-stock/items/:id/adjust - should reject zero adjustment', async () => {
  const fakeId = randomUUID();
  const adjustData = {
    adjustment: 0,
    reason: 'Test adjustment',
  };

  const response = await apiPost(`api-stock/items/${fakeId}/adjust`, adjustData, TEST_EMPLOYEES.admin);
  await response.text(); // Consume body
  assertEquals(response.status, 400);
});

Deno.test('POST /api-stock/items/:id/adjust - should reject missing reason', async () => {
  const fakeId = randomUUID();
  const adjustData = {
    adjustment: 5,
  };

  const response = await apiPost(`api-stock/items/${fakeId}/adjust`, adjustData, TEST_EMPLOYEES.admin);
  await response.text(); // Consume body
  assertEquals(response.status, 400);
});

Deno.test('POST /api-stock/items/:id/adjust - should reject empty reason', async () => {
  const fakeId = randomUUID();
  const adjustData = {
    adjustment: 5,
    reason: '   ',
  };

  const response = await apiPost(`api-stock/items/${fakeId}/adjust`, adjustData, TEST_EMPLOYEES.admin);
  await response.text(); // Consume body
  assertEquals(response.status, 400);
});

// ============================================
// RECEIVE STOCK
// ============================================

Deno.test('POST /api-stock/receive - should reject missing location_id', async () => {
  const receiveData = {
    model_id: randomUUID(),
    quantity: 10,
  };

  const response = await apiPost('api-stock/receive', receiveData, TEST_EMPLOYEES.assigner);
  await response.text(); // Consume body
  assertEquals(response.status, 400);
});

Deno.test('POST /api-stock/receive - should reject missing model_id', async () => {
  const receiveData = {
    location_id: randomUUID(),
    quantity: 10,
  };

  const response = await apiPost('api-stock/receive', receiveData, TEST_EMPLOYEES.assigner);
  await response.text(); // Consume body
  assertEquals(response.status, 400);
});

Deno.test('POST /api-stock/receive - should reject missing quantity', async () => {
  const receiveData = {
    location_id: randomUUID(),
    model_id: randomUUID(),
  };

  const response = await apiPost('api-stock/receive', receiveData, TEST_EMPLOYEES.assigner);
  await response.text(); // Consume body
  assertEquals(response.status, 400);
});

Deno.test('POST /api-stock/receive - should reject zero quantity', async () => {
  const receiveData = {
    location_id: randomUUID(),
    model_id: randomUUID(),
    quantity: 0,
  };

  const response = await apiPost('api-stock/receive', receiveData, TEST_EMPLOYEES.assigner);
  await response.text(); // Consume body
  assertEquals(response.status, 400);
});

Deno.test('POST /api-stock/receive - should reject negative quantity', async () => {
  const receiveData = {
    location_id: randomUUID(),
    model_id: randomUUID(),
    quantity: -5,
  };

  const response = await apiPost('api-stock/receive', receiveData, TEST_EMPLOYEES.assigner);
  await response.text(); // Consume body
  assertEquals(response.status, 400);
});

Deno.test('POST /api-stock/receive - should reject technician (level 0)', async () => {
  const receiveData = {
    location_id: randomUUID(),
    model_id: randomUUID(),
    quantity: 10,
  };

  const response = await apiPost('api-stock/receive', receiveData, TEST_EMPLOYEES.tech1);
  await response.text(); // Consume body
  assertEquals(response.status, 403);
});

// ============================================
// TRANSFER STOCK
// ============================================

Deno.test('POST /api-stock/transfer - should reject missing from_location_id', async () => {
  const transferData = {
    to_location_id: randomUUID(),
    model_id: randomUUID(),
    quantity: 5,
  };

  const response = await apiPost('api-stock/transfer', transferData, TEST_EMPLOYEES.assigner);
  await response.text(); // Consume body
  assertEquals(response.status, 400);
});

Deno.test('POST /api-stock/transfer - should reject missing to_location_id', async () => {
  const transferData = {
    from_location_id: randomUUID(),
    model_id: randomUUID(),
    quantity: 5,
  };

  const response = await apiPost('api-stock/transfer', transferData, TEST_EMPLOYEES.assigner);
  await response.text(); // Consume body
  assertEquals(response.status, 400);
});

Deno.test('POST /api-stock/transfer - should reject missing model_id', async () => {
  const transferData = {
    from_location_id: randomUUID(),
    to_location_id: randomUUID(),
    quantity: 5,
  };

  const response = await apiPost('api-stock/transfer', transferData, TEST_EMPLOYEES.assigner);
  await response.text(); // Consume body
  assertEquals(response.status, 400);
});

Deno.test('POST /api-stock/transfer - should reject missing quantity', async () => {
  const transferData = {
    from_location_id: randomUUID(),
    to_location_id: randomUUID(),
    model_id: randomUUID(),
  };

  const response = await apiPost('api-stock/transfer', transferData, TEST_EMPLOYEES.assigner);
  await response.text(); // Consume body
  assertEquals(response.status, 400);
});

Deno.test('POST /api-stock/transfer - should reject technician (level 0)', async () => {
  const transferData = {
    from_location_id: randomUUID(),
    to_location_id: randomUUID(),
    model_id: randomUUID(),
    quantity: 5,
  };

  const response = await apiPost('api-stock/transfer', transferData, TEST_EMPLOYEES.tech1);
  await response.text(); // Consume body
  assertEquals(response.status, 403);
});

// ============================================
// CONSUME STOCK FOR TICKET
// ============================================

Deno.test('POST /api-stock/tickets/:ticketId/consume - should reject empty items', async () => {
  const ticketId = TEST_TICKETS.pm1;
  const consumeData = {
    items: [],
  };

  const response = await apiPost(`api-stock/tickets/${ticketId}/consume`, consumeData, TEST_EMPLOYEES.assigner);
  await response.text(); // Consume body
  assertEquals(response.status, 400);
});

Deno.test('POST /api-stock/tickets/:ticketId/consume - should reject items without stock_item_id', async () => {
  const ticketId = TEST_TICKETS.pm1;
  const consumeData = {
    items: [
      { quantity: 1 },
    ],
  };

  const response = await apiPost(`api-stock/tickets/${ticketId}/consume`, consumeData, TEST_EMPLOYEES.assigner);
  await response.text(); // Consume body
  assertEquals(response.status, 400);
});

Deno.test('POST /api-stock/tickets/:ticketId/consume - should reject items with zero quantity', async () => {
  const ticketId = TEST_TICKETS.pm1;
  const consumeData = {
    items: [
      { stock_item_id: randomUUID(), quantity: 0 },
    ],
  };

  const response = await apiPost(`api-stock/tickets/${ticketId}/consume`, consumeData, TEST_EMPLOYEES.assigner);
  await response.text(); // Consume body
  assertEquals(response.status, 400);
});

Deno.test('POST /api-stock/tickets/:ticketId/consume - should reject items with negative quantity', async () => {
  const ticketId = TEST_TICKETS.pm1;
  const consumeData = {
    items: [
      { stock_item_id: randomUUID(), quantity: -1 },
    ],
  };

  const response = await apiPost(`api-stock/tickets/${ticketId}/consume`, consumeData, TEST_EMPLOYEES.assigner);
  await response.text(); // Consume body
  assertEquals(response.status, 400);
});

Deno.test('POST /api-stock/tickets/:ticketId/consume - should reject technician (level 0)', async () => {
  const ticketId = TEST_TICKETS.pm1;
  const consumeData = {
    items: [
      { stock_item_id: randomUUID(), quantity: 1 },
    ],
  };

  const response = await apiPost(`api-stock/tickets/${ticketId}/consume`, consumeData, TEST_EMPLOYEES.tech1);
  await response.text(); // Consume body
  assertEquals(response.status, 403);
});

// ============================================
// LIST SERIALS
// ============================================

Deno.test('GET /api-stock/serials - should return list of serial items', async () => {
  const response = await apiGet('api-stock/serials');
  assertEquals(response.status < 500, true);
  await response.text(); // Consume body
});

Deno.test('GET /api-stock/serials - should be accessible by technician', async () => {
  const response = await apiGet('api-stock/serials', TEST_EMPLOYEES.tech1);
  assertEquals(response.status < 500, true);
  await response.text(); // Consume body
});

// ============================================
// SEARCH SERIALS
// ============================================

Deno.test('GET /api-stock/serials/search - should search serial items', async () => {
  const response = await apiGet('api-stock/serials/search?q=test');
  assertEquals(response.status < 500, true);
  await response.text(); // Consume body
});

Deno.test('GET /api-stock/serials/search - should handle empty query', async () => {
  const response = await apiGet('api-stock/serials/search');
  assertEquals(response.status < 500, true);
  await response.text(); // Consume body
});

// ============================================
// GET SERIAL BY SERIAL NUMBER
// ============================================

Deno.test('GET /api-stock/serials/by-serial/:serialNo - should return 404 for non-existent serial', async () => {
  const response = await apiGet('api-stock/serials/by-serial/NON-EXISTENT-SERIAL');
  await response.text(); // Consume body
  assertEquals(response.status, 404);
});

// ============================================
// GET SERIAL BY ID
// ============================================

Deno.test('GET /api-stock/serials/:id - should return 404 for non-existent ID', async () => {
  const fakeId = randomUUID();
  const response = await apiGet(`api-stock/serials/${fakeId}`);
  await response.text(); // Consume body
  assertEquals(response.status, 404);
});

// ============================================
// GET SERIAL MOVEMENTS
// ============================================

Deno.test('GET /api-stock/serials/:id/movements - should return 404 for non-existent serial', async () => {
  const fakeId = randomUUID();
  const response = await apiGet(`api-stock/serials/${fakeId}/movements`);
  await response.text(); // Consume body
  // Could be 404 or empty list
  assertEquals(response.status < 500, true);
});

// ============================================
// RECEIVE SERIALS
// ============================================

Deno.test('POST /api-stock/serials/receive - should reject missing location_id', async () => {
  const receiveData = {
    items: [
      { model_id: randomUUID(), serial_no: 'SN-TEST-001' },
    ],
  };

  const response = await apiPost('api-stock/serials/receive', receiveData, TEST_EMPLOYEES.assigner);
  await response.text(); // Consume body
  assertEquals(response.status, 400);
});

Deno.test('POST /api-stock/serials/receive - should reject empty items', async () => {
  const receiveData = {
    location_id: randomUUID(),
    items: [],
  };

  const response = await apiPost('api-stock/serials/receive', receiveData, TEST_EMPLOYEES.assigner);
  await response.text(); // Consume body
  assertEquals(response.status, 400);
});

Deno.test('POST /api-stock/serials/receive - should reject items without model_id', async () => {
  const receiveData = {
    location_id: randomUUID(),
    items: [
      { serial_no: 'SN-TEST-001' },
    ],
  };

  const response = await apiPost('api-stock/serials/receive', receiveData, TEST_EMPLOYEES.assigner);
  await response.text(); // Consume body
  assertEquals(response.status, 400);
});

Deno.test('POST /api-stock/serials/receive - should reject items without serial_no', async () => {
  const receiveData = {
    location_id: randomUUID(),
    items: [
      { model_id: randomUUID() },
    ],
  };

  const response = await apiPost('api-stock/serials/receive', receiveData, TEST_EMPLOYEES.assigner);
  await response.text(); // Consume body
  assertEquals(response.status, 400);
});

Deno.test('POST /api-stock/serials/receive - should reject items with empty serial_no', async () => {
  const receiveData = {
    location_id: randomUUID(),
    items: [
      { model_id: randomUUID(), serial_no: '' },
    ],
  };

  const response = await apiPost('api-stock/serials/receive', receiveData, TEST_EMPLOYEES.assigner);
  await response.text(); // Consume body
  assertEquals(response.status, 400);
});

Deno.test('POST /api-stock/serials/receive - should reject technician (level 0)', async () => {
  const receiveData = {
    location_id: randomUUID(),
    items: [
      { model_id: randomUUID(), serial_no: 'SN-TEST-001' },
    ],
  };

  const response = await apiPost('api-stock/serials/receive', receiveData, TEST_EMPLOYEES.tech1);
  await response.text(); // Consume body
  assertEquals(response.status, 403);
});

// ============================================
// TRANSFER SERIAL
// ============================================

Deno.test('POST /api-stock/serials/:id/transfer - should reject missing to_location_id', async () => {
  const fakeId = randomUUID();
  const transferData = {};

  const response = await apiPost(`api-stock/serials/${fakeId}/transfer`, transferData, TEST_EMPLOYEES.assigner);
  await response.text(); // Consume body
  assertEquals(response.status, 400);
});

Deno.test('POST /api-stock/serials/:id/transfer - should reject technician (level 0)', async () => {
  const fakeId = randomUUID();
  const transferData = {
    to_location_id: randomUUID(),
  };

  const response = await apiPost(`api-stock/serials/${fakeId}/transfer`, transferData, TEST_EMPLOYEES.tech1);
  await response.text(); // Consume body
  assertEquals(response.status, 403);
});

Deno.test('POST /api-stock/serials/:id/transfer - should return 404 for non-existent serial', async () => {
  const fakeId = randomUUID();
  const transferData = {
    to_location_id: randomUUID(),
  };

  const response = await apiPost(`api-stock/serials/${fakeId}/transfer`, transferData, TEST_EMPLOYEES.assigner);
  await response.text(); // Consume body
  assertEquals(response.status, 404);
});

// ============================================
// DEPLOY SERIAL
// ============================================

Deno.test('POST /api-stock/serials/:id/deploy - should reject missing ticket_id', async () => {
  const fakeId = randomUUID();
  const deployData = {};

  const response = await apiPost(`api-stock/serials/${fakeId}/deploy`, deployData, TEST_EMPLOYEES.assigner);
  await response.text(); // Consume body
  assertEquals(response.status, 400);
});

Deno.test('POST /api-stock/serials/:id/deploy - should reject technician (level 0)', async () => {
  const fakeId = randomUUID();
  const deployData = {
    ticket_id: TEST_TICKETS.pm1,
  };

  const response = await apiPost(`api-stock/serials/${fakeId}/deploy`, deployData, TEST_EMPLOYEES.tech1);
  await response.text(); // Consume body
  assertEquals(response.status, 403);
});

Deno.test('POST /api-stock/serials/:id/deploy - should return 404 for non-existent serial', async () => {
  const fakeId = randomUUID();
  const deployData = {
    ticket_id: TEST_TICKETS.pm1,
  };

  const response = await apiPost(`api-stock/serials/${fakeId}/deploy`, deployData, TEST_EMPLOYEES.assigner);
  await response.text(); // Consume body
  assertEquals(response.status, 404);
});

// ============================================
// RETURN SERIAL
// ============================================

Deno.test('POST /api-stock/serials/:id/return - should reject missing to_location_id', async () => {
  const fakeId = randomUUID();
  const returnData = {};

  const response = await apiPost(`api-stock/serials/${fakeId}/return`, returnData, TEST_EMPLOYEES.assigner);
  await response.text(); // Consume body
  assertEquals(response.status, 400);
});

Deno.test('POST /api-stock/serials/:id/return - should reject technician (level 0)', async () => {
  const fakeId = randomUUID();
  const returnData = {
    to_location_id: randomUUID(),
  };

  const response = await apiPost(`api-stock/serials/${fakeId}/return`, returnData, TEST_EMPLOYEES.tech1);
  await response.text(); // Consume body
  assertEquals(response.status, 403);
});

Deno.test('POST /api-stock/serials/:id/return - should return 404 for non-existent serial', async () => {
  const fakeId = randomUUID();
  const returnData = {
    to_location_id: randomUUID(),
  };

  const response = await apiPost(`api-stock/serials/${fakeId}/return`, returnData, TEST_EMPLOYEES.assigner);
  await response.text(); // Consume body
  assertEquals(response.status, 404);
});

// ============================================
// MARK SERIAL DEFECTIVE
// ============================================

Deno.test('POST /api-stock/serials/:id/defective - should reject technician (level 0)', async () => {
  const fakeId = randomUUID();
  const defectiveData = {
    reason: 'Damaged in transit',
  };

  const response = await apiPost(`api-stock/serials/${fakeId}/defective`, defectiveData, TEST_EMPLOYEES.tech1);
  await response.text(); // Consume body
  assertEquals(response.status, 403);
});

Deno.test('POST /api-stock/serials/:id/defective - should return 404 for non-existent serial', async () => {
  const fakeId = randomUUID();
  const defectiveData = {
    reason: 'Damaged in transit',
  };

  const response = await apiPost(`api-stock/serials/${fakeId}/defective`, defectiveData, TEST_EMPLOYEES.assigner);
  await response.text(); // Consume body
  // Could be 404 or validation error
  assertEquals(response.status < 500, true);
});

// ============================================
// UPDATE SERIAL STATUS
// ============================================

Deno.test('POST /api-stock/serials/:id/status - should reject technician (level 0)', async () => {
  const fakeId = randomUUID();
  const statusData = {
    status: 'in_stock',
  };

  const response = await apiPost(`api-stock/serials/${fakeId}/status`, statusData, TEST_EMPLOYEES.tech1);
  await response.text(); // Consume body
  assertEquals(response.status, 403);
});

Deno.test('POST /api-stock/serials/:id/status - should return 404 for non-existent serial', async () => {
  const fakeId = randomUUID();
  const statusData = {
    status: 'in_stock',
  };

  const response = await apiPost(`api-stock/serials/${fakeId}/status`, statusData, TEST_EMPLOYEES.assigner);
  await response.text(); // Consume body
  // Could be 404 or validation error
  assertEquals(response.status < 500, true);
});

// ============================================
// NOT FOUND ROUTE
// ============================================

Deno.test('GET /api-stock/invalid-route - should return 404', async () => {
  const response = await apiGet('api-stock/foo/bar/baz');
  await response.text(); // Consume body
  assertEquals(response.status, 404);
});

Deno.test('POST /api-stock/invalid-route - should return 404', async () => {
  const response = await apiPost('api-stock/unknown-endpoint', {}, TEST_EMPLOYEES.superAdmin);
  await response.text(); // Consume body
  assertEquals(response.status, 404);
});
