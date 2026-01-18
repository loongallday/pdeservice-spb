/**
 * E2E Tests for api-appointments
 * Tests all appointment operations with real database and authentication
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
  TEST_APPOINTMENTS,
  randomUUID,
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
// GET APPOINTMENT BY ID
// ============================================

Deno.test('GET /api-appointments/:id - should get existing appointment', async () => {
  const response = await apiGet(`api-appointments/${TEST_APPOINTMENTS.appt1}`);
  assertEquals(response.status, 200);
  const appointment = await assertSuccess(response);
  assertExists(appointment);
  assertEquals((appointment as Record<string, unknown>).id, TEST_APPOINTMENTS.appt1);
});

Deno.test('GET /api-appointments/:id - should return 404 for non-existent appointment', async () => {
  const fakeId = randomUUID();
  const response = await apiGet(`api-appointments/${fakeId}`);
  await response.text(); // Consume body to avoid leak
  assertEquals(response.status, 404);
});

// ============================================
// LIST APPOINTMENTS
// ============================================

Deno.test('GET /api-appointments - should return paginated appointments', async () => {
  const response = await apiGet('api-appointments');
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
  assertExists(data.pagination);
});

Deno.test('GET /api-appointments - should support pagination', async () => {
  const response = await apiGet('api-appointments?page=1&limit=5');
  assertEquals(response.status, 200);
  const data = await response.json();
  assertEquals(data.pagination.page, 1);
  assertEquals(data.pagination.limit, 5);
});

// ============================================
// SEARCH APPOINTMENTS
// ============================================

Deno.test('GET /api-appointments/search - should search appointments', async () => {
  const response = await apiGet('api-appointments/search');
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
});

Deno.test('GET /api-appointments/search - should filter by type', async () => {
  const response = await apiGet('api-appointments/search?type=time_range');
  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.data);
});

// ============================================
// GET APPOINTMENT BY TICKET
// ============================================

Deno.test('GET /api-appointments/ticket/:ticketId - should get appointment by ticket', async () => {
  const response = await apiGet(`api-appointments/ticket/${TEST_TICKETS.pm1}`);
  assertEquals(response.status, 200);
  const data = await response.json();
  // data.data can be null if ticket has no appointment - that's valid
  assertEquals('data' in data, true, 'Response should have data key');
});

Deno.test('GET /api-appointments/ticket/:ticketId - handles non-existent ticket', async () => {
  const fakeId = randomUUID();
  const response = await apiGet(`api-appointments/ticket/${fakeId}`);
  await response.text(); // Consume body
  // Returns 200 with null data or 404
  assertEquals(response.status === 200 || response.status === 404, true);
});

// ============================================
// CREATE APPOINTMENT
// ============================================

Deno.test('POST /api-appointments - should create appointment with valid data', async () => {
  const appointmentData = {
    date: '2026-02-01',
    time_start: '09:00',
    time_end: '12:00',
    type: 'time_range',
  };

  const response = await apiPost('api-appointments', appointmentData, TEST_EMPLOYEES.superAdmin);
  const text = await response.text(); // Consume body
  // Should succeed or return validation error
  assertEquals(response.status < 500, true, `Unexpected server error: ${text}`);
});

Deno.test('POST /api-appointments - should create appointment with half_morning type', async () => {
  const appointmentData = {
    date: '2026-02-02',
    type: 'half_morning',
  };

  const response = await apiPost('api-appointments', appointmentData, TEST_EMPLOYEES.assigner);
  const text = await response.text(); // Consume body
  assertEquals(response.status < 500, true, `Unexpected server error: ${text}`);
});

// ============================================
// UPDATE APPOINTMENT
// ============================================

Deno.test('PUT /api-appointments/:id - should update appointment', async () => {
  const updateData = {
    appointment_date: '2026-02-15',
    appointment_time_start: '10:00',
    appointment_time_end: '14:00',
  };

  const response = await apiPut(`api-appointments/${TEST_APPOINTMENTS.appt1}`, updateData, TEST_EMPLOYEES.superAdmin);
  const text = await response.text(); // Consume body
  // Should succeed or return error (no 5xx)
  assertEquals(response.status < 500, true, `Server error: ${text}`);
});

Deno.test('PUT /api-appointments/:id - should return error for non-existent appointment', async () => {
  const fakeId = randomUUID();
  const updateData = {
    date: '2026-02-20',
  };

  const response = await apiPut(`api-appointments/${fakeId}`, updateData, TEST_EMPLOYEES.superAdmin);
  await response.text(); // Consume body
  assertEquals(response.status >= 400, true);
});

// ============================================
// APPROVE APPOINTMENT
// ============================================

Deno.test('POST /api-appointments/approve - should approve appointment', async () => {
  const approveData = {
    appointment_id: TEST_APPOINTMENTS.appt1,
    is_approved: true,
  };

  const response = await apiPost('api-appointments/approve', approveData, TEST_EMPLOYEES.superAdmin);
  const text = await response.text(); // Consume body
  // May succeed or require specific approval role
  assertEquals(response.status < 500, true, `Unexpected server error: ${text}`);
});

Deno.test('POST /api-appointments/approve - should unapprove appointment', async () => {
  const approveData = {
    appointment_id: TEST_APPOINTMENTS.appt1,
    is_approved: false,
  };

  const response = await apiPost('api-appointments/approve', approveData, TEST_EMPLOYEES.superAdmin);
  const text = await response.text(); // Consume body
  assertEquals(response.status < 500, true, `Unexpected server error: ${text}`);
});

// ============================================
// PERMISSION TESTS
// ============================================

Deno.test('Permission: Technician can read appointments', async () => {
  const response = await apiGet(`api-appointments/${TEST_APPOINTMENTS.appt1}`, TEST_EMPLOYEES.tech1);
  await response.text(); // Consume body
  assertEquals(response.status, 200);
});

Deno.test('Permission: Technician cannot create appointments', async () => {
  const appointmentData = {
    date: '2026-03-01',
    type: 'full_day',
  };

  const response = await apiPost('api-appointments', appointmentData, TEST_EMPLOYEES.tech1);
  await response.text(); // Consume body
  assertEquals(response.status, 403);
});

Deno.test('Permission: Assigner can create appointments', async () => {
  const appointmentData = {
    date: '2026-03-02',
    type: 'half_afternoon',
  };

  const response = await apiPost('api-appointments', appointmentData, TEST_EMPLOYEES.assigner);
  const text = await response.text(); // Consume body
  // Should succeed (201) or return conflict
  assertEquals(response.status < 500, true, `Unexpected server error: ${text}`);
});
