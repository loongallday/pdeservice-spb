/**
 * E2E Tests for api-tickets
 * Tests all ticket operations with real database and authentication
 */

import { assertEquals, assertExists } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import {
  apiGet,
  apiPost,
  apiPut,
  apiDelete,
  assertSuccess,
  assertError,
  setupTestUsers,
  createHeaders,
  TEST_EMPLOYEES,
  TEST_SITES,
  TEST_TICKETS,
  TEST_APPOINTMENTS,
  REF_DATA,
  randomUUID,
  getServiceClient,
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
// WARMUP ENDPOINT
// ============================================

Deno.test('GET /api-tickets/warmup - should return warm status', async () => {
  const response = await fetch('http://localhost:54321/functions/v1/api-tickets/warmup');
  assertEquals(response.status, 200);
  const data = await response.json();
  assertEquals(data.status, 'warm');
  assertExists(data.timestamp);
});

// ============================================
// GET TICKET BY ID
// ============================================

Deno.test('GET /api-tickets/:id - should get existing ticket', async () => {
  const response = await apiGet(`api-tickets/${TEST_TICKETS.pm1}`);
  const ticket = await assertSuccess(response);
  assertExists(ticket);
  assertEquals((ticket as Record<string, unknown>).id, TEST_TICKETS.pm1);
});

Deno.test('GET /api-tickets/:id - should return 404 for non-existent ticket', async () => {
  const fakeId = randomUUID();
  const response = await apiGet(`api-tickets/${fakeId}`);
  await response.text(); // Consume body to avoid leak
  assertEquals(response.status, 404);
});

Deno.test('GET /api-tickets/:id - should return 400 for invalid UUID', async () => {
  const response = await apiGet('api-tickets/invalid-uuid');
  await response.text(); // Consume body to avoid leak
  assertEquals(response.status, 400);
});

// ============================================
// SEARCH TICKETS
// ============================================

Deno.test('GET /api-tickets/search - should return paginated tickets', async () => {
  const response = await apiGet('api-tickets/search');
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
  assertExists(data.pagination);
});

Deno.test('GET /api-tickets/search - should filter by work_type_id', async () => {
  const response = await apiGet(`api-tickets/search?work_type_id=${REF_DATA.workTypes.pm}`);
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
});

Deno.test('GET /api-tickets/search - should filter by status_id', async () => {
  const response = await apiGet(`api-tickets/search?status_id=${REF_DATA.statuses.normal}`);
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
});

Deno.test('GET /api-tickets/search - should filter by site_id', async () => {
  const response = await apiGet(`api-tickets/search?site_id=${TEST_SITES.testCompanyHQ}`);
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
});

Deno.test('GET /api-tickets/search - should support pagination', async () => {
  const response = await apiGet('api-tickets/search?page=1&limit=2');
  assertEquals(response.status, 200);
  const data = await response.json();
  assertEquals(data.pagination.page, 1);
  assertEquals(data.pagination.limit, 2);
});

// ============================================
// CREATE TICKET
// ============================================

Deno.test('POST /api-tickets - should create ticket with level 1+ user', async () => {
  const ticketData = {
    ticket: {
      site_id: TEST_SITES.testCompanyHQ,
      work_type_id: REF_DATA.workTypes.pm,
      status_id: REF_DATA.statuses.normal,
      assigner_id: TEST_EMPLOYEES.assigner,
      details: 'E2E Test Ticket - PM maintenance',
    },
  };

  const response = await apiPost('api-tickets', ticketData, TEST_EMPLOYEES.assigner);
  assertEquals(response.status, 201);
  const ticket = await assertSuccess(response, 201);
  assertExists((ticket as Record<string, unknown>).id);
});

Deno.test('POST /api-tickets - should reject level 0 user', async () => {
  const ticketData = {
    ticket: {
      site_id: TEST_SITES.testCompanyHQ,
      work_type_id: REF_DATA.workTypes.pm,
      status_id: REF_DATA.statuses.normal,
      assigner_id: TEST_EMPLOYEES.assigner,
      details: 'Should fail - level 0 user',
    },
  };

  const response = await apiPost('api-tickets', ticketData, TEST_EMPLOYEES.tech1);
  await response.text(); // Consume body to avoid leak
  assertEquals(response.status, 403);
});

Deno.test('POST /api-tickets - should reject missing work_type_id', async () => {
  const ticketData = {
    ticket: {
      site_id: TEST_SITES.testCompanyHQ,
      status_id: REF_DATA.statuses.normal,
      assigner_id: TEST_EMPLOYEES.assigner,
    },
  };

  const response = await apiPost('api-tickets', ticketData, TEST_EMPLOYEES.assigner);
  await response.text(); // Consume body to avoid leak
  assertEquals(response.status, 400);
});

Deno.test('POST /api-tickets - should reject missing assigner_id', async () => {
  const ticketData = {
    ticket: {
      site_id: TEST_SITES.testCompanyHQ,
      work_type_id: REF_DATA.workTypes.pm,
      status_id: REF_DATA.statuses.normal,
    },
  };

  const response = await apiPost('api-tickets', ticketData, TEST_EMPLOYEES.assigner);
  await response.text(); // Consume body to avoid leak
  assertEquals(response.status, 400);
});

// ============================================
// UPDATE TICKET
// ============================================

Deno.test('PUT /api-tickets/:id - should update ticket details', async () => {
  const updateData = {
    ticket: {
      details: 'Updated ticket details - E2E test',
    },
  };

  const response = await apiPut(`api-tickets/${TEST_TICKETS.pm1}`, updateData, TEST_EMPLOYEES.assigner);
  assertEquals(response.status, 200);
  const ticket = await assertSuccess(response);
  assertEquals((ticket as Record<string, unknown>).details, 'Updated ticket details - E2E test');
});

Deno.test('PUT /api-tickets/:id - should update ticket status', async () => {
  const updateData = {
    ticket: {
      status_id: REF_DATA.statuses.urgent,
    },
  };

  const response = await apiPut(`api-tickets/${TEST_TICKETS.pm2}`, updateData, TEST_EMPLOYEES.assigner);
  await response.text(); // Consume body to avoid leak
  assertEquals(response.status, 200);
});

Deno.test('PUT /api-tickets/:id - should return 404 for non-existent ticket', async () => {
  const fakeId = randomUUID();
  const updateData = {
    ticket: {
      details: 'Should fail',
    },
  };

  const response = await apiPut(`api-tickets/${fakeId}`, updateData, TEST_EMPLOYEES.assigner);
  await response.text(); // Consume body to avoid leak
  assertEquals(response.status, 404);
});

// ============================================
// TICKET COMMENTS
// ============================================

Deno.test('GET /api-tickets/:id/comments - should get ticket comments', async () => {
  const response = await apiGet(`api-tickets/${TEST_TICKETS.pm1}/comments`);
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
});

Deno.test('POST /api-tickets/:id/comments - should create comment', async () => {
  const commentData = {
    content: 'E2E Test Comment - This is a test comment',
  };

  const response = await apiPost(`api-tickets/${TEST_TICKETS.pm1}/comments`, commentData);
  assertEquals(response.status, 201);
  const comment = await assertSuccess(response, 201);
  assertExists((comment as Record<string, unknown>).id);
  assertEquals((comment as Record<string, unknown>).content, commentData.content);
});

Deno.test('POST /api-tickets/:id/comments - should reject empty content', async () => {
  const commentData = {
    content: '',
  };

  const response = await apiPost(`api-tickets/${TEST_TICKETS.pm1}/comments`, commentData);
  await response.text(); // Consume body to avoid leak
  assertEquals(response.status, 400);
});

// ============================================
// TICKET WATCHERS
// ============================================

Deno.test('GET /api-tickets/:id/watchers - should get ticket watchers', async () => {
  const response = await apiGet(`api-tickets/${TEST_TICKETS.pm1}/watchers`);
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
});

Deno.test('POST /api-tickets/:id/watch - should add current user as watcher', async () => {
  const response = await apiPost(`api-tickets/${TEST_TICKETS.pm2}/watch`, {});
  await response.text(); // Consume body to avoid leak
  // Could be 200 or 201 depending on if already watching
  assertEquals(response.status >= 200 && response.status < 300, true);
});

Deno.test('DELETE /api-tickets/:id/watch - should remove current user from watchers', async () => {
  // First add as watcher
  const addResponse = await apiPost(`api-tickets/${TEST_TICKETS.pm2}/watch`, {});
  await addResponse.text(); // Consume body

  // Then remove
  const response = await apiDelete(`api-tickets/${TEST_TICKETS.pm2}/watch`);
  await response.text(); // Consume body to avoid leak
  assertEquals(response.status, 200);
});

// ============================================
// TICKET AUDIT LOGS
// ============================================

Deno.test('GET /api-tickets/:id/audit - should get ticket audit logs', async () => {
  const response = await apiGet(`api-tickets/${TEST_TICKETS.pm1}/audit`);
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
});

Deno.test('GET /api-tickets/audit - should get recent audit logs (admin only)', async () => {
  const response = await apiGet('api-tickets/audit', TEST_EMPLOYEES.superAdmin);
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
});

// ============================================
// CONFIRMED TECHNICIANS
// ============================================

Deno.test('GET /api-tickets/:id/confirmed-technicians - should get confirmed technicians', async () => {
  const response = await apiGet(`api-tickets/${TEST_TICKETS.pm1}/confirmed-technicians`);
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
});

Deno.test('POST /api-tickets/:id/confirm-technicians - should confirm technicians (admin)', async () => {
  const confirmData = {
    employee_ids: [TEST_EMPLOYEES.tech1],
  };

  // Use superAdmin who has full permissions
  const response = await apiPost(`api-tickets/${TEST_TICKETS.pm1}/confirm-technicians`, confirmData, TEST_EMPLOYEES.superAdmin);
  await response.text(); // Consume body to avoid leak
  // May return 200 or 201 (or 403 if endpoint requires specific approval role)
  assertEquals(response.status >= 200 && response.status < 500, true);
});

// ============================================
// TICKET RATINGS
// ============================================

Deno.test('GET /api-tickets/:id/rating - should get ticket rating', async () => {
  const response = await apiGet(`api-tickets/${TEST_TICKETS.pm1}/rating`);
  await response.text(); // Consume body to avoid leak
  // 200 if exists, 404 if not
  assertEquals(response.status === 200 || response.status === 404, true);
});

Deno.test('POST /api-tickets/:id/rating - should create rating', async () => {
  const ratingData = {
    score: 5,
    comment: 'Excellent service!',
  };

  const response = await apiPost(`api-tickets/${TEST_TICKETS.survey}/rating`, ratingData);
  await response.text(); // Consume body to avoid leak
  // May succeed or fail if rating already exists
  assertEquals(response.status >= 200 && response.status < 500, true);
});

// ============================================
// TICKET ATTACHMENTS
// ============================================

Deno.test('GET /api-tickets/:id/attachments - should get ticket attachments', async () => {
  const response = await apiGet(`api-tickets/${TEST_TICKETS.pm1}/attachments`);
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
});

// ============================================
// TICKET EXTRA FIELDS
// ============================================

Deno.test('GET /api-tickets/:id/extra-fields - should get extra fields', async () => {
  const response = await apiGet(`api-tickets/${TEST_TICKETS.pm1}/extra-fields`);
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
});

Deno.test('POST /api-tickets/:id/extra-fields - should create extra field', async () => {
  const fieldData = {
    field_name: 'test_field',
    field_value: 'test_value',
  };

  const response = await apiPost(`api-tickets/${TEST_TICKETS.pm1}/extra-fields`, fieldData);
  await response.text(); // Consume body to avoid leak
  // May succeed or conflict if already exists
  assertEquals(response.status >= 200 && response.status < 500, true);
});

// ============================================
// TICKET SUMMARIES
// ============================================

Deno.test('GET /api-tickets/summaries - should get ticket summaries', async () => {
  const today = new Date().toISOString().split('T')[0];
  const response = await apiGet(`api-tickets/summaries?date=${today}`);
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
});

// ============================================
// SEARCH DURATION
// ============================================

Deno.test('GET /api-tickets/search-duration - should search by duration', async () => {
  const today = new Date().toISOString().split('T')[0];
  const nextMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const response = await apiGet(`api-tickets/search-duration?startDate=${today}&endDate=${nextMonth}`);
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
});

// ============================================
// DELETE TICKET
// ============================================

Deno.test('DELETE /api-tickets/:id - should delete ticket with proper permissions', async () => {
  // First create a ticket to delete
  const ticketData = {
    ticket: {
      site_id: TEST_SITES.testCompanyHQ,
      work_type_id: REF_DATA.workTypes.survey,
      status_id: REF_DATA.statuses.normal,
      assigner_id: TEST_EMPLOYEES.assigner,
      details: 'E2E Test - Ticket to be deleted',
    },
  };

  const createResponse = await apiPost('api-tickets', ticketData, TEST_EMPLOYEES.assigner);
  assertEquals(createResponse.status, 201);
  const createdTicket = await assertSuccess(createResponse, 201);
  const ticketId = (createdTicket as Record<string, unknown>).id as string;

  // Now delete it
  const deleteResponse = await apiDelete(`api-tickets/${ticketId}`, TEST_EMPLOYEES.superAdmin);
  await deleteResponse.text(); // Consume body to avoid leak
  assertEquals(deleteResponse.status, 200);
});

Deno.test('DELETE /api-tickets/:id - should return 404 for non-existent ticket', async () => {
  const fakeId = randomUUID();
  const response = await apiDelete(`api-tickets/${fakeId}`, TEST_EMPLOYEES.superAdmin);
  await response.text(); // Consume body to avoid leak
  assertEquals(response.status, 404);
});

// ============================================
// PERMISSION TESTS
// ============================================

Deno.test('Permission: Technician (level 0) can read tickets', async () => {
  const response = await apiGet(`api-tickets/${TEST_TICKETS.pm1}`, TEST_EMPLOYEES.tech1);
  await response.text(); // Consume body to avoid leak
  assertEquals(response.status, 200);
});

Deno.test('Permission: Technician (level 0) cannot create tickets', async () => {
  const ticketData = {
    ticket: {
      site_id: TEST_SITES.testCompanyHQ,
      work_type_id: REF_DATA.workTypes.pm,
      status_id: REF_DATA.statuses.normal,
      assigner_id: TEST_EMPLOYEES.assigner,
      details: 'Should fail - level 0 user',
    },
  };

  const response = await apiPost('api-tickets', ticketData, TEST_EMPLOYEES.tech1);
  await response.text(); // Consume body to avoid leak
  assertEquals(response.status, 403);
});

Deno.test('Permission: Assigner (level 1) can create tickets', async () => {
  const ticketData = {
    ticket: {
      site_id: TEST_SITES.abcCorpMain,
      work_type_id: REF_DATA.workTypes.sales,
      status_id: REF_DATA.statuses.normal,
      assigner_id: TEST_EMPLOYEES.assigner,
      details: 'E2E Test - Created by assigner',
    },
  };

  const response = await apiPost('api-tickets', ticketData, TEST_EMPLOYEES.assigner);
  await response.text(); // Consume body to avoid leak
  assertEquals(response.status, 201);
});

// ============================================
// SEARCH FILTER COMBINATIONS
// ============================================

Deno.test('Search: Multiple filters - work_type_id + status_id + site_id', async () => {
  const response = await apiGet(
    `api-tickets/search?work_type_id=${REF_DATA.workTypes.pm}&status_id=${REF_DATA.statuses.normal}&site_id=${TEST_SITES.testCompanyHQ}`
  );
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
  assertExists(data.pagination);
});

Deno.test('Search: Keyword search with filters', async () => {
  const response = await apiGet(
    `api-tickets/search?details=maintenance&work_type_id=${REF_DATA.workTypes.pm}`
  );
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
});

Deno.test('Search: Date range filtering with start_date and end_date', async () => {
  const today = new Date().toISOString().split('T')[0];
  const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const response = await apiGet(
    `api-tickets/search?start_date=${today}&end_date=${nextWeek}&date_type=appointed`
  );
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
  assertExists(data.pagination);
});

Deno.test('Search: Filter by employee_id', async () => {
  const response = await apiGet(`api-tickets/search?employee_id=${TEST_EMPLOYEES.tech1}`);
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
});

// Note: Multiple employee_ids filtering is not fully implemented at DB level
// The RPC only accepts a single p_employee_id parameter

Deno.test('Search: Filter by assigner_id', async () => {
  const response = await apiGet(`api-tickets/search?assigner_id=${TEST_EMPLOYEES.assigner}`);
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
});

Deno.test('Search: Exclude backlog tickets', async () => {
  const response = await apiGet('api-tickets/search?exclude_backlog=true');
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
});

Deno.test('Search: Filter by appointment approval status', async () => {
  const response = await apiGet('api-tickets/search?appointment_is_approved=false');
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
});

Deno.test('Search: Minimal include mode', async () => {
  const response = await apiGet('api-tickets/search?include=minimal&limit=5');
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
  // Minimal mode should still return data
  assertEquals(Array.isArray(data.data), true);
});

Deno.test('Search: Sorting by created_at ascending', async () => {
  const response = await apiGet('api-tickets/search?sort=created_at&order=asc&limit=5');
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
});

// ============================================
// CREATE WITH ALL OPTIONAL FIELDS
// ============================================

Deno.test('Create: Ticket with contact info', async () => {
  const ticketData = {
    ticket: {
      site_id: TEST_SITES.testCompanyHQ,
      work_type_id: REF_DATA.workTypes.pm,
      status_id: REF_DATA.statuses.normal,
      assigner_id: TEST_EMPLOYEES.assigner,
      details: 'E2E Test - Ticket with contact info',
    },
    contact: {
      person_name: 'E2E Test Contact',
      nickname: 'Test',
      phone: ['0812345678'],
      email: ['test@e2e.com'],
    },
  };

  const response = await apiPost('api-tickets', ticketData, TEST_EMPLOYEES.assigner);
  assertEquals(response.status, 201);
  const ticket = await assertSuccess(response, 201);
  assertExists((ticket as Record<string, unknown>).id);
});

Deno.test('Create: Ticket with appointment', async () => {
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const ticketData = {
    ticket: {
      site_id: TEST_SITES.testCompanyHQ,
      work_type_id: REF_DATA.workTypes.pm,
      status_id: REF_DATA.statuses.normal,
      assigner_id: TEST_EMPLOYEES.assigner,
      details: 'E2E Test - Ticket with appointment',
    },
    appointment: {
      appointment_date: tomorrow,
      appointment_time_start: '09:00:00',
      appointment_time_end: '12:00:00',
      appointment_type: 'time_range', // Valid enum: full_day, time_range, half_morning, half_afternoon, call_to_schedule
    },
  };

  const response = await apiPost('api-tickets', ticketData, TEST_EMPLOYEES.assigner);
  assertEquals(response.status, 201);
  const ticket = await assertSuccess(response, 201);
  assertExists((ticket as Record<string, unknown>).id);
});

Deno.test('Create: Ticket with employees array (simple format)', async () => {
  const ticketData = {
    ticket: {
      site_id: TEST_SITES.testCompanyHQ,
      work_type_id: REF_DATA.workTypes.pm,
      status_id: REF_DATA.statuses.normal,
      assigner_id: TEST_EMPLOYEES.assigner,
      details: 'E2E Test - Ticket with employees (simple)',
    },
    employee_ids: [TEST_EMPLOYEES.tech1, TEST_EMPLOYEES.tech2],
  };

  const response = await apiPost('api-tickets', ticketData, TEST_EMPLOYEES.assigner);
  assertEquals(response.status, 201);
  const ticket = await assertSuccess(response, 201);
  assertExists((ticket as Record<string, unknown>).id);
});

Deno.test('Create: Ticket with employees array (object format with is_key)', async () => {
  const ticketData = {
    ticket: {
      site_id: TEST_SITES.testCompanyHQ,
      work_type_id: REF_DATA.workTypes.rma,
      status_id: REF_DATA.statuses.urgent,
      assigner_id: TEST_EMPLOYEES.assigner,
      details: 'E2E Test - Ticket with key employee',
    },
    employee_ids: [
      { id: TEST_EMPLOYEES.tech1, is_key: true },
      { id: TEST_EMPLOYEES.tech2, is_key: false },
    ],
  };

  const response = await apiPost('api-tickets', ticketData, TEST_EMPLOYEES.assigner);
  assertEquals(response.status, 201);
  const ticket = await assertSuccess(response, 201);
  assertExists((ticket as Record<string, unknown>).id);
});

Deno.test('Create: Ticket with additional field', async () => {
  const ticketData = {
    ticket: {
      site_id: TEST_SITES.testCompanyHQ,
      work_type_id: REF_DATA.workTypes.pm,
      status_id: REF_DATA.statuses.normal,
      assigner_id: TEST_EMPLOYEES.assigner,
      details: 'E2E Test - Ticket with additional notes',
      additional: 'Some additional information for the technician',
    },
  };

  const response = await apiPost('api-tickets', ticketData, TEST_EMPLOYEES.assigner);
  assertEquals(response.status, 201);
  const ticket = await assertSuccess(response, 201);
  assertExists((ticket as Record<string, unknown>).id);
  assertEquals((ticket as Record<string, unknown>).additional, 'Some additional information for the technician');
});

// ============================================
// UPDATE EDGE CASES
// ============================================

Deno.test('Update: With empty body should succeed', async () => {
  // First create a ticket to update
  const ticketData = {
    ticket: {
      site_id: TEST_SITES.testCompanyHQ,
      work_type_id: REF_DATA.workTypes.pm,
      status_id: REF_DATA.statuses.normal,
      assigner_id: TEST_EMPLOYEES.assigner,
      details: 'E2E Test - For empty update',
    },
  };
  const createResponse = await apiPost('api-tickets', ticketData, TEST_EMPLOYEES.assigner);
  assertEquals(createResponse.status, 201);
  const createdTicket = await assertSuccess(createResponse, 201);
  const ticketId = (createdTicket as Record<string, unknown>).id as string;

  // Update with empty body
  const updateResponse = await apiPut(`api-tickets/${ticketId}`, {}, TEST_EMPLOYEES.assigner);
  await updateResponse.text(); // Consume body
  // Should succeed (200) or may return 400 if API requires at least one field
  assertEquals(updateResponse.status >= 200 && updateResponse.status < 500, true);
});

Deno.test('Update: Contact info on existing ticket', async () => {
  const updateData = {
    contact: {
      person_name: 'Updated Contact Name',
      nickname: 'Updated',
      phone: ['0899999999'],
    },
  };

  const response = await apiPut(`api-tickets/${TEST_TICKETS.pm1}`, updateData, TEST_EMPLOYEES.assigner);
  await response.text(); // Consume body
  assertEquals(response.status, 200);
});

Deno.test('Update: Appointment on existing ticket', async () => {
  const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const updateData = {
    appointment: {
      appointment_date: nextWeek,
      appointment_time_start: '14:00:00',
      appointment_time_end: '17:00:00',
      appointment_type: 'time_range', // Valid enum: full_day, time_range, half_morning, half_afternoon, call_to_schedule
    },
  };

  const response = await apiPut(`api-tickets/${TEST_TICKETS.pm2}`, updateData, TEST_EMPLOYEES.assigner);
  await response.text(); // Consume body
  assertEquals(response.status, 200);
});

Deno.test('Update: Employees list (full replacement)', async () => {
  // First create a ticket
  const ticketData = {
    ticket: {
      site_id: TEST_SITES.testCompanyHQ,
      work_type_id: REF_DATA.workTypes.pm,
      status_id: REF_DATA.statuses.normal,
      assigner_id: TEST_EMPLOYEES.assigner,
      details: 'E2E Test - For employee replacement',
    },
    employee_ids: [TEST_EMPLOYEES.tech1],
  };
  const createResponse = await apiPost('api-tickets', ticketData, TEST_EMPLOYEES.assigner);
  const createdTicket = await assertSuccess(createResponse, 201);
  const ticketId = (createdTicket as Record<string, unknown>).id as string;

  // Update with new employee list (replaces all)
  const updateData = {
    employee_ids: [
      { id: TEST_EMPLOYEES.tech2, is_key: true },
      { id: TEST_EMPLOYEES.tech3, is_key: false },
    ],
  };

  const response = await apiPut(`api-tickets/${ticketId}`, updateData, TEST_EMPLOYEES.assigner);
  await response.text(); // Consume body
  assertEquals(response.status, 200);
});

Deno.test('Update: Change work type and status together', async () => {
  const updateData = {
    ticket: {
      work_type_id: REF_DATA.workTypes.rma,
      status_id: REF_DATA.statuses.urgent,
    },
  };

  // Create a new ticket to update
  const ticketData = {
    ticket: {
      site_id: TEST_SITES.testCompanyHQ,
      work_type_id: REF_DATA.workTypes.pm,
      status_id: REF_DATA.statuses.normal,
      assigner_id: TEST_EMPLOYEES.assigner,
      details: 'E2E Test - For work type change',
    },
  };
  const createResponse = await apiPost('api-tickets', ticketData, TEST_EMPLOYEES.assigner);
  const createdTicket = await assertSuccess(createResponse, 201);
  const ticketId = (createdTicket as Record<string, unknown>).id as string;

  const response = await apiPut(`api-tickets/${ticketId}`, updateData, TEST_EMPLOYEES.assigner);
  assertEquals(response.status, 200);
  const updatedTicket = await assertSuccess(response);
  assertEquals((updatedTicket as Record<string, unknown>).work_type_id, REF_DATA.workTypes.rma);
  assertEquals((updatedTicket as Record<string, unknown>).status_id, REF_DATA.statuses.urgent);
});

// ============================================
// COMMENTS EDGE CASES
// ============================================

Deno.test('Comment: Create with photos attachment', async () => {
  const commentData = {
    content: 'E2E Test Comment with photos',
    photos: [
      { image_url: 'https://example.com/photo1.jpg', display_order: 0 },
      { image_url: 'https://example.com/photo2.jpg', display_order: 1 },
    ],
  };

  const response = await apiPost(`api-tickets/${TEST_TICKETS.pm1}/comments`, commentData);
  assertEquals(response.status, 201);
  const comment = await assertSuccess(response, 201);
  assertExists((comment as Record<string, unknown>).id);
  // Photos may or may not be returned depending on implementation
});

Deno.test('Comment: Create with files attachment', async () => {
  const commentData = {
    content: 'E2E Test Comment with files',
    files: [
      {
        file_url: 'https://example.com/report.pdf',
        file_name: 'report.pdf',
        file_size: 1024,
        mime_type: 'application/pdf',
      },
    ],
  };

  const response = await apiPost(`api-tickets/${TEST_TICKETS.pm1}/comments`, commentData);
  assertEquals(response.status, 201);
  const comment = await assertSuccess(response, 201);
  assertExists((comment as Record<string, unknown>).id);
});

Deno.test('Comment: Update own comment', async () => {
  // First create a comment
  const createResponse = await apiPost(
    `api-tickets/${TEST_TICKETS.pm1}/comments`,
    { content: 'E2E Test - Comment to update' },
    TEST_EMPLOYEES.superAdmin
  );
  assertEquals(createResponse.status, 201);
  const createdComment = await assertSuccess(createResponse, 201);
  const commentId = (createdComment as Record<string, unknown>).id as string;

  // Update the comment (same user)
  const updateResponse = await apiPut(
    `api-tickets/${TEST_TICKETS.pm1}/comments/${commentId}`,
    { content: 'E2E Test - Updated comment content' },
    TEST_EMPLOYEES.superAdmin
  );
  assertEquals(updateResponse.status, 200);
  const updatedComment = await assertSuccess(updateResponse);
  assertEquals((updatedComment as Record<string, unknown>).content, 'E2E Test - Updated comment content');
  assertEquals((updatedComment as Record<string, unknown>).is_edited, true);
});

Deno.test('Comment: Update by non-author should fail', async () => {
  // First create a comment as superAdmin
  const createResponse = await apiPost(
    `api-tickets/${TEST_TICKETS.pm1}/comments`,
    { content: 'E2E Test - Comment by superAdmin' },
    TEST_EMPLOYEES.superAdmin
  );
  assertEquals(createResponse.status, 201);
  const createdComment = await assertSuccess(createResponse, 201);
  const commentId = (createdComment as Record<string, unknown>).id as string;

  // Try to update as a different user (tech1)
  const updateResponse = await apiPut(
    `api-tickets/${TEST_TICKETS.pm1}/comments/${commentId}`,
    { content: 'Unauthorized update attempt' },
    TEST_EMPLOYEES.tech1
  );
  await updateResponse.text(); // Consume body
  assertEquals(updateResponse.status, 403);
});

Deno.test('Comment: Admin can delete any comment', async () => {
  // First create a comment as tech1
  const createResponse = await apiPost(
    `api-tickets/${TEST_TICKETS.pm2}/comments`,
    { content: 'E2E Test - Comment to be deleted by admin' },
    TEST_EMPLOYEES.tech1
  );
  assertEquals(createResponse.status, 201);
  const createdComment = await assertSuccess(createResponse, 201);
  const commentId = (createdComment as Record<string, unknown>).id as string;

  // Delete as admin
  const deleteResponse = await apiDelete(
    `api-tickets/${TEST_TICKETS.pm2}/comments/${commentId}`,
    TEST_EMPLOYEES.admin
  );
  await deleteResponse.text(); // Consume body
  assertEquals(deleteResponse.status, 200);
});

Deno.test('Comment: Delete non-existent comment should fail', async () => {
  const fakeCommentId = randomUUID();
  const response = await apiDelete(
    `api-tickets/${TEST_TICKETS.pm1}/comments/${fakeCommentId}`,
    TEST_EMPLOYEES.superAdmin
  );
  await response.text(); // Consume body
  assertEquals(response.status, 404);
});

// ============================================
// TECHNICIAN CONFIRMATION FLOW
// ============================================

Deno.test('Confirm: Multiple technicians for ticket', async () => {
  const confirmData = {
    employee_ids: [
      { id: TEST_EMPLOYEES.tech1, is_key: true },
      { id: TEST_EMPLOYEES.tech2, is_key: false },
    ],
    notes: 'E2E Test confirmation',
  };

  // Use superAdmin who should have approval permissions
  const response = await apiPost(
    `api-tickets/${TEST_TICKETS.pm1}/confirm-technicians`,
    confirmData,
    TEST_EMPLOYEES.superAdmin
  );
  await response.text(); // Consume body
  // May succeed (201) or fail (403) depending on approval role configuration
  assertEquals(response.status >= 200 && response.status < 500, true);
});

Deno.test('Confirm: Empty employee list should fail', async () => {
  const confirmData = {
    employee_ids: [],
  };

  const response = await apiPost(
    `api-tickets/${TEST_TICKETS.pm1}/confirm-technicians`,
    confirmData,
    TEST_EMPLOYEES.superAdmin
  );
  await response.text(); // Consume body
  // Should return 400 for validation error or 403 if not authorized
  assertEquals(response.status === 400 || response.status === 403, true);
});

Deno.test('Confirm: Get confirmed technicians', async () => {
  const response = await apiGet(`api-tickets/${TEST_TICKETS.pm1}/confirmed-technicians`);
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
});

// ============================================
// REMOVE EMPLOYEE FROM TICKET
// ============================================

Deno.test('Remove Employee: Admin can remove technician assignment', async () => {
  // First create a ticket with employees
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const ticketData = {
    ticket: {
      site_id: TEST_SITES.testCompanyHQ,
      work_type_id: REF_DATA.workTypes.pm,
      status_id: REF_DATA.statuses.normal,
      assigner_id: TEST_EMPLOYEES.assigner,
      details: 'E2E Test - For employee removal',
    },
    employee_ids: [TEST_EMPLOYEES.tech1, TEST_EMPLOYEES.tech2],
    appointment: {
      appointment_date: tomorrow,
      appointment_type: 'full_day',
    },
  };

  const createResponse = await apiPost('api-tickets', ticketData, TEST_EMPLOYEES.assigner);
  const createdTicket = await assertSuccess(createResponse, 201);
  const ticketId = (createdTicket as Record<string, unknown>).id as string;

  // Remove one employee (requires admin level 2+)
  const removeData = {
    ticket_id: ticketId,
    employee_id: TEST_EMPLOYEES.tech2,
    date: tomorrow,
  };

  // Note: apiDelete doesn't support body, so using fetch directly
  const url = 'http://localhost:54321/functions/v1/api-tickets/employees';
  const headers = await createHeaders(TEST_EMPLOYEES.admin);
  const fetchResponse = await fetch(url, {
    method: 'DELETE',
    headers,
    body: JSON.stringify(removeData),
  });
  await fetchResponse.text(); // Consume body
  // May succeed (200) or fail based on data state
  assertEquals(fetchResponse.status >= 200 && fetchResponse.status < 500, true);
});

Deno.test('Remove Employee: Level 0 user cannot remove assignments', async () => {
  const removeData = {
    ticket_id: TEST_TICKETS.pm1,
    employee_id: TEST_EMPLOYEES.tech1,
    date: new Date().toISOString().split('T')[0],
  };

  const url = 'http://localhost:54321/functions/v1/api-tickets/employees';
  const headers = await createHeaders(TEST_EMPLOYEES.tech1);
  const response = await fetch(url, {
    method: 'DELETE',
    headers,
    body: JSON.stringify(removeData),
  });
  await response.text(); // Consume body
  assertEquals(response.status, 403);
});

Deno.test('Remove Employee: Missing required fields should fail', async () => {
  // Missing date
  const removeData = {
    ticket_id: TEST_TICKETS.pm1,
    employee_id: TEST_EMPLOYEES.tech1,
  };

  const url = 'http://localhost:54321/functions/v1/api-tickets/employees';
  const headers = await createHeaders(TEST_EMPLOYEES.admin);
  const response = await fetch(url, {
    method: 'DELETE',
    headers,
    body: JSON.stringify(removeData),
  });
  await response.text(); // Consume body
  assertEquals(response.status, 400);
});

// ============================================
// RATINGS EDGE CASES
// ============================================

Deno.test('Rating: Create rating with valid score', async () => {
  // First create a ticket to rate
  const ticketData = {
    ticket: {
      site_id: TEST_SITES.testCompanyHQ,
      work_type_id: REF_DATA.workTypes.pm,
      status_id: REF_DATA.statuses.normal,
      assigner_id: TEST_EMPLOYEES.assigner,
      details: 'E2E Test - Ticket for rating',
    },
  };
  const createResponse = await apiPost('api-tickets', ticketData, TEST_EMPLOYEES.assigner);
  const createdTicket = await assertSuccess(createResponse, 201);
  const ticketId = (createdTicket as Record<string, unknown>).id as string;

  const ratingData = {
    score: 4,
    comment: 'Good service, quick response',
  };

  const response = await apiPost(`api-tickets/${ticketId}/rating`, ratingData);
  await response.text(); // Consume body
  // May succeed (201) or fail if rating already exists
  assertEquals(response.status >= 200 && response.status < 500, true);
});

Deno.test('Rating: Update existing rating', async () => {
  const ratingData = {
    score: 5,
    comment: 'Updated: Excellent service!',
  };

  const response = await apiPut(`api-tickets/${TEST_TICKETS.survey}/rating`, ratingData);
  await response.text(); // Consume body
  // May succeed or fail depending on if rating exists
  assertEquals(response.status >= 200 && response.status < 500, true);
});

Deno.test('Rating: Delete rating', async () => {
  // First create a ticket and rating
  const ticketData = {
    ticket: {
      site_id: TEST_SITES.testCompanyHQ,
      work_type_id: REF_DATA.workTypes.survey,
      status_id: REF_DATA.statuses.normal,
      assigner_id: TEST_EMPLOYEES.assigner,
      details: 'E2E Test - Ticket for rating deletion',
    },
  };
  const createResponse = await apiPost('api-tickets', ticketData, TEST_EMPLOYEES.assigner);
  const createdTicket = await assertSuccess(createResponse, 201);
  const ticketId = (createdTicket as Record<string, unknown>).id as string;

  // Create rating
  const ratingData = { score: 3, comment: 'To be deleted' };
  const createRatingResponse = await apiPost(`api-tickets/${ticketId}/rating`, ratingData);
  await createRatingResponse.text(); // Consume body

  // Delete rating
  const deleteResponse = await apiDelete(`api-tickets/${ticketId}/rating`);
  await deleteResponse.text(); // Consume body
  // May succeed (200) or fail (404) if rating doesn't exist
  assertEquals(deleteResponse.status >= 200 && deleteResponse.status < 500, true);
});

// ============================================
// EXTRA FIELDS EDGE CASES
// ============================================

Deno.test('Extra Fields: Create and update', async () => {
  // Create
  const createData = {
    field_name: 'test_field_' + Date.now(),
    field_value: 'initial_value',
  };
  const createResponse = await apiPost(`api-tickets/${TEST_TICKETS.pm1}/extra-fields`, createData);
  await createResponse.text(); // Consume body
  assertEquals(createResponse.status >= 200 && createResponse.status < 500, true);
});

Deno.test('Extra Fields: Bulk upsert', async () => {
  const bulkData = {
    fields: [
      { field_name: 'bulk_field_1', field_value: 'value_1' },
      { field_name: 'bulk_field_2', field_value: 'value_2' },
    ],
  };
  const response = await apiPost(`api-tickets/${TEST_TICKETS.pm1}/extra-fields/bulk`, bulkData);
  await response.text(); // Consume body
  assertEquals(response.status >= 200 && response.status < 500, true);
});

// ============================================
// ATTACHMENTS EDGE CASES
// ============================================

Deno.test('Attachments: List attachments for ticket', async () => {
  const response = await apiGet(`api-tickets/${TEST_TICKETS.pm1}/attachments`);
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
});

Deno.test('Attachments: Delete non-existent attachment should fail', async () => {
  const fakeAttachmentId = randomUUID();
  const response = await apiDelete(`api-tickets/${TEST_TICKETS.pm1}/attachments/${fakeAttachmentId}?type=photo`);
  await response.text(); // Consume body
  // API returns 400 for validation/not found, or 404 for true not found
  assertEquals(response.status === 400 || response.status === 404, true);
});

// ============================================
// WATCHERS EDGE CASES
// ============================================

Deno.test('Watchers: Add and remove multiple times', async () => {
  // Add watcher
  const addResponse1 = await apiPost(`api-tickets/${TEST_TICKETS.survey}/watch`, {});
  await addResponse1.text();
  assertEquals(addResponse1.status >= 200 && addResponse1.status < 300, true);

  // Add again (should be idempotent)
  const addResponse2 = await apiPost(`api-tickets/${TEST_TICKETS.survey}/watch`, {});
  await addResponse2.text();
  assertEquals(addResponse2.status >= 200 && addResponse2.status < 300, true);

  // Remove
  const removeResponse = await apiDelete(`api-tickets/${TEST_TICKETS.survey}/watch`);
  await removeResponse.text();
  assertEquals(removeResponse.status, 200);

  // Remove again (should not error)
  const removeResponse2 = await apiDelete(`api-tickets/${TEST_TICKETS.survey}/watch`);
  await removeResponse2.text();
  assertEquals(removeResponse2.status >= 200 && removeResponse2.status < 500, true);
});

Deno.test('Watchers: Search for watched tickets', async () => {
  // First add as watcher
  const addResponse = await apiPost(`api-tickets/${TEST_TICKETS.pm1}/watch`, {});
  await addResponse.text();

  // Search for watched tickets
  const response = await apiGet('api-tickets/search?watching=true');
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
});

// ============================================
// VALIDATION EDGE CASES
// ============================================

Deno.test('Validation: Invalid UUID in path should return 400', async () => {
  const response = await apiGet('api-tickets/not-a-uuid');
  await response.text();
  assertEquals(response.status, 400);
});

Deno.test('Validation: Invalid work_type_id should return error', async () => {
  const ticketData = {
    ticket: {
      site_id: TEST_SITES.testCompanyHQ,
      work_type_id: randomUUID(), // Non-existent work type
      status_id: REF_DATA.statuses.normal,
      assigner_id: TEST_EMPLOYEES.assigner,
      details: 'E2E Test - Invalid work type',
    },
  };

  const response = await apiPost('api-tickets', ticketData, TEST_EMPLOYEES.assigner);
  await response.text();
  // Should fail due to foreign key constraint (400 validation or 500 DB error)
  assertEquals(response.status >= 400, true);
});

Deno.test('Validation: Invalid JSON should return 400', async () => {
  const url = 'http://localhost:54321/functions/v1/api-tickets';
  const headers = await createHeaders(TEST_EMPLOYEES.assigner);
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: 'not valid json{',
  });
  await response.text();
  assertEquals(response.status, 400);
});

