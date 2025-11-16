/**
 * Unit tests for Appointments API handlers
 */

import { assertEquals, assertRejects } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { list } from '../../supabase/functions/api-appointments/handlers/list.ts';
import { get } from '../../supabase/functions/api-appointments/handlers/get.ts';
import { create } from '../../supabase/functions/api-appointments/handlers/create.ts';
import { update } from '../../supabase/functions/api-appointments/handlers/update.ts';
import { deleteAppointment } from '../../supabase/functions/api-appointments/handlers/delete.ts';
import { getByTicket } from '../../supabase/functions/api-appointments/handlers/getByTicket.ts';
import { createMockJsonRequest, createMockRequest, createMockEmployeeWithLevel, assertSuccessResponse, assertErrorResponse } from '../_shared/mocks.ts';

// Mock the service
const mockAppointment = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  ticket_id: '123e4567-e89b-12d3-a456-426614174001',
  appointment_type: 'full_day',
  appointment_date: '2025-01-15',
  appointment_time: '14:00:00',
  notes: 'Test appointment',
  created_at: '2025-01-10T10:00:00Z',
  updated_at: '2025-01-10T10:00:00Z',
};

Deno.test('list appointments - success', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-appointments?page=1&limit=20');

  // Mock AppointmentService.getAll
  const originalGetAll = (await import('../../supabase/functions/api-appointments/services/appointmentService.ts')).AppointmentService.getAll;
  (await import('../../supabase/functions/api-appointments/services/appointmentService.ts')).AppointmentService.getAll = async () => ({
    data: [mockAppointment],
    pagination: {
      page: 1,
      limit: 20,
      total: 1,
      totalPages: 1,
      hasNext: false,
      hasPrevious: false,
    },
  });

  try {
    const response = await list(request, employee);
    const data = await assertSuccessResponse<{ data: unknown[]; pagination: unknown }>(response);
    assertEquals(Array.isArray(data.data), true);
    assertEquals(data.data.length, 1);
  } finally {
    // Restore original
    (await import('../../supabase/functions/api-appointments/services/appointmentService.ts')).AppointmentService.getAll = originalGetAll;
  }
});

Deno.test('list appointments - requires level 0', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-appointments');

  // Mock AppointmentService.getAll
  const originalGetAll = (await import('../../supabase/functions/api-appointments/services/appointmentService.ts')).AppointmentService.getAll;
  (await import('../../supabase/functions/api-appointments/services/appointmentService.ts')).AppointmentService.getAll = async () => ({
    data: [],
    pagination: { page: 1, limit: 20, total: 0, totalPages: 0, hasNext: false, hasPrevious: false },
  });

  try {
    // Should not throw for level 0
    const response = await list(request, employee);
    assertEquals(response.status < 400, true);
  } finally {
    (await import('../../supabase/functions/api-appointments/services/appointmentService.ts')).AppointmentService.getAll = originalGetAll;
  }
});

Deno.test('get appointment by id - success', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-appointments/123e4567-e89b-12d3-a456-426614174000');

  // Mock AppointmentService.getById
  const originalGetById = (await import('../../supabase/functions/api-appointments/services/appointmentService.ts')).AppointmentService.getById;
  (await import('../../supabase/functions/api-appointments/services/appointmentService.ts')).AppointmentService.getById = async () => mockAppointment;

  try {
    const response = await get(request, employee, '123e4567-e89b-12d3-a456-426614174000');
    const data = await assertSuccessResponse<Record<string, unknown>>(response);
    assertEquals(data.id, '123e4567-e89b-12d3-a456-426614174000');
  } finally {
    (await import('../../supabase/functions/api-appointments/services/appointmentService.ts')).AppointmentService.getById = originalGetById;
  }
});

Deno.test('create appointment - success', async () => {
  const employee = createMockEmployeeWithLevel(1);
  const request = createMockJsonRequest('POST', 'http://localhost/api-appointments', {
    appointment_type: 'full_day',
    appointment_date: '2025-01-15',
    appointment_time: '14:00:00',
  });

  // Mock AppointmentService.create
  const originalCreate = (await import('../../supabase/functions/api-appointments/services/appointmentService.ts')).AppointmentService.create;
  (await import('../../supabase/functions/api-appointments/services/appointmentService.ts')).AppointmentService.create = async () => mockAppointment;

  try {
    const response = await create(request, employee);
    const data = await assertSuccessResponse<Record<string, unknown>>(response, 201);
    assertEquals(data.appointment_type, 'full_day');
  } finally {
    (await import('../../supabase/functions/api-appointments/services/appointmentService.ts')).AppointmentService.create = originalCreate;
  }
});

Deno.test('create appointment - requires level 1', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockJsonRequest('POST', 'http://localhost/api-appointments', {
    appointment_type: 'full_day',
  });

  await assertRejects(
    async () => await create(request, employee),
    Error,
    'ต้องมีสิทธิ์ระดับ 1'
  );
});

Deno.test('create appointment - missing required field', async () => {
  const employee = createMockEmployeeWithLevel(1);
  const request = createMockJsonRequest('POST', 'http://localhost/api-appointments', {});

  await assertRejects(
    async () => await create(request, employee),
    Error,
    'จำเป็นต้องระบุ'
  );
});

Deno.test('get appointment by ticket - success', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-appointments/ticket/123e4567-e89b-12d3-a456-426614174001');

  // Mock AppointmentService.getByTicketId
  const originalGetByTicketId = (await import('../../supabase/functions/api-appointments/services/appointmentService.ts')).AppointmentService.getByTicketId;
  (await import('../../supabase/functions/api-appointments/services/appointmentService.ts')).AppointmentService.getByTicketId = async () => mockAppointment;

  try {
    const response = await getByTicket(request, employee, '123e4567-e89b-12d3-a456-426614174001');
    const data = await assertSuccessResponse<Record<string, unknown>>(response);
    assertEquals(data.ticket_id, '123e4567-e89b-12d3-a456-426614174001');
  } finally {
    (await import('../../supabase/functions/api-appointments/services/appointmentService.ts')).AppointmentService.getByTicketId = originalGetByTicketId;
  }
});

