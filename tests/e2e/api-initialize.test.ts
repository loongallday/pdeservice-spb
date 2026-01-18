/**
 * E2E Tests for api-initialize
 * Tests all initialize operations with real database and authentication
 */

import { assertEquals, assertExists } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import {
  apiGet,
  setupTestUsers,
  TEST_EMPLOYEES,
} from './test-utils.ts';

const BASE_URL = 'http://localhost:54321/functions/v1';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

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
// GET /warmup - No auth required
// ============================================

Deno.test('GET /api-initialize/warmup - should return warm status without auth', async () => {
  const response = await fetch(`${BASE_URL}/api-initialize/warmup`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'apikey': ANON_KEY,
    },
  });

  assertEquals(response.status, 200);
  const data = await response.json();
  assertEquals(data.status, 'warm');
  assertExists(data.timestamp);
});

// ============================================
// GET /me - Get current user info with constants
// ============================================

Deno.test('GET /api-initialize/me - should return current user info for superadmin', async () => {
  const response = await apiGet('api-initialize/me', TEST_EMPLOYEES.superAdmin);
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
});

Deno.test('GET /api-initialize/me - should return employee data with constants', async () => {
  const response = await apiGet('api-initialize/me', TEST_EMPLOYEES.superAdmin);
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
  // The response should contain user profile data
  const userData = data.data;
  assertExists(userData);
});

Deno.test('GET /api-initialize/me - should work for admin user', async () => {
  const response = await apiGet('api-initialize/me', TEST_EMPLOYEES.admin);
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
});

Deno.test('GET /api-initialize/me - should work for assigner user', async () => {
  const response = await apiGet('api-initialize/me', TEST_EMPLOYEES.assigner);
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
});

Deno.test('GET /api-initialize/me - should work for technician (level 0)', async () => {
  const response = await apiGet('api-initialize/me', TEST_EMPLOYEES.tech1);
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
});

Deno.test('GET /api-initialize/me - should return 401 without authentication', async () => {
  const response = await fetch(`${BASE_URL}/api-initialize/me`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'apikey': ANON_KEY,
    },
  });

  await response.text(); // Consume body to avoid leak
  assertEquals(response.status, 401);
});

// ============================================
// GET /features - Get enabled features
// ============================================

Deno.test('GET /api-initialize/features - should return features for superadmin', async () => {
  const response = await apiGet('api-initialize/features', TEST_EMPLOYEES.superAdmin);
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
});

Deno.test('GET /api-initialize/features - should return features for admin', async () => {
  const response = await apiGet('api-initialize/features', TEST_EMPLOYEES.admin);
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
});

Deno.test('GET /api-initialize/features - should return features for technician', async () => {
  const response = await apiGet('api-initialize/features', TEST_EMPLOYEES.tech1);
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
});

Deno.test('GET /api-initialize/features - should return 401 without authentication', async () => {
  const response = await fetch(`${BASE_URL}/api-initialize/features`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'apikey': ANON_KEY,
    },
  });

  await response.text(); // Consume body to avoid leak
  assertEquals(response.status, 401);
});

// ============================================
// NOT FOUND - Invalid routes
// ============================================

Deno.test('GET /api-initialize/invalid - should return 404 for invalid route', async () => {
  const response = await apiGet('api-initialize/invalid', TEST_EMPLOYEES.superAdmin);
  await response.text(); // Consume body to avoid leak
  assertEquals(response.status, 404);
});

// ============================================
// PERMISSION TESTS - All levels can access
// ============================================

Deno.test('Permission: Sales user can access /me', async () => {
  const response = await apiGet('api-initialize/me', TEST_EMPLOYEES.sales1);
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
});

Deno.test('Permission: PM user can access /me', async () => {
  const response = await apiGet('api-initialize/me', TEST_EMPLOYEES.pm1);
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
});

Deno.test('Permission: RMA user can access /me', async () => {
  const response = await apiGet('api-initialize/me', TEST_EMPLOYEES.rma1);
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
});

Deno.test('Permission: Stock user can access /features', async () => {
  const response = await apiGet('api-initialize/features', TEST_EMPLOYEES.stock);
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
});
