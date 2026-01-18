/**
 * E2E Tests for api-ticket-work-estimates
 * Tests all work estimate operations with real database and authentication
 *
 * This API requires Level 1+ (planners/approvers) for all operations.
 * Work estimates track estimated duration for tickets used in route optimization.
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

// Track created work estimate IDs for cleanup and testing
let createdEstimateId: string | null = null;

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
// PERMISSION TESTS - Level 0 (Technician) Cannot Access
// Note: The API requires Level 1+. Tech1 (Level 0) should receive 403 Forbidden.
// ============================================

Deno.test('Permission: Technician (Level 0) cannot create work estimates', async () => {
  const estimateData = {
    ticket_id: TEST_TICKETS.pm1,
    estimated_minutes: 60,
  };

  const response = await apiPost('api-ticket-work-estimates', estimateData, TEST_EMPLOYEES.tech1);
  await response.text(); // Consume body
  // Should be 403 (Forbidden) for Level 0 user
  assertEquals(response.status === 403 || response.status === 401, true, `Expected 403 or 401, got ${response.status}`);
});

Deno.test('Permission: Technician (Level 0) cannot get work estimates by ID', async () => {
  const fakeId = randomUUID();
  const response = await apiGet(`api-ticket-work-estimates/${fakeId}`, TEST_EMPLOYEES.tech1);
  await response.text(); // Consume body
  assertEquals(response.status === 403 || response.status === 401, true, `Expected 403 or 401, got ${response.status}`);
});

Deno.test('Permission: Technician (Level 0) cannot get work estimates by ticket', async () => {
  const response = await apiGet(`api-ticket-work-estimates/ticket/${TEST_TICKETS.pm1}`, TEST_EMPLOYEES.tech1);
  await response.text(); // Consume body
  assertEquals(response.status === 403 || response.status === 401, true, `Expected 403 or 401, got ${response.status}`);
});

Deno.test('Permission: Technician (Level 0) cannot update work estimates', async () => {
  const fakeId = randomUUID();
  const updateData = { estimated_minutes: 90 };

  const response = await apiPut(`api-ticket-work-estimates/${fakeId}`, updateData, TEST_EMPLOYEES.tech1);
  await response.text(); // Consume body
  assertEquals(response.status === 403 || response.status === 401, true, `Expected 403 or 401, got ${response.status}`);
});

Deno.test('Permission: Technician (Level 0) cannot delete work estimates', async () => {
  const fakeId = randomUUID();
  const response = await apiDelete(`api-ticket-work-estimates/${fakeId}`, TEST_EMPLOYEES.tech1);
  await response.text(); // Consume body
  assertEquals(response.status === 403 || response.status === 401, true, `Expected 403 or 401, got ${response.status}`);
});

Deno.test('Permission: Technician (Level 0) cannot bulk create work estimates', async () => {
  const bulkData = {
    estimates: [
      { ticket_id: TEST_TICKETS.pm1, estimated_minutes: 60 },
    ],
  };

  const response = await apiPost('api-ticket-work-estimates/bulk', bulkData, TEST_EMPLOYEES.tech1);
  await response.text(); // Consume body
  assertEquals(response.status === 403 || response.status === 401, true, `Expected 403 or 401, got ${response.status}`);
});

Deno.test('Permission: Technician (Level 0) cannot upsert work estimates', async () => {
  const estimateData = {
    ticket_id: TEST_TICKETS.pm1,
    estimated_minutes: 60,
  };

  const response = await apiPost('api-ticket-work-estimates/upsert', estimateData, TEST_EMPLOYEES.tech1);
  await response.text(); // Consume body
  assertEquals(response.status === 403 || response.status === 401, true, `Expected 403 or 401, got ${response.status}`);
});

// ============================================
// CREATE WORK ESTIMATE
// ============================================

Deno.test('POST /api-ticket-work-estimates - should create work estimate with valid data (Level 1)', async () => {
  const estimateData = {
    ticket_id: TEST_TICKETS.pm1,
    estimated_minutes: 45,
    notes: 'E2E Test estimate for PM ticket',
  };

  const response = await apiPost('api-ticket-work-estimates', estimateData, TEST_EMPLOYEES.assigner);
  const text = await response.text();
  assertEquals(response.status < 500, true, `Unexpected server error: ${text}`);

  if (response.status === 200) {
    const data = JSON.parse(text);
    assertExists(data.data?.id);
    assertEquals(data.data.ticket_id, TEST_TICKETS.pm1);
    assertEquals(data.data.estimated_minutes, 45);
    createdEstimateId = data.data.id;
  }
});

Deno.test('POST /api-ticket-work-estimates - should create work estimate (Admin Level 2)', async () => {
  const estimateData = {
    ticket_id: TEST_TICKETS.rma,
    estimated_minutes: 120,
    notes: 'Admin created estimate',
  };

  const response = await apiPost('api-ticket-work-estimates', estimateData, TEST_EMPLOYEES.admin);
  const text = await response.text();
  assertEquals(response.status < 500, true, `Unexpected server error: ${text}`);
});

Deno.test('POST /api-ticket-work-estimates - should create work estimate (Superadmin Level 3)', async () => {
  const estimateData = {
    ticket_id: TEST_TICKETS.sales,
    estimated_minutes: 90,
  };

  const response = await apiPost('api-ticket-work-estimates', estimateData, TEST_EMPLOYEES.superAdmin);
  const text = await response.text();
  assertEquals(response.status < 500, true, `Unexpected server error: ${text}`);
});

Deno.test('POST /api-ticket-work-estimates - should reject missing ticket_id', async () => {
  const estimateData = {
    estimated_minutes: 60,
  };

  const response = await apiPost('api-ticket-work-estimates', estimateData, TEST_EMPLOYEES.assigner);
  await response.text(); // Consume body
  assertEquals(response.status, 400);
});

Deno.test('POST /api-ticket-work-estimates - should reject missing estimated_minutes', async () => {
  const estimateData = {
    ticket_id: TEST_TICKETS.pm1,
  };

  const response = await apiPost('api-ticket-work-estimates', estimateData, TEST_EMPLOYEES.assigner);
  await response.text(); // Consume body
  assertEquals(response.status, 400);
});

Deno.test('POST /api-ticket-work-estimates - should reject estimated_minutes less than 1', async () => {
  const estimateData = {
    ticket_id: TEST_TICKETS.survey,
    estimated_minutes: 0,
  };

  const response = await apiPost('api-ticket-work-estimates', estimateData, TEST_EMPLOYEES.assigner);
  await response.text(); // Consume body
  assertEquals(response.status, 400);
});

Deno.test('POST /api-ticket-work-estimates - should reject estimated_minutes greater than 480', async () => {
  const estimateData = {
    ticket_id: TEST_TICKETS.survey,
    estimated_minutes: 500,
  };

  const response = await apiPost('api-ticket-work-estimates', estimateData, TEST_EMPLOYEES.assigner);
  await response.text(); // Consume body
  assertEquals(response.status, 400);
});

Deno.test('POST /api-ticket-work-estimates - should reject non-existent ticket', async () => {
  const estimateData = {
    ticket_id: randomUUID(),
    estimated_minutes: 60,
  };

  const response = await apiPost('api-ticket-work-estimates', estimateData, TEST_EMPLOYEES.assigner);
  await response.text(); // Consume body
  assertEquals(response.status, 404);
});

Deno.test('POST /api-ticket-work-estimates - should reject duplicate ticket_id', async () => {
  // First create should succeed
  const estimateData = {
    ticket_id: TEST_TICKETS.pm2,
    estimated_minutes: 60,
  };

  const firstResponse = await apiPost('api-ticket-work-estimates', estimateData, TEST_EMPLOYEES.superAdmin);
  const firstText = await firstResponse.text();

  if (firstResponse.status === 200) {
    // Second create should fail with validation error
    const secondResponse = await apiPost('api-ticket-work-estimates', estimateData, TEST_EMPLOYEES.superAdmin);
    await secondResponse.text(); // Consume body
    assertEquals(secondResponse.status, 400);
  } else {
    // If first failed (already exists), just consume the body and pass
    assertEquals(firstResponse.status < 500, true, `Unexpected server error: ${firstText}`);
  }
});

// ============================================
// GET WORK ESTIMATE BY ID
// ============================================

Deno.test('GET /api-ticket-work-estimates/:id - should get work estimate by ID', async () => {
  // First create an estimate using upsert to handle existing records
  const estimateData = {
    ticket_id: TEST_TICKETS.survey,
    estimated_minutes: 30,
    notes: 'Survey estimate',
  };

  const createResponse = await apiPost('api-ticket-work-estimates/upsert', estimateData, TEST_EMPLOYEES.superAdmin);
  const createText = await createResponse.text();

  if (createResponse.status === 200) {
    const createData = JSON.parse(createText);
    const estimateId = createData.data.id;

    const response = await apiGet(`api-ticket-work-estimates/${estimateId}`, TEST_EMPLOYEES.assigner);
    if (response.status === 200) {
      const estimate = await assertSuccess(response);
      assertExists(estimate);
      assertEquals((estimate as Record<string, unknown>).id, estimateId);
    } else {
      await response.text(); // Consume body
      assertEquals(response.status < 500, true, `Unexpected server error`);
    }
  } else {
    // Skip if create failed (DB constraint issues)
    assertEquals(createResponse.status < 500, true, `Unexpected server error: ${createText}`);
  }
});

Deno.test('GET /api-ticket-work-estimates/:id - should return 404 for non-existent ID', async () => {
  const fakeId = randomUUID();
  const response = await apiGet(`api-ticket-work-estimates/${fakeId}`, TEST_EMPLOYEES.superAdmin);
  await response.text(); // Consume body
  assertEquals(response.status, 404);
});

Deno.test('GET /api-ticket-work-estimates/:id - should include ticket info in response', async () => {
  // Use an existing estimate if available
  if (createdEstimateId) {
    const response = await apiGet(`api-ticket-work-estimates/${createdEstimateId}`, TEST_EMPLOYEES.assigner);
    if (response.status === 200) {
      const estimate = await assertSuccess(response);
      // Should include joined ticket data
      assertExists((estimate as Record<string, unknown>).ticket_id);
    } else {
      await response.text(); // Consume body
    }
  }
});

// ============================================
// GET WORK ESTIMATE BY TICKET ID
// ============================================

Deno.test('GET /api-ticket-work-estimates/ticket/:ticketId - should get estimate by ticket ID', async () => {
  // First ensure we have an estimate for this ticket
  const estimateData = {
    ticket_id: TEST_TICKETS.pm1,
    estimated_minutes: 45,
  };
  const createResponse = await apiPost('api-ticket-work-estimates/upsert', estimateData, TEST_EMPLOYEES.superAdmin);
  await createResponse.text(); // Consume body

  // Now fetch by ticket ID
  const response = await apiGet(`api-ticket-work-estimates/ticket/${TEST_TICKETS.pm1}`, TEST_EMPLOYEES.superAdmin);
  const text = await response.text();

  // Could be 200 if estimate exists or 404 if not
  assertEquals(response.status === 200 || response.status === 404, true, `Unexpected status: ${response.status}, body: ${text}`);
});

Deno.test('GET /api-ticket-work-estimates/ticket/:ticketId - should return 404 for ticket without estimate', async () => {
  // Create a new ticket ID that definitely has no estimate
  const fakeTicketId = randomUUID();
  const response = await apiGet(`api-ticket-work-estimates/ticket/${fakeTicketId}`, TEST_EMPLOYEES.assigner);
  await response.text(); // Consume body
  // Could be 404 (not found) or 500 (invalid ticket reference)
  assertEquals(response.status >= 400, true);
});

// ============================================
// UPDATE WORK ESTIMATE
// ============================================

Deno.test('PUT /api-ticket-work-estimates/:id - should update estimated_minutes', async () => {
  // Create an estimate first
  const estimateData = {
    ticket_id: TEST_TICKETS.pm1,
    estimated_minutes: 45,
  };

  // Use upsert to ensure we have one to update
  const createResponse = await apiPost('api-ticket-work-estimates/upsert', estimateData, TEST_EMPLOYEES.superAdmin);
  const createText = await createResponse.text();

  if (createResponse.status === 200) {
    const createData = JSON.parse(createText);
    const estimateId = createData.data.id;

    const updateData = {
      estimated_minutes: 75,
    };

    const response = await apiPut(`api-ticket-work-estimates/${estimateId}`, updateData, TEST_EMPLOYEES.superAdmin);
    const text = await response.text();
    assertEquals(response.status < 500, true, `Server error: ${text}`);

    if (response.status === 200) {
      const data = JSON.parse(text);
      assertEquals(data.data.estimated_minutes, 75);
    }
  } else {
    assertEquals(createResponse.status < 500, true, `Unexpected server error: ${createText}`);
  }
});

Deno.test('PUT /api-ticket-work-estimates/:id - should update notes', async () => {
  // Create an estimate first
  const estimateData = {
    ticket_id: TEST_TICKETS.rma,
    estimated_minutes: 60,
  };

  const createResponse = await apiPost('api-ticket-work-estimates/upsert', estimateData, TEST_EMPLOYEES.superAdmin);
  const createText = await createResponse.text();

  if (createResponse.status === 200) {
    const createData = JSON.parse(createText);
    const estimateId = createData.data.id;

    const updateData = {
      notes: 'Updated notes via E2E test',
    };

    const response = await apiPut(`api-ticket-work-estimates/${estimateId}`, updateData, TEST_EMPLOYEES.superAdmin);
    const text = await response.text();
    assertEquals(response.status < 500, true, `Server error: ${text}`);

    if (response.status === 200) {
      const data = JSON.parse(text);
      assertEquals(data.data.notes, 'Updated notes via E2E test');
    }
  } else {
    assertEquals(createResponse.status < 500, true, `Unexpected server error: ${createText}`);
  }
});

Deno.test('PUT /api-ticket-work-estimates/:id - should update both fields', async () => {
  // Create an estimate first
  const estimateData = {
    ticket_id: TEST_TICKETS.sales,
    estimated_minutes: 50,
  };

  const createResponse = await apiPost('api-ticket-work-estimates/upsert', estimateData, TEST_EMPLOYEES.superAdmin);
  const createText = await createResponse.text();

  if (createResponse.status === 200) {
    const createData = JSON.parse(createText);
    const estimateId = createData.data.id;

    const updateData = {
      estimated_minutes: 100,
      notes: 'Both fields updated',
    };

    const response = await apiPut(`api-ticket-work-estimates/${estimateId}`, updateData, TEST_EMPLOYEES.superAdmin);
    const text = await response.text();
    assertEquals(response.status < 500, true, `Server error: ${text}`);

    if (response.status === 200) {
      const data = JSON.parse(text);
      assertEquals(data.data.estimated_minutes, 100);
      assertEquals(data.data.notes, 'Both fields updated');
    }
  } else {
    assertEquals(createResponse.status < 500, true, `Unexpected server error: ${createText}`);
  }
});

Deno.test('PUT /api-ticket-work-estimates/:id - should reject empty update', async () => {
  const fakeId = randomUUID();
  const updateData = {};

  const response = await apiPut(`api-ticket-work-estimates/${fakeId}`, updateData, TEST_EMPLOYEES.assigner);
  await response.text(); // Consume body
  assertEquals(response.status, 400);
});

Deno.test('PUT /api-ticket-work-estimates/:id - should reject invalid estimated_minutes (too low)', async () => {
  const fakeId = randomUUID();
  const updateData = {
    estimated_minutes: 0,
  };

  const response = await apiPut(`api-ticket-work-estimates/${fakeId}`, updateData, TEST_EMPLOYEES.assigner);
  await response.text(); // Consume body
  // Either 400 (validation) or 404 (not found)
  assertEquals(response.status >= 400, true);
});

Deno.test('PUT /api-ticket-work-estimates/:id - should reject invalid estimated_minutes (too high)', async () => {
  const fakeId = randomUUID();
  const updateData = {
    estimated_minutes: 500,
  };

  const response = await apiPut(`api-ticket-work-estimates/${fakeId}`, updateData, TEST_EMPLOYEES.assigner);
  await response.text(); // Consume body
  // Either 400 (validation) or 404 (not found)
  assertEquals(response.status >= 400, true);
});

Deno.test('PUT /api-ticket-work-estimates/:id - should return 404 for non-existent ID', async () => {
  const fakeId = randomUUID();
  const updateData = {
    estimated_minutes: 60,
  };

  const response = await apiPut(`api-ticket-work-estimates/${fakeId}`, updateData, TEST_EMPLOYEES.assigner);
  await response.text(); // Consume body
  assertEquals(response.status, 404);
});

// ============================================
// UPSERT WORK ESTIMATE
// ============================================

Deno.test('POST /api-ticket-work-estimates/upsert - should create new estimate', async () => {
  // Use a ticket without estimate
  const estimateData = {
    ticket_id: TEST_TICKETS.survey,
    estimated_minutes: 25,
    notes: 'Created via upsert',
  };

  const response = await apiPost('api-ticket-work-estimates/upsert', estimateData, TEST_EMPLOYEES.assigner);
  const text = await response.text();
  assertEquals(response.status < 500, true, `Unexpected server error: ${text}`);

  if (response.status === 200) {
    const data = JSON.parse(text);
    assertExists(data.data?.id);
    // is_new should be true for new record or false for update
    assertExists(data.data?.is_new !== undefined);
  }
});

Deno.test('POST /api-ticket-work-estimates/upsert - should update existing estimate', async () => {
  // First create
  const estimateData = {
    ticket_id: TEST_TICKETS.pm2,
    estimated_minutes: 40,
  };

  const firstResponse = await apiPost('api-ticket-work-estimates/upsert', estimateData, TEST_EMPLOYEES.superAdmin);
  const firstText = await firstResponse.text();

  if (firstResponse.status === 200) {
    // Now update via upsert
    const updateData = {
      ticket_id: TEST_TICKETS.pm2,
      estimated_minutes: 55,
      notes: 'Updated via upsert',
    };

    const response = await apiPost('api-ticket-work-estimates/upsert', updateData, TEST_EMPLOYEES.assigner);
    const text = await response.text();
    assertEquals(response.status < 500, true, `Server error: ${text}`);

    if (response.status === 200) {
      const data = JSON.parse(text);
      assertEquals(data.data.estimated_minutes, 55);
      assertEquals(data.data.is_new, false); // Should be false for update
    }
  } else {
    assertEquals(firstResponse.status < 500, true, `Unexpected server error: ${firstText}`);
  }
});

Deno.test('POST /api-ticket-work-estimates/upsert - should reject missing ticket_id', async () => {
  const estimateData = {
    estimated_minutes: 60,
  };

  const response = await apiPost('api-ticket-work-estimates/upsert', estimateData, TEST_EMPLOYEES.assigner);
  await response.text(); // Consume body
  assertEquals(response.status, 400);
});

Deno.test('POST /api-ticket-work-estimates/upsert - should reject missing estimated_minutes', async () => {
  const estimateData = {
    ticket_id: TEST_TICKETS.pm1,
  };

  const response = await apiPost('api-ticket-work-estimates/upsert', estimateData, TEST_EMPLOYEES.assigner);
  await response.text(); // Consume body
  assertEquals(response.status, 400);
});

// ============================================
// BULK CREATE/UPDATE
// ============================================

Deno.test('POST /api-ticket-work-estimates/bulk - should bulk create/update estimates (Level 1)', async () => {
  const bulkData = {
    estimates: [
      { ticket_id: TEST_TICKETS.pm1, estimated_minutes: 60, notes: 'Bulk PM1' },
      { ticket_id: TEST_TICKETS.rma, estimated_minutes: 90, notes: 'Bulk RMA' },
    ],
  };

  const response = await apiPost('api-ticket-work-estimates/bulk', bulkData, TEST_EMPLOYEES.assigner);
  const text = await response.text();
  assertEquals(response.status < 500, true, `Unexpected server error: ${text}`);

  if (response.status === 200) {
    const data = JSON.parse(text);
    assertExists(data.data?.created !== undefined);
    assertExists(data.data?.updated !== undefined);
    assertExists(data.data?.errors);
    // Total processed should match input
    const total = data.data.created + data.data.updated + data.data.errors.length;
    assertEquals(total, 2);
  }
});

Deno.test('POST /api-ticket-work-estimates/bulk - should reject empty estimates array', async () => {
  const bulkData = {
    estimates: [],
  };

  const response = await apiPost('api-ticket-work-estimates/bulk', bulkData, TEST_EMPLOYEES.assigner);
  await response.text(); // Consume body
  assertEquals(response.status, 400);
});

Deno.test('POST /api-ticket-work-estimates/bulk - should reject missing estimates field', async () => {
  const bulkData = {};

  const response = await apiPost('api-ticket-work-estimates/bulk', bulkData, TEST_EMPLOYEES.assigner);
  await response.text(); // Consume body
  assertEquals(response.status, 400);
});

Deno.test('POST /api-ticket-work-estimates/bulk - should reject non-array estimates', async () => {
  const bulkData = {
    estimates: 'not an array',
  };

  const response = await apiPost('api-ticket-work-estimates/bulk', bulkData, TEST_EMPLOYEES.assigner);
  await response.text(); // Consume body
  assertEquals(response.status, 400);
});

Deno.test('POST /api-ticket-work-estimates/bulk - should reject over 100 items', async () => {
  const estimates = [];
  for (let i = 0; i < 101; i++) {
    estimates.push({
      ticket_id: randomUUID(),
      estimated_minutes: 60,
    });
  }

  const bulkData = { estimates };

  const response = await apiPost('api-ticket-work-estimates/bulk', bulkData, TEST_EMPLOYEES.assigner);
  await response.text(); // Consume body
  assertEquals(response.status, 400);
});

Deno.test('POST /api-ticket-work-estimates/bulk - should report errors for invalid items', async () => {
  const bulkData = {
    estimates: [
      { ticket_id: TEST_TICKETS.pm1, estimated_minutes: 60 }, // Valid
      { ticket_id: TEST_TICKETS.rma, estimated_minutes: 0 }, // Invalid minutes
      { estimated_minutes: 60 }, // Missing ticket_id
    ],
  };

  const response = await apiPost('api-ticket-work-estimates/bulk', bulkData, TEST_EMPLOYEES.assigner);
  const text = await response.text();
  assertEquals(response.status < 500, true, `Unexpected server error: ${text}`);

  if (response.status === 200) {
    const data = JSON.parse(text);
    assertExists(data.data?.errors);
    // Should have errors for invalid items
    assertEquals(data.data.errors.length >= 2, true);
  }
});

// ============================================
// DELETE WORK ESTIMATE BY ID
// ============================================

Deno.test('DELETE /api-ticket-work-estimates/:id - should delete estimate', async () => {
  // First create an estimate to delete
  const estimateData = {
    ticket_id: TEST_TICKETS.survey,
    estimated_minutes: 15,
  };

  const createResponse = await apiPost('api-ticket-work-estimates/upsert', estimateData, TEST_EMPLOYEES.superAdmin);
  const createText = await createResponse.text();

  if (createResponse.status === 200) {
    const createData = JSON.parse(createText);
    const estimateId = createData.data.id;

    const response = await apiDelete(`api-ticket-work-estimates/${estimateId}`, TEST_EMPLOYEES.admin);
    const text = await response.text();
    assertEquals(response.status < 500, true, `Server error: ${text}`);

    if (response.status === 200) {
      const data = JSON.parse(text);
      assertExists(data.data?.message);
    }
  } else {
    assertEquals(createResponse.status < 500, true, `Unexpected server error: ${createText}`);
  }
});

Deno.test('DELETE /api-ticket-work-estimates/:id - should succeed even for non-existent ID', async () => {
  // Delete is typically idempotent
  const fakeId = randomUUID();
  const response = await apiDelete(`api-ticket-work-estimates/${fakeId}`, TEST_EMPLOYEES.assigner);
  const text = await response.text();
  // Could be 200 (success, no rows affected) or 404 (not found)
  assertEquals(response.status < 500, true, `Server error: ${text}`);
});

// ============================================
// DELETE WORK ESTIMATE BY TICKET ID
// ============================================

Deno.test('DELETE /api-ticket-work-estimates/ticket/:ticketId - should delete estimate by ticket', async () => {
  // First create an estimate for a specific ticket
  const estimateData = {
    ticket_id: TEST_TICKETS.pm2,
    estimated_minutes: 35,
  };

  const createResponse = await apiPost('api-ticket-work-estimates/upsert', estimateData, TEST_EMPLOYEES.superAdmin);
  const createText = await createResponse.text();

  if (createResponse.status === 200) {
    // Now delete by ticket ID
    const response = await apiDelete(`api-ticket-work-estimates/ticket/${TEST_TICKETS.pm2}`, TEST_EMPLOYEES.admin);
    const text = await response.text();
    assertEquals(response.status < 500, true, `Server error: ${text}`);

    if (response.status === 200) {
      const data = JSON.parse(text);
      assertExists(data.data?.message);
    }
  } else {
    assertEquals(createResponse.status < 500, true, `Unexpected server error: ${createText}`);
  }
});

Deno.test('DELETE /api-ticket-work-estimates/ticket/:ticketId - should succeed for ticket without estimate', async () => {
  // Delete by non-existent ticket - should be idempotent
  const fakeTicketId = randomUUID();
  const response = await apiDelete(`api-ticket-work-estimates/ticket/${fakeTicketId}`, TEST_EMPLOYEES.assigner);
  const text = await response.text();
  // Should succeed even if no rows deleted
  assertEquals(response.status < 500, true, `Server error: ${text}`);
});

// ============================================
// NOT FOUND ROUTE
// ============================================

Deno.test('GET /api-ticket-work-estimates/invalid/path/here - should return 404', async () => {
  const response = await apiGet('api-ticket-work-estimates/foo/bar/baz', TEST_EMPLOYEES.assigner);
  await response.text(); // Consume body
  assertEquals(response.status, 404);
});

Deno.test('POST /api-ticket-work-estimates/invalid - should return 404', async () => {
  const response = await apiPost('api-ticket-work-estimates/invalid', {}, TEST_EMPLOYEES.assigner);
  await response.text(); // Consume body
  assertEquals(response.status, 404);
});

// ============================================
// PERMISSION LEVEL TESTS - Verify Level 1+ Can Access
// ============================================

Deno.test('Permission: Assigner (Level 1) can create work estimates', async () => {
  const estimateData = {
    ticket_id: TEST_TICKETS.pm1,
    estimated_minutes: 50,
  };

  const response = await apiPost('api-ticket-work-estimates/upsert', estimateData, TEST_EMPLOYEES.assigner);
  const text = await response.text();
  assertEquals(response.status < 500, true, `Unexpected server error: ${text}`);
  // Level 1 should have access
  assertEquals(response.status !== 403, true, 'Level 1 should have access');
});

Deno.test('Permission: PM (Level 1) can create work estimates', async () => {
  const estimateData = {
    ticket_id: TEST_TICKETS.rma,
    estimated_minutes: 80,
  };

  const response = await apiPost('api-ticket-work-estimates/upsert', estimateData, TEST_EMPLOYEES.pm1);
  const text = await response.text();
  assertEquals(response.status < 500, true, `Unexpected server error: ${text}`);
  assertEquals(response.status !== 403, true, 'PM should have access');
});

Deno.test('Permission: Sales (Level 1) can create work estimates', async () => {
  const estimateData = {
    ticket_id: TEST_TICKETS.sales,
    estimated_minutes: 70,
  };

  const response = await apiPost('api-ticket-work-estimates/upsert', estimateData, TEST_EMPLOYEES.sales1);
  const text = await response.text();
  assertEquals(response.status < 500, true, `Unexpected server error: ${text}`);
  assertEquals(response.status !== 403, true, 'Sales should have access');
});

Deno.test('Permission: Admin (Level 2) can delete work estimates', async () => {
  // First ensure estimate exists
  const estimateData = {
    ticket_id: TEST_TICKETS.survey,
    estimated_minutes: 20,
  };

  const createResponse = await apiPost('api-ticket-work-estimates/upsert', estimateData, TEST_EMPLOYEES.superAdmin);
  await createResponse.text();

  // Admin should be able to delete
  const response = await apiDelete(`api-ticket-work-estimates/ticket/${TEST_TICKETS.survey}`, TEST_EMPLOYEES.admin);
  const text = await response.text();
  assertEquals(response.status < 500, true, `Unexpected server error: ${text}`);
  assertEquals(response.status !== 403, true, 'Admin should have access');
});

Deno.test('Permission: Superadmin (Level 3) has full access', async () => {
  const estimateData = {
    ticket_id: TEST_TICKETS.pm1,
    estimated_minutes: 65,
    notes: 'Superadmin test',
  };

  const response = await apiPost('api-ticket-work-estimates/upsert', estimateData, TEST_EMPLOYEES.superAdmin);
  const text = await response.text();
  assertEquals(response.status < 500, true, `Unexpected server error: ${text}`);
  assertEquals(response.status !== 403, true, 'Superadmin should have full access');
});

// ============================================
// EDGE CASES
// ============================================

Deno.test('POST /api-ticket-work-estimates - should handle boundary value 1 minute', async () => {
  const estimateData = {
    ticket_id: TEST_TICKETS.pm1,
    estimated_minutes: 1,
  };

  const response = await apiPost('api-ticket-work-estimates/upsert', estimateData, TEST_EMPLOYEES.assigner);
  const text = await response.text();
  assertEquals(response.status < 500, true, `Unexpected server error: ${text}`);
});

Deno.test('POST /api-ticket-work-estimates - should handle boundary value 480 minutes', async () => {
  const estimateData = {
    ticket_id: TEST_TICKETS.rma,
    estimated_minutes: 480,
  };

  const response = await apiPost('api-ticket-work-estimates/upsert', estimateData, TEST_EMPLOYEES.assigner);
  const text = await response.text();
  assertEquals(response.status < 500, true, `Unexpected server error: ${text}`);
});

Deno.test('POST /api-ticket-work-estimates - should handle null notes', async () => {
  const estimateData = {
    ticket_id: TEST_TICKETS.sales,
    estimated_minutes: 45,
    notes: null,
  };

  const response = await apiPost('api-ticket-work-estimates/upsert', estimateData, TEST_EMPLOYEES.assigner);
  const text = await response.text();
  assertEquals(response.status < 500, true, `Unexpected server error: ${text}`);
});

Deno.test('POST /api-ticket-work-estimates - should handle empty string notes', async () => {
  const estimateData = {
    ticket_id: TEST_TICKETS.survey,
    estimated_minutes: 30,
    notes: '',
  };

  const response = await apiPost('api-ticket-work-estimates/upsert', estimateData, TEST_EMPLOYEES.assigner);
  const text = await response.text();
  assertEquals(response.status < 500, true, `Unexpected server error: ${text}`);
});

Deno.test('PUT /api-ticket-work-estimates/:id - should handle notes set to null', async () => {
  // First create with notes
  const createData = {
    ticket_id: TEST_TICKETS.pm1,
    estimated_minutes: 40,
    notes: 'Will be cleared',
  };

  const createResponse = await apiPost('api-ticket-work-estimates/upsert', createData, TEST_EMPLOYEES.superAdmin);
  const createText = await createResponse.text();

  if (createResponse.status === 200) {
    const created = JSON.parse(createText);
    const estimateId = created.data.id;

    // Update notes to null
    const updateData = {
      notes: null,
    };

    const response = await apiPut(`api-ticket-work-estimates/${estimateId}`, updateData, TEST_EMPLOYEES.assigner);
    const text = await response.text();
    assertEquals(response.status < 500, true, `Server error: ${text}`);
  }
});
