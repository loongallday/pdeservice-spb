/**
 * Unit tests for Appointments API handlers
 * Tests validation logic and permission checks only
 */

import { assertEquals, assertRejects } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { list } from '../../supabase/functions/api-appointments/handlers/list.ts';
import { get } from '../../supabase/functions/api-appointments/handlers/get.ts';
import { create } from '../../supabase/functions/api-appointments/handlers/create.ts';
import { update } from '../../supabase/functions/api-appointments/handlers/update.ts';
import { deleteAppointment } from '../../supabase/functions/api-appointments/handlers/delete.ts';
import { search } from '../../supabase/functions/api-appointments/handlers/search.ts';
import { createMockRequest, createMockJsonRequest, createMockEmployeeWithLevel } from '../_shared/mocks.ts';

const mockAppointment = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  appointment_type: 'งานหลัก',
  scheduled_date: '2025-01-15',
  scheduled_time_start: '09:00',
  scheduled_time_end: '12:00',
};

// ============ Handler Existence Tests ============

Deno.test('list handler exists and is callable', () => {
  assertEquals(typeof list, 'function');
});

Deno.test('get handler exists and is callable', () => {
  assertEquals(typeof get, 'function');
});

Deno.test('create handler exists and is callable', () => {
  assertEquals(typeof create, 'function');
});

Deno.test('update handler exists and is callable', () => {
  assertEquals(typeof update, 'function');
});

Deno.test('deleteAppointment handler exists and is callable', () => {
  assertEquals(typeof deleteAppointment, 'function');
});

Deno.test('search handler exists and is callable', () => {
  assertEquals(typeof search, 'function');
});

// ============ Permission Tests ============

Deno.test('GET /api-appointments - level 0 can access', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-appointments');

  // Should not throw permission error (will fail on DB but permission check passes)
  const module = await import('../../supabase/functions/api-appointments/services/appointmentService.ts');
  const originalGetAll = module.AppointmentService.getAll;
  module.AppointmentService.getAll = async () => ({ data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0, hasNext: false, hasPrevious: false } });

  try {
    const response = await list(request, employee);
    assertEquals(response.status, 200);
  } finally {
    module.AppointmentService.getAll = originalGetAll;
  }
});

Deno.test('POST /api-appointments - requires level 1', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockJsonRequest('POST', 'http://localhost/api-appointments', {
    appointment_type: 'งานหลัก',
    scheduled_date: '2025-01-15',
    scheduled_time_start: '09:00',
    scheduled_time_end: '12:00',
  });

  await assertRejects(
    async () => await create(request, employee),
    Error,
    'ต้องมีสิทธิ์ระดับ 1'
  );
});

Deno.test('PUT /api-appointments/:id - requires level 1', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockJsonRequest('PUT', `http://localhost/api-appointments/${mockAppointment.id}`, {
    scheduled_date: '2025-01-16',
  });

  await assertRejects(
    async () => await update(request, employee, mockAppointment.id),
    Error,
    'ต้องมีสิทธิ์ระดับ 1'
  );
});

Deno.test('DELETE /api-appointments/:id - requires level 1', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('DELETE', `http://localhost/api-appointments/${mockAppointment.id}`);

  await assertRejects(
    async () => await deleteAppointment(request, employee, mockAppointment.id),
    Error,
    'ต้องมีสิทธิ์ระดับ 1'
  );
});

// ============ Validation Tests ============

Deno.test('POST /api-appointments - missing appointment_type throws error', async () => {
  const employee = createMockEmployeeWithLevel(1);
  const request = createMockJsonRequest('POST', 'http://localhost/api-appointments', {
    scheduled_date: '2025-01-15',
    scheduled_time_start: '09:00',
    scheduled_time_end: '12:00',
  });

  await assertRejects(
    async () => await create(request, employee),
    Error
  );
});

Deno.test('GET /api-appointments/search - empty query returns empty', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-appointments/search?q=');

  const module = await import('../../supabase/functions/api-appointments/services/appointmentService.ts');
  const originalSearch = module.AppointmentService.search;
  module.AppointmentService.search = async () => [];

  try {
    const response = await search(request, employee);
    assertEquals(response.status, 200);
  } finally {
    module.AppointmentService.search = originalSearch;
  }
});

Deno.test('GET /api-appointments/:id - invalid UUID throws error', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-appointments/invalid-uuid');

  await assertRejects(
    async () => await get(request, employee, 'invalid-uuid'),
    Error,
    'ไม่ถูกต้อง'
  );
});

Deno.test('PUT /api-appointments/:id - invalid UUID throws error', async () => {
  const employee = createMockEmployeeWithLevel(1);
  const request = createMockJsonRequest('PUT', 'http://localhost/api-appointments/invalid-uuid', {
    scheduled_date: '2025-01-16',
  });

  await assertRejects(
    async () => await update(request, employee, 'invalid-uuid'),
    Error,
    'ไม่ถูกต้อง'
  );
});

Deno.test('PUT /api-appointments/:id - invalid ticket_id in body throws error', async () => {
  const employee = createMockEmployeeWithLevel(1);
  const request = createMockJsonRequest('PUT', `http://localhost/api-appointments/${mockAppointment.id}`, {
    ticket_id: 'invalid-ticket-uuid',
    scheduled_date: '2025-01-16',
  });

  await assertRejects(
    async () => await update(request, employee, mockAppointment.id),
    Error,
    'ไม่ถูกต้อง'
  );
});

Deno.test('DELETE /api-appointments/:id - invalid UUID throws error', async () => {
  const employee = createMockEmployeeWithLevel(1);
  const request = createMockRequest('DELETE', 'http://localhost/api-appointments/invalid-uuid');

  await assertRejects(
    async () => await deleteAppointment(request, employee, 'invalid-uuid'),
    Error,
    'ไม่ถูกต้อง'
  );
});

// ============ Mocked Success Tests ============

Deno.test('GET /api-appointments/:id - success with mocking', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', `http://localhost/api-appointments/${mockAppointment.id}`);

  const module = await import('../../supabase/functions/api-appointments/services/appointmentService.ts');
  const originalGetById = module.AppointmentService.getById;
  module.AppointmentService.getById = async () => mockAppointment;

  try {
    const response = await get(request, employee, mockAppointment.id);
    assertEquals(response.status, 200);
  } finally {
    module.AppointmentService.getById = originalGetById;
  }
});

Deno.test('DELETE /api-appointments/:id - success with level 1', async () => {
  const employee = createMockEmployeeWithLevel(1);
  const request = createMockRequest('DELETE', `http://localhost/api-appointments/${mockAppointment.id}`);

  const module = await import('../../supabase/functions/api-appointments/services/appointmentService.ts');
  const originalDelete = module.AppointmentService.delete;
  module.AppointmentService.delete = async () => {};

  try {
    const response = await deleteAppointment(request, employee, mockAppointment.id);
    assertEquals(response.status, 200);
  } finally {
    module.AppointmentService.delete = originalDelete;
  }
});

