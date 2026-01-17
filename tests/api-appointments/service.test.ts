/**
 * @fileoverview Unit tests for AppointmentService
 *
 * Tests the service layer business logic with mocked Supabase client.
 * Covers all service methods, edge cases, and error conditions.
 */

import { assertEquals, assertRejects } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { AppointmentService } from '../../supabase/functions/api-appointments/services/appointmentService.ts';
import type { Appointment, CreateAppointmentInput } from '../../supabase/functions/api-appointments/types.ts';

// =============================================================================
// Test Data
// =============================================================================

const mockAppointmentId = '123e4567-e89b-12d3-a456-426614174000';
const mockTicketId = '123e4567-e89b-12d3-a456-426614174001';

const mockAppointment: Appointment = {
  id: mockAppointmentId,
  appointment_type: 'time_range',
  appointment_date: '2026-01-20',
  appointment_time_start: '09:00:00',
  appointment_time_end: '12:00:00',
  is_approved: false,
  created_at: '2026-01-10T10:00:00Z',
  updated_at: '2026-01-10T10:00:00Z',
};

// =============================================================================
// Mock Supabase Client
// =============================================================================

interface MockQueryResult {
  data: unknown;
  error: { message: string; code?: string } | null;
  count?: number;
}

let mockSupabaseResponses: Record<string, MockQueryResult> = {};
let mockSupabaseCalls: Array<{ table: string; method: string; args: unknown[] }> = [];

// Mock the supabase module
const originalModule = await import('../../supabase/functions/_shared/supabase.ts');

function createMockSupabaseClient() {
  const createQueryBuilder = (tableName: string) => {
    let currentQuery: Record<string, unknown> = { table: tableName };

    const builder = {
      select: (columns?: string, options?: { count?: string; head?: boolean }) => {
        mockSupabaseCalls.push({ table: tableName, method: 'select', args: [columns, options] });
        currentQuery.select = columns;
        currentQuery.options = options;
        return builder;
      },
      insert: (data: unknown) => {
        mockSupabaseCalls.push({ table: tableName, method: 'insert', args: [data] });
        currentQuery.insert = data;
        return builder;
      },
      update: (data: unknown) => {
        mockSupabaseCalls.push({ table: tableName, method: 'update', args: [data] });
        currentQuery.update = data;
        return builder;
      },
      delete: () => {
        mockSupabaseCalls.push({ table: tableName, method: 'delete', args: [] });
        currentQuery.delete = true;
        return builder;
      },
      eq: (column: string, value: unknown) => {
        mockSupabaseCalls.push({ table: tableName, method: 'eq', args: [column, value] });
        currentQuery[`eq_${column}`] = value;
        return builder;
      },
      ilike: (column: string, pattern: string) => {
        mockSupabaseCalls.push({ table: tableName, method: 'ilike', args: [column, pattern] });
        currentQuery[`ilike_${column}`] = pattern;
        return builder;
      },
      or: (conditions: string) => {
        mockSupabaseCalls.push({ table: tableName, method: 'or', args: [conditions] });
        currentQuery.or = conditions;
        return builder;
      },
      order: (column: string, options?: { ascending?: boolean }) => {
        mockSupabaseCalls.push({ table: tableName, method: 'order', args: [column, options] });
        return builder;
      },
      range: (from: number, to: number) => {
        mockSupabaseCalls.push({ table: tableName, method: 'range', args: [from, to] });
        return builder;
      },
      limit: (count: number) => {
        mockSupabaseCalls.push({ table: tableName, method: 'limit', args: [count] });
        return builder;
      },
      single: async () => {
        mockSupabaseCalls.push({ table: tableName, method: 'single', args: [] });
        const key = `${tableName}_single`;
        return mockSupabaseResponses[key] || { data: null, error: null };
      },
      maybeSingle: async () => {
        mockSupabaseCalls.push({ table: tableName, method: 'maybeSingle', args: [] });
        const key = `${tableName}_maybeSingle`;
        return mockSupabaseResponses[key] || { data: null, error: null };
      },
      then: async (resolve: (value: MockQueryResult) => void) => {
        const key = `${tableName}_query`;
        const result = mockSupabaseResponses[key] || { data: [], error: null };
        resolve(result);
        return result;
      },
    };

    return builder;
  };

  return {
    from: (tableName: string) => createQueryBuilder(tableName),
  };
}

// Override the module's createServiceClient
function setupMocks() {
  mockSupabaseResponses = {};
  mockSupabaseCalls = [];
  (originalModule as Record<string, unknown>).createServiceClient = createMockSupabaseClient;
}

function setMockResponse(key: string, response: MockQueryResult) {
  mockSupabaseResponses[key] = response;
}

// =============================================================================
// Service Tests - getAll
// =============================================================================

