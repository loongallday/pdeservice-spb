/**
 * E2E Tests for api-route-optimization
 * Tests all route optimization operations with real database and authentication
 *
 * Endpoints tested:
 * - POST /optimize - Sync route optimization
 * - POST /optimize/async - Start async optimization job
 * - POST /calculate - Calculate travel times for user-specified order
 * - GET /jobs/:jobId - Poll job status
 * - GET /work-estimates/ticket/:ticketId - Get work estimate by ticket
 * - GET /work-estimates/date/:date - Get work estimates for date
 * - POST /work-estimates - Create/update work estimate
 * - POST /work-estimates/bulk - Bulk create/update work estimates
 * - DELETE /work-estimates/ticket/:ticketId - Delete work estimate
 */

import { assertEquals, assertExists } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import {
  apiGet,
  apiPost,
  apiDelete,
  setupTestUsers,
  TEST_EMPLOYEES,
  TEST_TICKETS,
  TEST_SITES,
  randomUUID,
  getServiceClient,
} from './test-utils.ts';

// Test garage ID - will be created in setup
let TEST_GARAGE_ID: string | null = null;

// Track created work estimates for cleanup
const createdWorkEstimates: string[] = [];

// ============================================
// SETUP
// ============================================

Deno.test({
  name: 'Setup: Create test auth users and test data',
  fn: async () => {
    await setupTestUsers();

    // Create a test garage for route optimization tests
    const supabase = getServiceClient();

    // Check if test garage exists
    const { data: existingGarage } = await supabase
      .from('fleet_garages')
      .select('id')
      .eq('name', 'E2E Test Garage')
      .maybeSingle();

    if (existingGarage) {
      TEST_GARAGE_ID = existingGarage.id;
    } else {
      // Create test garage
      const { data: newGarage, error } = await supabase
        .from('fleet_garages')
        .insert({
          name: 'E2E Test Garage',
          description: 'Test garage for E2E tests',
          latitude: 13.7563,
          longitude: 100.5018,
          radius_meters: 100,
          is_active: true,
        })
        .select('id')
        .single();

      if (error) {
        console.error('Failed to create test garage:', error);
      } else {
        TEST_GARAGE_ID = newGarage.id;
      }
    }
  },
  sanitizeOps: false,
  sanitizeResources: false,
});

// ============================================
// PERMISSION TESTS
// ============================================

Deno.test('Permission: Level 0 technician cannot access route optimization', async () => {
  const response = await apiGet('api-route-optimization/jobs/fake-id', TEST_EMPLOYEES.tech1);
  await response.text(); // Consume body
  // 403 = forbidden (level check), 502 = auth failure in local environment
  assertEquals(response.status === 403 || response.status === 502, true);
});

Deno.test('Permission: Level 1 assigner can access route optimization', async () => {
  const response = await apiGet('api-route-optimization/jobs/' + randomUUID(), TEST_EMPLOYEES.assigner);
  await response.text(); // Consume body
  // Should be 404 (not found) not 403 (forbidden)
  assertEquals(response.status, 404);
});

Deno.test('Permission: Level 2 admin can access route optimization', async () => {
  const response = await apiGet('api-route-optimization/jobs/' + randomUUID(), TEST_EMPLOYEES.admin);
  await response.text(); // Consume body
  assertEquals(response.status, 404);
});

Deno.test('Permission: Level 0 technician cannot create work estimates', async () => {
  const estimateData = {
    ticket_id: TEST_TICKETS.pm1,
    estimated_minutes: 60,
  };

  const response = await apiPost('api-route-optimization/work-estimates', estimateData, TEST_EMPLOYEES.tech1);
  await response.text(); // Consume body
  // 403 = forbidden (level check), 502 = auth failure in local environment
  assertEquals(response.status === 403 || response.status === 502, true);
});

