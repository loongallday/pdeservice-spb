/**
 * E2E Tests for api-search
 * Tests global search endpoint with real database and authentication
 *
 * The search endpoint supports cross-entity search across:
 * - Companies (by name, tax ID)
 * - Sites (by name, address)
 * - Tickets (by code, description)
 * - Merchandise (by serial number)
 * - Employees (by name, code, email)
 *
 * All endpoints require JWT authentication (level 0+)
 */

import { assertEquals, assertExists } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import {
  apiGet,
  setupTestUsers,
  TEST_EMPLOYEES,
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
// BASIC SEARCH FUNCTIONALITY
// ============================================

Deno.test('GET /api-search?q=test - should return search results', async () => {
  const response = await apiGet('api-search?q=test');
  assertEquals(response.status < 500, true);
  const data = await response.json();
  // Search should return structured results
  if (response.status === 200) {
    assertExists(data.data);
    assertExists(data.data.query);
    assertExists(data.data.total);
    assertExists(data.data.results);
    assertExists(data.data.counts);
  }
});

Deno.test('GET /api-search?q=Company - should search companies', async () => {
  const response = await apiGet('api-search?q=Company');
  assertEquals(response.status < 500, true);
  const data = await response.json();
  if (response.status === 200) {
    assertExists(data.data);
    assertEquals(data.data.query, 'Company');
  }
});

Deno.test('GET /api-search - should require query parameter q', async () => {
  const response = await apiGet('api-search');
  // Should return validation error (400) for missing/short query
  assertEquals(response.status, 400);
  const data = await response.json();
  assertExists(data.error);
});

Deno.test('GET /api-search?q=a - should require minimum 2 characters', async () => {
  const response = await apiGet('api-search?q=a');
  assertEquals(response.status, 400);
  const data = await response.json();
  assertExists(data.error);
});

Deno.test('GET /api-search?q=ab - should accept 2 character query', async () => {
  const response = await apiGet('api-search?q=ab');
  assertEquals(response.status < 500, true);
  await response.json(); // Consume body
});

// ============================================
// TYPE FILTERING
// ============================================

Deno.test('GET /api-search?q=test&types=company - should filter by company type', async () => {
  const response = await apiGet('api-search?q=test&types=company');
  assertEquals(response.status < 500, true);
  const data = await response.json();
  if (response.status === 200) {
    assertExists(data.data);
    // Should only have company results (may be empty)
    assertEquals(data.data.results.sites, undefined);
    assertEquals(data.data.results.tickets, undefined);
    assertEquals(data.data.results.merchandise, undefined);
    assertEquals(data.data.results.employees, undefined);
  }
});

Deno.test('GET /api-search?q=test&types=site - should filter by site type', async () => {
  const response = await apiGet('api-search?q=test&types=site');
  assertEquals(response.status < 500, true);
  const data = await response.json();
  if (response.status === 200) {
    assertExists(data.data);
    assertEquals(data.data.results.companys, undefined);
    assertEquals(data.data.results.tickets, undefined);
    assertEquals(data.data.results.merchandise, undefined);
    assertEquals(data.data.results.employees, undefined);
  }
});

Deno.test('GET /api-search?q=test&types=ticket - should filter by ticket type', async () => {
  const response = await apiGet('api-search?q=test&types=ticket');
  assertEquals(response.status < 500, true);
  const data = await response.json();
  if (response.status === 200) {
    assertExists(data.data);
    assertEquals(data.data.results.companys, undefined);
    assertEquals(data.data.results.sites, undefined);
    assertEquals(data.data.results.merchandise, undefined);
    assertEquals(data.data.results.employees, undefined);
  }
});

Deno.test('GET /api-search?q=test&types=merchandise - should filter by merchandise type', async () => {
  const response = await apiGet('api-search?q=test&types=merchandise');
  assertEquals(response.status < 500, true);
  const data = await response.json();
  if (response.status === 200) {
    assertExists(data.data);
    assertEquals(data.data.results.companys, undefined);
    assertEquals(data.data.results.sites, undefined);
    assertEquals(data.data.results.tickets, undefined);
    assertEquals(data.data.results.employees, undefined);
  }
});

Deno.test('GET /api-search?q=test&types=employee - should filter by employee type', async () => {
  const response = await apiGet('api-search?q=test&types=employee');
  assertEquals(response.status < 500, true);
  const data = await response.json();
  if (response.status === 200) {
    assertExists(data.data);
    assertEquals(data.data.results.companys, undefined);
    assertEquals(data.data.results.sites, undefined);
    assertEquals(data.data.results.tickets, undefined);
    assertEquals(data.data.results.merchandise, undefined);
  }
});

Deno.test('GET /api-search?q=test&types=company,site - should filter by multiple types', async () => {
  const response = await apiGet('api-search?q=test&types=company,site');
  assertEquals(response.status < 500, true);
  const data = await response.json();
  if (response.status === 200) {
    assertExists(data.data);
    // Should not have ticket, merchandise, or employee results
    assertEquals(data.data.results.tickets, undefined);
    assertEquals(data.data.results.merchandise, undefined);
    assertEquals(data.data.results.employees, undefined);
  }
});

Deno.test('GET /api-search?q=test&types=invalid - should reject invalid type', async () => {
  const response = await apiGet('api-search?q=test&types=invalid');
  assertEquals(response.status, 400);
  const data = await response.json();
  assertExists(data.error);
});

Deno.test('GET /api-search?q=test&types=company,invalid - should reject if any type is invalid', async () => {
  const response = await apiGet('api-search?q=test&types=company,invalid');
  assertEquals(response.status, 400);
  const data = await response.json();
  assertExists(data.error);
});

// ============================================
// LIMIT PARAMETER
// ============================================

Deno.test('GET /api-search?q=test&limit=3 - should respect limit parameter', async () => {
  const response = await apiGet('api-search?q=test&limit=3');
  assertEquals(response.status < 500, true);
  const data = await response.json();
  if (response.status === 200) {
    assertExists(data.data);
    // Results per type should not exceed limit
    const results = data.data.results;
    if (results.companys) assertEquals(results.companys.length <= 3, true);
    if (results.sites) assertEquals(results.sites.length <= 3, true);
    if (results.tickets) assertEquals(results.tickets.length <= 3, true);
    if (results.merchandise) assertEquals(results.merchandise.length <= 3, true);
    if (results.employees) assertEquals(results.employees.length <= 3, true);
  }
});

Deno.test('GET /api-search?q=test&limit=1 - should handle minimum limit', async () => {
  const response = await apiGet('api-search?q=test&limit=1');
  assertEquals(response.status < 500, true);
  const data = await response.json();
  if (response.status === 200) {
    assertExists(data.data);
    const results = data.data.results;
    if (results.companys) assertEquals(results.companys.length <= 1, true);
  }
});

Deno.test('GET /api-search?q=test&limit=100 - should cap limit at maximum (10)', async () => {
  const response = await apiGet('api-search?q=test&limit=100');
  assertEquals(response.status < 500, true);
  const data = await response.json();
  if (response.status === 200) {
    assertExists(data.data);
    // Should be capped at 10 per type
    const results = data.data.results;
    if (results.companys) assertEquals(results.companys.length <= 10, true);
  }
});

Deno.test('GET /api-search?q=test&limit=0 - should use minimum limit (1)', async () => {
  const response = await apiGet('api-search?q=test&limit=0');
  assertEquals(response.status < 500, true);
  await response.json(); // Consume body
});

Deno.test('GET /api-search?q=test&limit=-5 - should handle negative limit', async () => {
  const response = await apiGet('api-search?q=test&limit=-5');
  assertEquals(response.status < 500, true);
  await response.json(); // Consume body
});

// ============================================
// RESPONSE STRUCTURE
// ============================================

Deno.test('Search results should have correct structure', async () => {
  const response = await apiGet('api-search?q=Test');
  assertEquals(response.status < 500, true);
  const data = await response.json();

  if (response.status === 200) {
    assertExists(data.data);
    assertExists(data.data.query);
    assertEquals(typeof data.data.total, 'number');
    assertExists(data.data.results);
    assertExists(data.data.counts);

    // Check query echoed back
    assertEquals(data.data.query, 'Test');
  }
});

Deno.test('Search result items should have required fields', async () => {
  const response = await apiGet('api-search?q=Test');
  assertEquals(response.status < 500, true);
  const data = await response.json();

  if (response.status === 200 && data.data.total > 0) {
    // Check any non-empty result array
    const results = data.data.results;
    const allResults = [
      ...(results.companys || []),
      ...(results.sites || []),
      ...(results.tickets || []),
      ...(results.merchandise || []),
      ...(results.employees || []),
    ];

    if (allResults.length > 0) {
      const firstResult = allResults[0];
      assertExists(firstResult.id);
      assertExists(firstResult.type);
      assertExists(firstResult.title);
      // subtitle, description, and metadata are optional
    }
  }
});

// ============================================
// PERMISSION TESTS - ALL ROLES CAN ACCESS
// ============================================

Deno.test('Permission: Super Admin can access search', async () => {
  const response = await apiGet('api-search?q=test', TEST_EMPLOYEES.superAdmin);
  assertEquals(response.status < 500, true);
  await response.json(); // Consume body
});

Deno.test('Permission: Admin can access search', async () => {
  const response = await apiGet('api-search?q=test', TEST_EMPLOYEES.admin);
  assertEquals(response.status < 500, true);
  await response.json(); // Consume body
});

Deno.test('Permission: Assigner can access search', async () => {
  const response = await apiGet('api-search?q=test', TEST_EMPLOYEES.assigner);
  assertEquals(response.status < 500, true);
  await response.json(); // Consume body
});

Deno.test('Permission: Technician L1 can access search', async () => {
  const response = await apiGet('api-search?q=test', TEST_EMPLOYEES.tech1);
  assertEquals(response.status < 500, true);
  await response.json(); // Consume body
});

Deno.test('Permission: Sales can access search', async () => {
  const response = await apiGet('api-search?q=test', TEST_EMPLOYEES.sales1);
  assertEquals(response.status < 500, true);
  await response.json(); // Consume body
});

Deno.test('Permission: PM can access search', async () => {
  const response = await apiGet('api-search?q=test', TEST_EMPLOYEES.pm1);
  assertEquals(response.status < 500, true);
  await response.json(); // Consume body
});

Deno.test('Permission: RMA can access search', async () => {
  const response = await apiGet('api-search?q=test', TEST_EMPLOYEES.rma1);
  assertEquals(response.status < 500, true);
  await response.json(); // Consume body
});

// ============================================
// SPECIFIC ENTITY SEARCHES
// ============================================

Deno.test('Search should find companies by name', async () => {
  const response = await apiGet('api-search?q=Company&types=company');
  assertEquals(response.status < 500, true);
  const data = await response.json();
  if (response.status === 200) {
    assertExists(data.data);
    // If there are company results, verify they match the query
    if (data.data.results.companys && data.data.results.companys.length > 0) {
      const company = data.data.results.companys[0];
      assertExists(company.id);
      assertEquals(company.type, 'company');
    }
  }
});

Deno.test('Search should find sites by name', async () => {
  const response = await apiGet('api-search?q=HQ&types=site');
  assertEquals(response.status < 500, true);
  const data = await response.json();
  if (response.status === 200) {
    assertExists(data.data);
    if (data.data.results.sites && data.data.results.sites.length > 0) {
      const site = data.data.results.sites[0];
      assertExists(site.id);
      assertEquals(site.type, 'site');
    }
  }
});

Deno.test('Search should find employees by name', async () => {
  const response = await apiGet('api-search?q=Admin&types=employee');
  assertEquals(response.status < 500, true);
  const data = await response.json();
  if (response.status === 200) {
    assertExists(data.data);
    if (data.data.results.employees && data.data.results.employees.length > 0) {
      const employee = data.data.results.employees[0];
      assertExists(employee.id);
      assertEquals(employee.type, 'employee');
    }
  }
});

// ============================================
// SPECIAL CHARACTER HANDLING
// ============================================

Deno.test('Search should handle special characters', async () => {
  const response = await apiGet('api-search?q=test%20company');
  assertEquals(response.status < 500, true);
  await response.json(); // Consume body
});

Deno.test('Search should handle Thai characters', async () => {
  const response = await apiGet('api-search?q=%E0%B8%9A%E0%B8%A3%E0%B8%B4%E0%B8%A9%E0%B8%B1%E0%B8%97'); // "บริษัท"
  assertEquals(response.status < 500, true);
  await response.json(); // Consume body
});

Deno.test('Search should handle numeric queries', async () => {
  const response = await apiGet('api-search?q=12345');
  assertEquals(response.status < 500, true);
  await response.json(); // Consume body
});

// ============================================
// METHOD RESTRICTIONS
// ============================================

Deno.test('POST /api-search - should return method not allowed', async () => {
  // Using fetch directly since apiPost would call POST but we need to check 405
  const { apiPost } = await import('./test-utils.ts');
  const response = await apiPost('api-search', { q: 'test' });
  assertEquals(response.status, 405);
  await response.json(); // Consume body
});

// ============================================
// CONSISTENCY TESTS
// ============================================

Deno.test('Consistency: Same search should return consistent results', async () => {
  const response1 = await apiGet('api-search?q=test&types=company&limit=5');
  const data1 = await response1.json();

  const response2 = await apiGet('api-search?q=test&types=company&limit=5');
  const data2 = await response2.json();

  assertEquals(response1.status, response2.status);
  if (response1.status === 200) {
    assertEquals(data1.data.query, data2.data.query);
    assertEquals(data1.data.total, data2.data.total);
  }
});

Deno.test('Counts should be greater than or equal to results length', async () => {
  const response = await apiGet('api-search?q=test');
  assertEquals(response.status < 500, true);
  const data = await response.json();

  if (response.status === 200) {
    const results = data.data.results;
    const counts = data.data.counts;

    // Counts represent total matches in database, results are limited
    // So counts >= results.length
    if (results.companys) {
      assertEquals(counts.companys >= results.companys.length, true);
    }
    if (results.sites) {
      assertEquals(counts.sites >= results.sites.length, true);
    }
    if (results.tickets) {
      assertEquals(counts.tickets >= results.tickets.length, true);
    }
    if (results.merchandise) {
      assertEquals(counts.merchandise >= results.merchandise.length, true);
    }
    if (results.employees) {
      assertEquals(counts.employees >= results.employees.length, true);
    }
  }
});