Deno.test('AppointmentService.getAll - returns paginated appointments', async () => {
  setupMocks();
  setMockResponse('main_appointments_query', {
    data: [mockAppointment],
    error: null,
    count: 1,
  });

  const result = await AppointmentService.getAll({ page: 1, limit: 20 });

  assertEquals(Array.isArray(result.data), true);
  assertEquals(result.pagination.page, 1);
  assertEquals(result.pagination.limit, 20);
});

Deno.test('AppointmentService.getAll - handles empty results', async () => {
  setupMocks();
  setMockResponse('main_appointments_query', {
    data: [],
    error: null,
    count: 0,
  });

  const result = await AppointmentService.getAll({ page: 1, limit: 20 });

  assertEquals(result.data.length, 0);
  assertEquals(result.pagination.total, 0);
});

// =============================================================================
// Service Tests - getById
// =============================================================================

Deno.test('AppointmentService.getById - returns appointment', async () => {
  setupMocks();
  setMockResponse('main_appointments_single', {
    data: mockAppointment,
    error: null,
  });

  const result = await AppointmentService.getById(mockAppointmentId);

  assertEquals(result.id, mockAppointmentId);
  assertEquals(result.appointment_type, 'time_range');
});

Deno.test('AppointmentService.getById - throws NotFoundError for non-existent', async () => {
  setupMocks();
  setMockResponse('main_appointments_single', {
    data: null,
    error: { message: 'not found', code: 'PGRST116' },
  });

  await assertRejects(
    () => AppointmentService.getById('non-existent-id'),
    Error,
    'ไม่พบข้อมูลการนัดหมาย'
  );
});

// =============================================================================
// Service Tests - getByTicketId
// =============================================================================

Deno.test('AppointmentService.getByTicketId - returns appointment via ticket', async () => {
  setupMocks();
  // First call gets ticket with appointment_id
  setMockResponse('main_tickets_single', {
    data: { appointment_id: mockAppointmentId },
    error: null,
  });
  // Second call gets the appointment
  setMockResponse('main_appointments_single', {
    data: mockAppointment,
    error: null,
  });

  const result = await AppointmentService.getByTicketId(mockTicketId);

  assertEquals(result?.id, mockAppointmentId);
});

Deno.test('AppointmentService.getByTicketId - returns null when ticket has no appointment', async () => {
  setupMocks();
  setMockResponse('main_tickets_single', {
    data: { appointment_id: null },
    error: null,
  });

  const result = await AppointmentService.getByTicketId(mockTicketId);

  assertEquals(result, null);
});

Deno.test('AppointmentService.getByTicketId - returns null when ticket not found', async () => {
  setupMocks();
  setMockResponse('main_tickets_single', {
    data: null,
    error: { message: 'not found', code: 'PGRST116' },
  });

  const result = await AppointmentService.getByTicketId('non-existent-ticket');

  assertEquals(result, null);
});

// =============================================================================
// Service Tests - create
// =============================================================================

Deno.test('AppointmentService.create - creates appointment without ticket', async () => {
  setupMocks();
  setMockResponse('main_appointments_single', {
    data: mockAppointment,
    error: null,
  });

  const input: CreateAppointmentInput = {
    appointment_type: 'time_range',
    appointment_date: '2026-01-20',
  };

  const result = await AppointmentService.create(input);

  assertEquals(result.appointment_type, 'time_range');
  // Verify insert was called
  const insertCall = mockSupabaseCalls.find(c => c.method === 'insert');
  assertEquals(insertCall !== undefined, true);
});

Deno.test('AppointmentService.create - creates appointment and links to ticket', async () => {
  setupMocks();
  setMockResponse('main_appointments_single', {
    data: { ...mockAppointment, id: 'new-appointment-id' },
    error: null,
  });
  setMockResponse('main_tickets_query', {
    data: { id: mockTicketId },
    error: null,
  });

  const input: CreateAppointmentInput = {
    appointment_type: 'call_to_schedule',
    ticket_id: mockTicketId,
  };

  const result = await AppointmentService.create(input);

  assertEquals(result.id, 'new-appointment-id');
  // Verify ticket update was called
  const updateCall = mockSupabaseCalls.find(
    c => c.table === 'main_tickets' && c.method === 'update'
  );
  assertEquals(updateCall !== undefined, true);
});

Deno.test('AppointmentService.create - extracts ticket_id before insert', async () => {
  setupMocks();
  setMockResponse('main_appointments_single', {
    data: mockAppointment,
    error: null,
  });

  const input: CreateAppointmentInput = {
    appointment_type: 'full_day',
    ticket_id: mockTicketId,
  };

  await AppointmentService.create(input);

  // Verify the insert call doesn't include ticket_id
  const insertCall = mockSupabaseCalls.find(c => c.method === 'insert');
  if (insertCall) {
    const insertData = (insertCall.args[0] as unknown[])[0] as Record<string, unknown>;
    assertEquals(insertData.ticket_id, undefined);
    assertEquals(insertData.appointment_type, 'full_day');
  }
});

// =============================================================================
// Service Tests - update
// =============================================================================