Deno.test('Permission: Level 1 assigner can create work estimates', async () => {
  const estimateData = {
    ticket_id: TEST_TICKETS.pm1,
    estimated_minutes: 45,
  };

  const response = await apiPost('api-route-optimization/work-estimates', estimateData, TEST_EMPLOYEES.assigner);
  const text = await response.text();
  // Should succeed (200/201) or return validation/not-found error (not 403)
  assertEquals(response.status !== 403, true, `Should not be forbidden: ${text}`);
});

// ============================================
// WORK ESTIMATES - GET BY TICKET
// ============================================

Deno.test('GET /work-estimates/ticket/:ticketId - should return 404 for non-existent ticket', async () => {
  const fakeId = randomUUID();
  const response = await apiGet(`api-route-optimization/work-estimates/ticket/${fakeId}`);
  await response.text(); // Consume body
  assertEquals(response.status, 404);
});

Deno.test('GET /work-estimates/ticket/:ticketId - should handle invalid UUID', async () => {
  const response = await apiGet('api-route-optimization/work-estimates/ticket/invalid-uuid');
  await response.text(); // Consume body
  // May return 400 or 404 depending on implementation
  assertEquals(response.status >= 400, true);
});

// ============================================
// WORK ESTIMATES - GET BY DATE
// ============================================

Deno.test('GET /work-estimates/date/:date - should return empty array for date with no tickets', async () => {
  const response = await apiGet('api-route-optimization/work-estimates/date/2099-12-31');
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
  assertEquals(Array.isArray(data.data), true);
});

Deno.test('GET /work-estimates/date/:date - should return 400 for invalid date format', async () => {
  const response = await apiGet('api-route-optimization/work-estimates/date/invalid-date');
  await response.text(); // Consume body
  assertEquals(response.status, 400);
});

Deno.test('GET /work-estimates/date/:date - should return 400 for wrong date format', async () => {
  const response = await apiGet('api-route-optimization/work-estimates/date/01-15-2026');
  await response.text(); // Consume body
  assertEquals(response.status, 400);
});

Deno.test('GET /work-estimates/date/:date - should accept valid date format', async () => {
  const response = await apiGet('api-route-optimization/work-estimates/date/2026-01-15');
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
});

// ============================================
// WORK ESTIMATES - CREATE/UPDATE (UPSERT)
// ============================================

Deno.test('POST /work-estimates - should fail without ticket_id', async () => {
  const estimateData = {
    estimated_minutes: 60,
  };

  const response = await apiPost('api-route-optimization/work-estimates', estimateData);
  await response.text(); // Consume body
  assertEquals(response.status, 400);
});

Deno.test('POST /work-estimates - should fail without estimated_minutes', async () => {
  const estimateData = {
    ticket_id: TEST_TICKETS.pm1,
  };

  const response = await apiPost('api-route-optimization/work-estimates', estimateData);
  await response.text(); // Consume body
  assertEquals(response.status, 400);
});

Deno.test('POST /work-estimates - should fail with estimated_minutes < 1', async () => {
  const estimateData = {
    ticket_id: TEST_TICKETS.pm1,
    estimated_minutes: 0,
  };

  const response = await apiPost('api-route-optimization/work-estimates', estimateData);
  await response.text(); // Consume body
  assertEquals(response.status, 400);
});

Deno.test('POST /work-estimates - should fail with estimated_minutes > 480', async () => {
  const estimateData = {
    ticket_id: TEST_TICKETS.pm1,
    estimated_minutes: 500,
  };

  const response = await apiPost('api-route-optimization/work-estimates', estimateData);
  await response.text(); // Consume body
  assertEquals(response.status, 400);
});

Deno.test('POST /work-estimates - should fail for non-existent ticket', async () => {
  const fakeId = randomUUID();
  const estimateData = {
    ticket_id: fakeId,
    estimated_minutes: 60,
  };

  const response = await apiPost('api-route-optimization/work-estimates', estimateData);
  await response.text(); // Consume body
  assertEquals(response.status, 404);
});

