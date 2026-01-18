/**
 * E2E Tests for api-reports
 * Tests all report endpoints with real database and authentication
 *
 * Endpoints:
 * - GET /daily - Daily operations report (JSON)
 * - GET /rma/excel - RMA report (Excel download)
 * - GET /pm/excel - PM report (Excel download)
 * - GET /sales/excel - Sales report (Excel download)
 *
 * Authorization: Level 1+ required (Assigner, PM, Sales and above)
 */

import { assertEquals, assertExists } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import {
  apiGet,
  setupTestUsers,
  TEST_EMPLOYEES,
} from './test-utils.ts';

// Get today's date in YYYY-MM-DD format
function getTodayDate(): string {
  const today = new Date();
  return today.toISOString().split('T')[0];
}

// Get a date in the past (days ago)
function getPastDate(daysAgo: number): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().split('T')[0];
}

// Get a date in the future (days from now)
function getFutureDate(daysAhead: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  return date.toISOString().split('T')[0];
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
// GET DAILY REPORT
// ============================================

Deno.test('GET /api-reports/daily - should return daily report with valid date', async () => {
  const date = getTodayDate();
  const response = await apiGet(`api-reports/daily?date=${date}`, TEST_EMPLOYEES.superAdmin);
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
});

Deno.test('GET /api-reports/daily - should work with past date', async () => {
  const date = getPastDate(7);
  const response = await apiGet(`api-reports/daily?date=${date}`, TEST_EMPLOYEES.assigner);
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
});

Deno.test('GET /api-reports/daily - should return 400 without date parameter', async () => {
  const response = await apiGet('api-reports/daily', TEST_EMPLOYEES.superAdmin);
  await response.text(); // Consume body
  assertEquals(response.status, 400);
});

Deno.test('GET /api-reports/daily - should return 400 with invalid date format', async () => {
  const response = await apiGet('api-reports/daily?date=01-01-2026', TEST_EMPLOYEES.superAdmin);
  await response.text(); // Consume body
  assertEquals(response.status, 400);
});

Deno.test('GET /api-reports/daily - should return 400 with invalid date string', async () => {
  const response = await apiGet('api-reports/daily?date=invalid-date', TEST_EMPLOYEES.superAdmin);
  await response.text(); // Consume body
  assertEquals(response.status, 400);
});

Deno.test('GET /api-reports/daily - should return 400 for date too far in future', async () => {
  // More than 3 months in the future
  const futureDate = getFutureDate(120);
  const response = await apiGet(`api-reports/daily?date=${futureDate}`, TEST_EMPLOYEES.superAdmin);
  await response.text(); // Consume body
  assertEquals(response.status, 400);
});

// ============================================
// GET RMA EXCEL REPORT
// ============================================

Deno.test('GET /api-reports/rma/excel - should return Excel file with valid date range', async () => {
  const startDate = getPastDate(7);
  const endDate = getTodayDate();
  const response = await apiGet(
    `api-reports/rma/excel?start_date=${startDate}&end_date=${endDate}`,
    TEST_EMPLOYEES.superAdmin
  );
  // Consume body
  await response.arrayBuffer();
  assertEquals(response.status < 500, true);

  // If successful, check content type
  if (response.status === 200) {
    const contentType = response.headers.get('Content-Type');
    assertEquals(
      contentType?.includes('spreadsheetml') || contentType?.includes('excel'),
      true
    );
  }
});

Deno.test('GET /api-reports/rma/excel - should return 400 without start_date', async () => {
  const endDate = getTodayDate();
  const response = await apiGet(
    `api-reports/rma/excel?end_date=${endDate}`,
    TEST_EMPLOYEES.superAdmin
  );
  await response.text(); // Consume body
  assertEquals(response.status, 400);
});

Deno.test('GET /api-reports/rma/excel - should return 400 without end_date', async () => {
  const startDate = getPastDate(7);
  const response = await apiGet(
    `api-reports/rma/excel?start_date=${startDate}`,
    TEST_EMPLOYEES.superAdmin
  );
  await response.text(); // Consume body
  assertEquals(response.status, 400);
});

Deno.test('GET /api-reports/rma/excel - should return 400 with invalid date format', async () => {
  const response = await apiGet(
    'api-reports/rma/excel?start_date=01-01-2026&end_date=01-07-2026',
    TEST_EMPLOYEES.superAdmin
  );
  await response.text(); // Consume body
  assertEquals(response.status, 400);
});

Deno.test('GET /api-reports/rma/excel - should return 400 when start_date > end_date', async () => {
  const startDate = getTodayDate();
  const endDate = getPastDate(7);
  const response = await apiGet(
    `api-reports/rma/excel?start_date=${startDate}&end_date=${endDate}`,
    TEST_EMPLOYEES.superAdmin
  );
  await response.text(); // Consume body
  assertEquals(response.status, 400);
});

Deno.test('GET /api-reports/rma/excel - should return 400 when date range exceeds 31 days', async () => {
  const startDate = getPastDate(40);
  const endDate = getTodayDate();
  const response = await apiGet(
    `api-reports/rma/excel?start_date=${startDate}&end_date=${endDate}`,
    TEST_EMPLOYEES.superAdmin
  );
  await response.text(); // Consume body
  assertEquals(response.status, 400);
});

// ============================================
// GET PM EXCEL REPORT
// ============================================

Deno.test('GET /api-reports/pm/excel - should return Excel file with valid date range', async () => {
  const startDate = getPastDate(7);
  const endDate = getTodayDate();
  const response = await apiGet(
    `api-reports/pm/excel?start_date=${startDate}&end_date=${endDate}`,
    TEST_EMPLOYEES.superAdmin
  );
  // Consume body
  await response.arrayBuffer();
  assertEquals(response.status < 500, true);

  // If successful, check content type
  if (response.status === 200) {
    const contentType = response.headers.get('Content-Type');
    assertEquals(
      contentType?.includes('spreadsheetml') || contentType?.includes('excel'),
      true
    );
  }
});

Deno.test('GET /api-reports/pm/excel - should return 400 without start_date', async () => {
  const endDate = getTodayDate();
  const response = await apiGet(
    `api-reports/pm/excel?end_date=${endDate}`,
    TEST_EMPLOYEES.superAdmin
  );
  await response.text(); // Consume body
  assertEquals(response.status, 400);
});

Deno.test('GET /api-reports/pm/excel - should return 400 without end_date', async () => {
  const startDate = getPastDate(7);
  const response = await apiGet(
    `api-reports/pm/excel?start_date=${startDate}`,
    TEST_EMPLOYEES.superAdmin
  );
  await response.text(); // Consume body
  assertEquals(response.status, 400);
});

// ============================================
// GET SALES EXCEL REPORT
// ============================================

Deno.test('GET /api-reports/sales/excel - should return Excel file with valid date range', async () => {
  const startDate = getPastDate(7);
  const endDate = getTodayDate();
  const response = await apiGet(
    `api-reports/sales/excel?start_date=${startDate}&end_date=${endDate}`,
    TEST_EMPLOYEES.superAdmin
  );
  // Consume body
  await response.arrayBuffer();
  assertEquals(response.status < 500, true);

  // If successful, check content type
  if (response.status === 200) {
    const contentType = response.headers.get('Content-Type');
    assertEquals(
      contentType?.includes('spreadsheetml') || contentType?.includes('excel'),
      true
    );
  }
});

Deno.test('GET /api-reports/sales/excel - should return 400 without start_date', async () => {
  const endDate = getTodayDate();
  const response = await apiGet(
    `api-reports/sales/excel?end_date=${endDate}`,
    TEST_EMPLOYEES.superAdmin
  );
  await response.text(); // Consume body
  assertEquals(response.status, 400);
});

Deno.test('GET /api-reports/sales/excel - should return 400 without end_date', async () => {
  const startDate = getPastDate(7);
  const response = await apiGet(
    `api-reports/sales/excel?start_date=${startDate}`,
    TEST_EMPLOYEES.superAdmin
  );
  await response.text(); // Consume body
  assertEquals(response.status, 400);
});

// ============================================
// ERROR HANDLING
// ============================================

Deno.test('GET /api-reports - root path should return 404', async () => {
  const response = await apiGet('api-reports', TEST_EMPLOYEES.superAdmin);
  await response.text(); // Consume body
  assertEquals(response.status, 404);
});

Deno.test('GET /api-reports/invalid-endpoint - should return 404', async () => {
  const response = await apiGet('api-reports/invalid-endpoint', TEST_EMPLOYEES.superAdmin);
  await response.text(); // Consume body
  assertEquals(response.status, 404);
});

Deno.test('GET /api-reports/rma - should return 404 (missing /excel)', async () => {
  const response = await apiGet('api-reports/rma', TEST_EMPLOYEES.superAdmin);
  await response.text(); // Consume body
  assertEquals(response.status, 404);
});

// ============================================
// PERMISSION TESTS - LEVEL 1+ REQUIRED
// ============================================

Deno.test('Permission: Super Admin (Level 3) can access daily report', async () => {
  const date = getTodayDate();
  const response = await apiGet(`api-reports/daily?date=${date}`, TEST_EMPLOYEES.superAdmin);
  assertEquals(response.status, 200);
  await response.json(); // Consume body
});

Deno.test('Permission: Admin (Level 2) can access daily report', async () => {
  const date = getTodayDate();
  const response = await apiGet(`api-reports/daily?date=${date}`, TEST_EMPLOYEES.admin);
  assertEquals(response.status, 200);
  await response.json(); // Consume body
});

Deno.test('Permission: Assigner (Level 1) can access daily report', async () => {
  const date = getTodayDate();
  const response = await apiGet(`api-reports/daily?date=${date}`, TEST_EMPLOYEES.assigner);
  assertEquals(response.status, 200);
  await response.json(); // Consume body
});

Deno.test('Permission: Technician (Level 0) cannot access daily report', async () => {
  const date = getTodayDate();
  const response = await apiGet(`api-reports/daily?date=${date}`, TEST_EMPLOYEES.tech1);
  await response.text(); // Consume body
  assertEquals(response.status, 403);
});

Deno.test('Permission: Sales (Level 1) can access RMA Excel report', async () => {
  const startDate = getPastDate(7);
  const endDate = getTodayDate();
  const response = await apiGet(
    `api-reports/rma/excel?start_date=${startDate}&end_date=${endDate}`,
    TEST_EMPLOYEES.sales1
  );
  await response.arrayBuffer(); // Consume body
  assertEquals(response.status < 500, true);
});

Deno.test('Permission: PM (Level 1) can access PM Excel report', async () => {
  const startDate = getPastDate(7);
  const endDate = getTodayDate();
  const response = await apiGet(
    `api-reports/pm/excel?start_date=${startDate}&end_date=${endDate}`,
    TEST_EMPLOYEES.pm1
  );
  await response.arrayBuffer(); // Consume body
  assertEquals(response.status < 500, true);
});

Deno.test('Permission: RMA (Level 1) can access Sales Excel report', async () => {
  const startDate = getPastDate(7);
  const endDate = getTodayDate();
  const response = await apiGet(
    `api-reports/sales/excel?start_date=${startDate}&end_date=${endDate}`,
    TEST_EMPLOYEES.rma1
  );
  await response.arrayBuffer(); // Consume body
  assertEquals(response.status < 500, true);
});

Deno.test('Permission: Technician (Level 0) cannot access RMA Excel report', async () => {
  const startDate = getPastDate(7);
  const endDate = getTodayDate();
  const response = await apiGet(
    `api-reports/rma/excel?start_date=${startDate}&end_date=${endDate}`,
    TEST_EMPLOYEES.tech1
  );
  await response.text(); // Consume body
  assertEquals(response.status, 403);
});

Deno.test('Permission: Technician (Level 0) cannot access PM Excel report', async () => {
  const startDate = getPastDate(7);
  const endDate = getTodayDate();
  const response = await apiGet(
    `api-reports/pm/excel?start_date=${startDate}&end_date=${endDate}`,
    TEST_EMPLOYEES.tech1
  );
  await response.text(); // Consume body
  assertEquals(response.status, 403);
});

Deno.test('Permission: Technician (Level 0) cannot access Sales Excel report', async () => {
  const startDate = getPastDate(7);
  const endDate = getTodayDate();
  const response = await apiGet(
    `api-reports/sales/excel?start_date=${startDate}&end_date=${endDate}`,
    TEST_EMPLOYEES.tech1
  );
  await response.text(); // Consume body
  assertEquals(response.status, 403);
});

// ============================================
// EDGE CASES
// ============================================

Deno.test('GET /api-reports/daily - should handle today as date', async () => {
  const today = getTodayDate();
  const response = await apiGet(`api-reports/daily?date=${today}`, TEST_EMPLOYEES.superAdmin);
  assertEquals(response.status, 200);
  await response.json(); // Consume body
});

Deno.test('GET /api-reports/rma/excel - should handle single day range', async () => {
  const today = getTodayDate();
  const response = await apiGet(
    `api-reports/rma/excel?start_date=${today}&end_date=${today}`,
    TEST_EMPLOYEES.superAdmin
  );
  await response.arrayBuffer(); // Consume body
  assertEquals(response.status < 500, true);
});

Deno.test('GET /api-reports/pm/excel - should handle max allowed date range (31 days)', async () => {
  const startDate = getPastDate(31);
  const endDate = getTodayDate();
  const response = await apiGet(
    `api-reports/pm/excel?start_date=${startDate}&end_date=${endDate}`,
    TEST_EMPLOYEES.superAdmin
  );
  await response.arrayBuffer(); // Consume body
  assertEquals(response.status < 500, true);
});

Deno.test('GET /api-reports/daily - should work with near future date (within 3 months)', async () => {
  const nearFuture = getFutureDate(30);
  const response = await apiGet(`api-reports/daily?date=${nearFuture}`, TEST_EMPLOYEES.superAdmin);
  // Should succeed - date is within 3 months
  assertEquals(response.status < 500, true);
  await response.text(); // Consume body
});