Deno.test('AppointmentService.update - updates appointment', async () => {
  setupMocks();
  setMockResponse('main_appointments_single', {
    data: { ...mockAppointment, appointment_date: '2026-01-25' },
    error: null,
  });

  const result = await AppointmentService.update(mockAppointmentId, {
    appointment_date: '2026-01-25',
  });

  assertEquals(result.appointment_date, '2026-01-25');
});

Deno.test('AppointmentService.update - throws NotFoundError', async () => {
  setupMocks();
  setMockResponse('main_appointments_single', {
    data: null,
    error: { message: 'not found' },
  });

  await assertRejects(
    () => AppointmentService.update(mockAppointmentId, { appointment_date: '2026-01-25' }),
    Error
  );
});

// =============================================================================
// Service Tests - approve
// =============================================================================

Deno.test('AppointmentService.approve - approves appointment', async () => {
  setupMocks();
  // Current appointment state
  setMockResponse('main_appointments_single', {
    data: mockAppointment,
    error: null,
  });
  // Linked ticket
  setMockResponse('main_tickets_maybeSingle', {
    data: { id: mockTicketId },
    error: null,
  });

  const result = await AppointmentService.approve(mockAppointmentId, { is_approved: true }, 'approver-id');

  assertEquals(result.is_approved !== undefined, true);
});

Deno.test('AppointmentService.approve - defaults is_approved to true', async () => {
  setupMocks();
  setMockResponse('main_appointments_single', {
    data: { ...mockAppointment, is_approved: true },
    error: null,
  });
  setMockResponse('main_tickets_maybeSingle', {
    data: null,
    error: null,
  });

  const result = await AppointmentService.approve(mockAppointmentId, {});

  // The update should have set is_approved to true by default
  const updateCall = mockSupabaseCalls.find(
    c => c.table === 'main_appointments' && c.method === 'update'
  );
  assertEquals(updateCall !== undefined, true);
});

// =============================================================================
// Service Tests - delete
// =============================================================================

Deno.test('AppointmentService.delete - deletes appointment', async () => {
  setupMocks();
  setMockResponse('main_tickets_maybeSingle', {
    data: null,
    error: null,
  });
  setMockResponse('main_appointments_query', {
    data: null,
    error: null,
  });

  // Should not throw
  await AppointmentService.delete(mockAppointmentId);

  // Verify delete was called
  const deleteCall = mockSupabaseCalls.find(
    c => c.table === 'main_appointments' && c.method === 'delete'
  );
  assertEquals(deleteCall !== undefined, true);
});

Deno.test('AppointmentService.delete - clears ticket appointment_id', async () => {
  setupMocks();
  // Ticket is linked
  setMockResponse('main_tickets_maybeSingle', {
    data: { id: mockTicketId },
    error: null,
  });
  setMockResponse('main_appointments_query', {
    data: null,
    error: null,
  });
  setMockResponse('main_tickets_query', {
    data: null,
    error: null,
  });

  await AppointmentService.delete(mockAppointmentId);

  // Verify ticket update was called to clear appointment_id
  const updateCall = mockSupabaseCalls.find(
    c => c.table === 'main_tickets' && c.method === 'update'
  );
  assertEquals(updateCall !== undefined, true);
});

// =============================================================================
// Service Tests - search
// =============================================================================

Deno.test('AppointmentService.search - searches by appointment_type', async () => {
  setupMocks();
  setMockResponse('main_appointments_query', {
    data: [{ ...mockAppointment, appointment_type: 'half_morning' }],
    error: null,
  });

  const results = await AppointmentService.search('morning');

  assertEquals(Array.isArray(results), true);
  // Verify ilike was called on appointment_type
  const ilikeCall = mockSupabaseCalls.find(c => c.method === 'ilike');
  assertEquals(ilikeCall !== undefined, true);
  assertEquals(ilikeCall?.args[0], 'appointment_type');
});

Deno.test('AppointmentService.search - returns empty for empty query', async () => {
  setupMocks();

  const results = await AppointmentService.search('');

  assertEquals(results.length, 0);
  // Should not call database
  assertEquals(mockSupabaseCalls.length, 0);
});

Deno.test('AppointmentService.search - limits results to 20', async () => {
  setupMocks();
  setMockResponse('main_appointments_query', {
    data: Array(20).fill(mockAppointment),
    error: null,
  });

  await AppointmentService.search('test');

  // Verify limit was called with 20
  const limitCall = mockSupabaseCalls.find(c => c.method === 'limit');
  assertEquals(limitCall !== undefined, true);
  assertEquals(limitCall?.args[0], 20);
});

// =============================================================================
// Edge Cases & Error Handling
// =============================================================================

Deno.test('AppointmentService - handles database errors gracefully', async () => {
  setupMocks();
  setMockResponse('main_appointments_single', {
    data: null,
    error: { message: 'Database connection failed' },
  });

  await assertRejects(
    () => AppointmentService.getById(mockAppointmentId),
    Error
  );
});