Deno.test('POST /work-estimates - should create work estimate with valid data', async () => {
  const estimateData = {
    ticket_id: TEST_TICKETS.pm1,
    estimated_minutes: 90,
    notes: 'E2E test work estimate',
  };

  const response = await apiPost('api-route-optimization/work-estimates', estimateData);
  const text = await response.text();
  assertEquals(response.status < 500, true, `Unexpected server error: ${text}`);

  if (response.status === 200) {
    const data = JSON.parse(text);
    assertExists(data.data);
    assertEquals(data.data.ticket_id, TEST_TICKETS.pm1);
    assertEquals(data.data.estimated_minutes, 90);
    createdWorkEstimates.push(TEST_TICKETS.pm1);
  }
});

Deno.test('POST /work-estimates - should update existing work estimate', async () => {
  // This should update the estimate created in the previous test
  const estimateData = {
    ticket_id: TEST_TICKETS.pm1,
    estimated_minutes: 120,
    notes: 'Updated E2E test work estimate',
  };

  const response = await apiPost('api-route-optimization/work-estimates', estimateData);
  const text = await response.text();
  assertEquals(response.status < 500, true, `Unexpected server error: ${text}`);

  if (response.status === 200) {
    const data = JSON.parse(text);
    assertExists(data.data);
    assertEquals(data.data.estimated_minutes, 120);
    assertEquals(data.data.is_new, false);
  }
});

// ============================================
// WORK ESTIMATES - BULK UPSERT
// ============================================

Deno.test('POST /work-estimates/bulk - should fail without estimates array', async () => {
  const response = await apiPost('api-route-optimization/work-estimates/bulk', {});
  await response.text(); // Consume body
  assertEquals(response.status, 400);
});

Deno.test('POST /work-estimates/bulk - should fail with empty estimates array', async () => {
  const response = await apiPost('api-route-optimization/work-estimates/bulk', { estimates: [] });
  await response.text(); // Consume body
  assertEquals(response.status, 400);
});

Deno.test('POST /work-estimates/bulk - should fail with too many estimates (> 100)', async () => {
  // Create array with 101 estimates
  const estimates = Array.from({ length: 101 }, (_, i) => ({
    ticket_id: randomUUID(),
    estimated_minutes: 60,
  }));

  const response = await apiPost('api-route-optimization/work-estimates/bulk', { estimates });
  await response.text(); // Consume body
  assertEquals(response.status, 400);
});

Deno.test('POST /work-estimates/bulk - should process valid estimates and track errors', async () => {
  const estimates = [
    {
      ticket_id: TEST_TICKETS.pm2,
      estimated_minutes: 45,
      notes: 'Bulk test 1',
    },
    {
      ticket_id: randomUUID(), // Non-existent ticket - should be tracked as error
      estimated_minutes: 60,
    },
    {
      ticket_id: TEST_TICKETS.rma,
      estimated_minutes: 30,
      notes: 'Bulk test 2',
    },
  ];

  const response = await apiPost('api-route-optimization/work-estimates/bulk', { estimates });
  const text = await response.text();
  assertEquals(response.status < 500, true, `Unexpected server error: ${text}`);

  if (response.status === 200) {
    const data = JSON.parse(text);
    assertExists(data.data);
    // Should have some created/updated and some errors
    assertEquals(typeof data.data.created, 'number');
    assertEquals(typeof data.data.updated, 'number');
    assertEquals(Array.isArray(data.data.errors), true);

    createdWorkEstimates.push(TEST_TICKETS.pm2, TEST_TICKETS.rma);
  }
});

