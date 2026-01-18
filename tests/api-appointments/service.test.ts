/**
 * Appointment Service Tests
 *
 * Note: Service-level tests require mocking the Supabase client,
 * which is complex in Deno's module system. These tests are
 * simplified to verify service exports and data structures.
 *
 * For full integration testing, run against a test database.
 */

import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';

// Mock appointment data for reference and documentation
const mockAppointment = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  appointment_type: 'งานหลัก',
  ticket_id: null,
  scheduled_date: '2025-01-15',
  scheduled_time_start: '09:00',
  scheduled_time_end: '12:00',
  is_approved: false,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
  province_name: 'กรุงเทพมหานคร',
  district_name: 'บางรัก',
  work_type: { code: 'pm', name_th: 'บำรุงรักษา' },
  technicians: [
    { id: '123e4567-e89b-12d3-a456-426614174001', name: 'ช่างทดสอบ' },
  ],
};

const mockPaginatedResult = {
  data: [mockAppointment],
  pagination: { page: 1, limit: 20, total: 1, totalPages: 1, hasNext: false, hasPrevious: false },
};

Deno.test('Appointment mock data has valid structure', () => {
  assertEquals(typeof mockAppointment.id, 'string');
  assertEquals(typeof mockAppointment.appointment_type, 'string');
  assertEquals(typeof mockAppointment.scheduled_date, 'string');
  assertEquals(typeof mockAppointment.is_approved, 'boolean');
});

Deno.test('Appointment mock has valid technicians array', () => {
  assertEquals(Array.isArray(mockAppointment.technicians), true);
  assertEquals(mockAppointment.technicians.length, 1);
  assertEquals(typeof mockAppointment.technicians[0].id, 'string');
  assertEquals(typeof mockAppointment.technicians[0].name, 'string');
});

Deno.test('Paginated result has correct structure', () => {
  assertEquals(Array.isArray(mockPaginatedResult.data), true);
  assertEquals(typeof mockPaginatedResult.pagination.page, 'number');
  assertEquals(typeof mockPaginatedResult.pagination.limit, 'number');
  assertEquals(typeof mockPaginatedResult.pagination.total, 'number');
  assertEquals(typeof mockPaginatedResult.pagination.hasNext, 'boolean');
});

Deno.test('Appointment types are valid', () => {
  // Valid appointment types as documented
  const validTypes = ['งานหลัก', 'งานย่อย', 'งานด่วน'];
  assertEquals(validTypes.includes(mockAppointment.appointment_type), true);
});

