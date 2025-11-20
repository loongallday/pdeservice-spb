/**
 * Unit tests for Appointments API search handler
 */

import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { search } from '../../supabase/functions/api-appointments/handlers/search.ts';
import { createMockRequest, createMockEmployeeWithLevel, assertSuccessResponse } from '../_shared/mocks.ts';

Deno.test('search appointments - success', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-appointments/search?q=meeting');

  const mockSearchResults = [
    {
      id: '123e4567-e89b-12d3-a456-426614174000',
      ticket_id: '123e4567-e89b-12d3-a456-426614174001',
      appointment_date: '2024-01-15',
      appointment_type: 'meeting',
      notes: 'Initial meeting with client',
    },
  ];

  // Mock AppointmentService.search
  const originalSearch = (await import('../../supabase/functions/api-appointments/services/appointmentService.ts')).AppointmentService.search;
  (await import('../../supabase/functions/api-appointments/services/appointmentService.ts')).AppointmentService.search = async () => mockSearchResults;

  try {
    const response = await search(request, employee);
    const data = await assertSuccessResponse<Record<string, unknown>[]>(response);
    assertEquals(Array.isArray(data), true);
    assertEquals(data.length, 1);
    assertEquals(data[0].appointment_type, 'meeting');
  } finally {
    (await import('../../supabase/functions/api-appointments/services/appointmentService.ts')).AppointmentService.search = originalSearch;
  }
});

Deno.test('search appointments - empty query returns empty array', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-appointments/search?q=');

  // Mock AppointmentService.search
  const originalSearch = (await import('../../supabase/functions/api-appointments/services/appointmentService.ts')).AppointmentService.search;
  (await import('../../supabase/functions/api-appointments/services/appointmentService.ts')).AppointmentService.search = async () => [];

  try {
    const response = await search(request, employee);
    const data = await assertSuccessResponse<Record<string, unknown>[]>(response);
    assertEquals(Array.isArray(data), true);
    assertEquals(data.length, 0);
  } finally {
    (await import('../../supabase/functions/api-appointments/services/appointmentService.ts')).AppointmentService.search = originalSearch;
  }
});