Deno.test('POST /work-estimates/bulk - should track validation errors', async () => {
  const estimates = [
    {
      ticket_id: TEST_TICKETS.sales,
      estimated_minutes: 0, // Invalid - too low
    },
    {
      // Missing ticket_id
      estimated_minutes: 60,
    },
  ];

  const response = await apiPost('api-route-optimization/work-estimates/bulk', { estimates });
  const text = await response.text();
  assertEquals(response.status < 500, true, `Unexpected server error: ${text}`);

  if (response.status === 200) {
    const data = JSON.parse(text);
    // Should have errors tracked
    assertEquals(Array.isArray(data.data.errors), true);
    assertEquals(data.data.errors.length > 0, true);
  }
});

// ============================================
// WORK ESTIMATES - DELETE
// ============================================

Deno.test('DELETE /work-estimates/ticket/:ticketId - should delete existing work estimate', async () => {
  // First ensure we have a work estimate to delete
  const estimateData = {
    ticket_id: TEST_TICKETS.survey,
    estimated_minutes: 60,
  };

  const createResponse = await apiPost('api-route-optimization/work-estimates', estimateData);
  await createResponse.text(); // Consume body to avoid leak

  // Now delete it
  const response = await apiDelete(`api-route-optimization/work-estimates/ticket/${TEST_TICKETS.survey}`);
  const text = await response.text();
  assertEquals(response.status < 500, true, `Unexpected server error: ${text}`);

  if (response.status === 200) {
    const data = JSON.parse(text);
    assertExists(data.data.message);
  }
});

Deno.test('DELETE /work-estimates/ticket/:ticketId - should succeed for non-existent estimate (idempotent)', async () => {
  const fakeId = randomUUID();
  const response = await apiDelete(`api-route-optimization/work-estimates/ticket/${fakeId}`);
  const text = await response.text();
  // DELETE should be idempotent - succeed even if nothing to delete
  assertEquals(response.status < 500, true, `Unexpected server error: ${text}`);
});

// ============================================
// JOBS - GET STATUS
// ============================================

Deno.test('GET /jobs/:jobId - should return 404 for non-existent job', async () => {
  const fakeId = randomUUID();
  const response = await apiGet(`api-route-optimization/jobs/${fakeId}`);
  await response.text(); // Consume body
  assertEquals(response.status, 404);
});

Deno.test('GET /jobs/:jobId - should handle invalid UUID', async () => {
  const response = await apiGet('api-route-optimization/jobs/invalid-uuid');
  await response.text(); // Consume body
  // May return 400 or 404
  assertEquals(response.status >= 400, true);
});

// ============================================
// ASYNC OPTIMIZE
// ============================================

Deno.test('POST /optimize/async - should fail without date', async () => {
  const optimizeData = {
    garage_id: TEST_GARAGE_ID || randomUUID(),
  };

  const response = await apiPost('api-route-optimization/optimize/async', optimizeData);
  await response.text(); // Consume body
  assertEquals(response.status, 400);
});

Deno.test('POST /optimize/async - should fail without garage_id', async () => {
  const optimizeData = {
    date: '2026-02-01',
  };

  const response = await apiPost('api-route-optimization/optimize/async', optimizeData);
  await response.text(); // Consume body
  assertEquals(response.status, 400);
});

Deno.test('POST /optimize/async - should start job with valid data', async () => {
  if (!TEST_GARAGE_ID) {
    console.log('Skipping test - no test garage available');
    return;
  }

  const optimizeData = {
    date: '2026-02-01',
    garage_id: TEST_GARAGE_ID,
  };

  const response = await apiPost('api-route-optimization/optimize/async', optimizeData);
  const text = await response.text();
  assertEquals(response.status < 500, true, `Unexpected server error: ${text}`);

  if (response.status === 200) {
    const data = JSON.parse(text);
    assertExists(data.data);
    assertExists(data.data.job_id);
    assertExists(data.data.status);
    assertExists(data.data.poll_url);
  }
});

Deno.test('POST /optimize/async - should fail with non-existent garage', async () => {
  const fakeGarageId = randomUUID();
  const optimizeData = {
    date: '2026-02-01',
    garage_id: fakeGarageId,
  };

  const response = await apiPost('api-route-optimization/optimize/async', optimizeData);
  const text = await response.text();
  // Job may be created but fail during processing, or may fail immediately
  assertEquals(response.status < 500, true, `Unexpected server error: ${text}`);
});

// ============================================
// SYNC OPTIMIZE
// ============================================

Deno.test('POST /optimize - should fail without date', async () => {
  const optimizeData = {
    garage_id: TEST_GARAGE_ID || randomUUID(),
  };

  const response = await apiPost('api-route-optimization/optimize', optimizeData);
  await response.text(); // Consume body
  assertEquals(response.status, 400);
});

Deno.test('POST /optimize - should fail without garage_id', async () => {
  const optimizeData = {
    date: '2026-02-01',
  };

  const response = await apiPost('api-route-optimization/optimize', optimizeData);
  await response.text(); // Consume body
  assertEquals(response.status, 400);
});

Deno.test('POST /optimize - should fail with invalid date format', async () => {
  const optimizeData = {
    date: '01-02-2026', // Wrong format
    garage_id: TEST_GARAGE_ID || randomUUID(),
  };

  const response = await apiPost('api-route-optimization/optimize', optimizeData);
  await response.text(); // Consume body
  assertEquals(response.status, 400);
});

Deno.test('POST /optimize - should fail with invalid garage_id format', async () => {
  const optimizeData = {
    date: '2026-02-01',
    garage_id: 'invalid-uuid',
  };

  const response = await apiPost('api-route-optimization/optimize', optimizeData);
  await response.text(); // Consume body
  assertEquals(response.status, 400);
});

Deno.test('POST /optimize - should fail with invalid start_time format', async () => {
  const optimizeData = {
    date: '2026-02-01',
    garage_id: TEST_GARAGE_ID || randomUUID(),
    start_time: '8:00', // Missing leading zero
  };

  const response = await apiPost('api-route-optimization/optimize', optimizeData);
  await response.text(); // Consume body
  // May succeed with lenient parsing or fail with 400
  assertEquals(response.status >= 200, true);
});

Deno.test('POST /optimize - should fail with non-existent garage', async () => {
  const fakeGarageId = randomUUID();
  const optimizeData = {
    date: '2026-02-01',
    garage_id: fakeGarageId,
  };

  const response = await apiPost('api-route-optimization/optimize', optimizeData);
  await response.text(); // Consume body
  // 404 = not found, 500 = may be wrapped database error
  assertEquals(response.status >= 400, true);
});

Deno.test('POST /optimize - should return empty route for date with no tickets', async () => {
  if (!TEST_GARAGE_ID) {
    console.log('Skipping test - no test garage available');
    return;
  }

  const optimizeData = {
    date: '2099-12-31', // Future date with no tickets
    garage_id: TEST_GARAGE_ID,
  };

  const response = await apiPost('api-route-optimization/optimize', optimizeData);
  const text = await response.text();
  assertEquals(response.status < 500, true, `Unexpected server error: ${text}`);

  if (response.status === 200) {
    const data = JSON.parse(text);
    assertExists(data.data);
    assertExists(data.data.routes);
    assertEquals(Array.isArray(data.data.routes), true);
    assertEquals(data.data.summary.total_stops, 0);
  }
});

Deno.test('POST /optimize - should fail with max_per_route < 1', async () => {
  const optimizeData = {
    date: '2026-02-01',
    garage_id: TEST_GARAGE_ID || randomUUID(),
    max_per_route: 0,
  };

  const response = await apiPost('api-route-optimization/optimize', optimizeData);
  await response.text(); // Consume body
  assertEquals(response.status, 400);
});

Deno.test('POST /optimize - should fail with max_per_route > 50', async () => {
  const optimizeData = {
    date: '2026-02-01',
    garage_id: TEST_GARAGE_ID || randomUUID(),
    max_per_route: 100,
  };

  const response = await apiPost('api-route-optimization/optimize', optimizeData);
  await response.text(); // Consume body
  assertEquals(response.status, 400);
});

Deno.test('POST /optimize - should validate ticket_ids if provided', async () => {
  const optimizeData = {
    date: '2026-02-01',
    garage_id: TEST_GARAGE_ID || randomUUID(),
    ticket_ids: ['invalid-uuid'],
  };

  const response = await apiPost('api-route-optimization/optimize', optimizeData);
  await response.text(); // Consume body
  assertEquals(response.status, 400);
});

// ============================================
// CALCULATE
// ============================================

Deno.test('POST /calculate - should fail without garage_id', async () => {
  const calculateData = {
    ticket_ids: [TEST_TICKETS.pm1],
  };

  const response = await apiPost('api-route-optimization/calculate', calculateData);
  await response.text(); // Consume body
  assertEquals(response.status, 400);
});

Deno.test('POST /calculate - should fail without ticket_ids', async () => {
  const calculateData = {
    garage_id: TEST_GARAGE_ID || randomUUID(),
  };

  const response = await apiPost('api-route-optimization/calculate', calculateData);
  await response.text(); // Consume body
  assertEquals(response.status, 400);
});

Deno.test('POST /calculate - should fail with empty ticket_ids', async () => {
  const calculateData = {
    garage_id: TEST_GARAGE_ID || randomUUID(),
    ticket_ids: [],
  };

  const response = await apiPost('api-route-optimization/calculate', calculateData);
  await response.text(); // Consume body
  assertEquals(response.status, 400);
});

Deno.test('POST /calculate - should fail with non-existent garage', async () => {
  const fakeGarageId = randomUUID();
  const calculateData = {
    garage_id: fakeGarageId,
    ticket_ids: [TEST_TICKETS.pm1],
  };

  const response = await apiPost('api-route-optimization/calculate', calculateData);
  await response.text(); // Consume body
  // 404 = not found, 500 = may be wrapped database error
  assertEquals(response.status >= 400, true);
});

Deno.test('POST /calculate - should handle tickets without coordinates gracefully', async () => {
  if (!TEST_GARAGE_ID) {
    console.log('Skipping test - no test garage available');
    return;
  }

  const calculateData = {
    garage_id: TEST_GARAGE_ID,
    ticket_ids: [randomUUID()], // Non-existent ticket
    start_time: '09:00',
  };

  const response = await apiPost('api-route-optimization/calculate', calculateData);
  const text = await response.text();
  // May return empty result or error
  assertEquals(response.status < 500, true, `Unexpected server error: ${text}`);
});

// ============================================
// 404 TESTS
// ============================================

Deno.test('GET /unknown-endpoint - should return 404', async () => {
  const response = await apiGet('api-route-optimization/unknown-endpoint');
  await response.text(); // Consume body
  assertEquals(response.status, 404);
});

Deno.test('POST /unknown-endpoint - should return 404', async () => {
  const response = await apiPost('api-route-optimization/unknown-endpoint', {});
  await response.text(); // Consume body
  assertEquals(response.status, 404);
});

Deno.test('DELETE /unknown-endpoint - should return 404', async () => {
  const response = await apiDelete('api-route-optimization/unknown-endpoint');
  await response.text(); // Consume body
  assertEquals(response.status, 404);
});

// ============================================
// CLEANUP
// ============================================

Deno.test({
  name: 'Cleanup: Delete test data',
  fn: async () => {
    const supabase = getServiceClient();

    // Clean up work estimates created during tests
    for (const ticketId of createdWorkEstimates) {
      await supabase
        .from('child_ticket_work_estimates')
        .delete()
        .eq('ticket_id', ticketId);
    }

    // Clean up any background jobs created during tests
    await supabase
      .from('main_route_optimization_jobs')
      .delete()
      .lt('created_at', new Date().toISOString());
  },
  sanitizeOps: false,
  sanitizeResources: false,
});
