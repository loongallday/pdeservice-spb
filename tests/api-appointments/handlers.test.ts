/**
 * @fileoverview Comprehensive unit tests for Appointments API handlers
 *
 * Tests cover:
 * - All 8 endpoints (list, get, getByTicket, create, update, delete, search, approve)
 * - Permission levels (0, 1, 2, 3)
 * - Validation errors
 * - Success cases
 * - Edge cases
 */

import { assertEquals, assertRejects } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { list } from '../../supabase/functions/api-appointments/handlers/list.ts';
import { get } from '../../supabase/functions/api-appointments/handlers/get.ts';
import { create } from '../../supabase/functions/api-appointments/handlers/create.ts';
import { update } from '../../supabase/functions/api-appointments/handlers/update.ts';
import { deleteAppointment } from '../../supabase/functions/api-appointments/handlers/delete.ts';
import { getByTicket } from '../../supabase/functions/api-appointments/handlers/getByTicket.ts';
import { search } from '../../supabase/functions/api-appointments/handlers/search.ts';
import { approve } from '../../supabase/functions/api-appointments/handlers/approve.ts';
import {
  createMockJsonRequest,
  createMockRequest,
  createMockEmployee,
  createMockEmployeeWithLevel,
  assertSuccessResponse,
} from '../_shared/mocks.ts';
import type { Appointment } from '../../supabase/functions/api-appointments/types.ts';

// =============================================================================
// Test Data
// =============================================================================

const mockAppointment: Appointment = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  appointment_type: 'time_range',
  appointment_date: '2026-01-20',
  appointment_time_start: '09:00:00',
  appointment_time_end: '12:00:00',
  is_approved: false,
  created_at: '2026-01-10T10:00:00Z',
  updated_at: '2026-01-10T10:00:00Z',
};

const mockApprovedAppointment: Appointment = {
  ...mockAppointment,
  is_approved: true,
};

const mockTicketId = '123e4567-e89b-12d3-a456-426614174001';

// Helper to mock and restore service methods
async function withMockedService<T>(
  methodName: keyof typeof import('../../supabase/functions/api-appointments/services/appointmentService.ts').AppointmentService,
  mockFn: (...args: unknown[]) => Promise<T>,
  testFn: () => Promise<void>
): Promise<void> {
  const module = await import('../../supabase/functions/api-appointments/services/appointmentService.ts');
  const original = module.AppointmentService[methodName];
  (module.AppointmentService as Record<string, unknown>)[methodName] = mockFn;
  try {
    await testFn();
  } finally {
    (module.AppointmentService as Record<string, unknown>)[methodName] = original;
  }
}

// =============================================================================
// LIST ENDPOINT TESTS
// =============================================================================

Deno.test('GET /api-appointments - list appointments success', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-appointments?page=1&limit=20');

  await withMockedService(
    'getAll',
    async () => ({
      data: [mockAppointment],
      pagination: {
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
        hasNext: false,
        hasPrevious: false,
      },
    }),
    async () => {
      const response = await list(request, employee);
      assertEquals(response.status, 200);
      const data = await assertSuccessResponse<{ data: Appointment[]; pagination: unknown }>(response);
      assertEquals(Array.isArray(data.data), true);
      assertEquals(data.data.length, 1);
      assertEquals(data.data[0].id, mockAppointment.id);
    }
  );
});

Deno.test('GET /api-appointments - level 0 can access', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-appointments');

  await withMockedService(
    'getAll',
    async () => ({ data: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 0, hasNext: false, hasPrevious: false } }),
    async () => {
      const response = await list(request, employee);
      assertEquals(response.status, 200);
    }
  );
});

Deno.test('GET /api-appointments - filter by ticket_id', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', `http://localhost/api-appointments?ticket_id=${mockTicketId}`);

  await withMockedService(
    'getAll',
    async (params: { ticket_id?: string }) => {
      assertEquals(params.ticket_id, mockTicketId);
      return { data: [mockAppointment], pagination: { page: 1, limit: 50, total: 1, totalPages: 1, hasNext: false, hasPrevious: false } };
    },
    async () => {
      const response = await list(request, employee);
      assertEquals(response.status, 200);
    }
  );
});

// =============================================================================
// GET BY ID ENDPOINT TESTS
// =============================================================================

Deno.test('GET /api-appointments/:id - success', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', `http://localhost/api-appointments/${mockAppointment.id}`);

  await withMockedService(
    'getById',
    async () => mockAppointment,
    async () => {
      const response = await get(request, employee, mockAppointment.id);
      assertEquals(response.status, 200);
      const data = await assertSuccessResponse<Appointment>(response);
      assertEquals(data.id, mockAppointment.id);
      assertEquals(data.appointment_type, 'time_range');
    }
  );
});

Deno.test('GET /api-appointments/:id - invalid UUID', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-appointments/invalid-id');

  await assertRejects(
    async () => await get(request, employee, 'invalid-id'),
    Error,
    'UUID'
  );
});

// =============================================================================
// GET BY TICKET ENDPOINT TESTS
// =============================================================================

Deno.test('GET /api-appointments/ticket/:ticketId - success', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', `http://localhost/api-appointments/ticket/${mockTicketId}`);

  await withMockedService(
    'getByTicketId',
    async () => mockAppointment,
    async () => {
      const response = await getByTicket(request, employee, mockTicketId);
      assertEquals(response.status, 200);
      const data = await assertSuccessResponse<Appointment>(response);
      assertEquals(data.id, mockAppointment.id);
    }
  );
});

Deno.test('GET /api-appointments/ticket/:ticketId - no appointment returns null', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', `http://localhost/api-appointments/ticket/${mockTicketId}`);

  await withMockedService(
    'getByTicketId',
    async () => null,
    async () => {
      const response = await getByTicket(request, employee, mockTicketId);
      assertEquals(response.status, 200);
      const json = await response.json();
      assertEquals(json.data, null);
    }
  );
});

Deno.test('GET /api-appointments/ticket/:ticketId - invalid UUID', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-appointments/ticket/not-a-uuid');

  await assertRejects(
    async () => await getByTicket(request, employee, 'not-a-uuid'),
    Error,
    'UUID'
  );
});

// =============================================================================
// CREATE ENDPOINT TESTS
// =============================================================================

Deno.test('POST /api-appointments - create success', async () => {
  const employee = createMockEmployeeWithLevel(1);
  const request = createMockJsonRequest('POST', 'http://localhost/api-appointments', {
    appointment_type: 'time_range',
    appointment_date: '2026-01-25',
    appointment_time_start: '09:00',
    appointment_time_end: '12:00',
  });

  await withMockedService(
    'create',
    async () => mockAppointment,
    async () => {
      const response = await create(request, employee);
      assertEquals(response.status, 201);
      const data = await assertSuccessResponse<Appointment>(response, 201);
      assertEquals(data.appointment_type, 'time_range');
    }
  );
});

Deno.test('POST /api-appointments - requires level 1', async () => {
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

Deno.test('POST /api-appointments - missing appointment_type', async () => {
  const employee = createMockEmployeeWithLevel(1);
  const request = createMockJsonRequest('POST', 'http://localhost/api-appointments', {
    appointment_date: '2026-01-25',
  });

  await assertRejects(
    async () => await create(request, employee),
    Error,
    'จำเป็นต้องระบุ'
  );
});

Deno.test('POST /api-appointments - invalid ticket_id UUID', async () => {
  const employee = createMockEmployeeWithLevel(1);
  const request = createMockJsonRequest('POST', 'http://localhost/api-appointments', {
    appointment_type: 'full_day',
    ticket_id: 'not-a-uuid',
  });

  await assertRejects(
    async () => await create(request, employee),
    Error,
    'UUID'
  );
});

Deno.test('POST /api-appointments - with ticket_id links appointment', async () => {
  const employee = createMockEmployeeWithLevel(1);
  const request = createMockJsonRequest('POST', 'http://localhost/api-appointments', {
    appointment_type: 'call_to_schedule',
    ticket_id: mockTicketId,
  });

  await withMockedService(
    'create',
    async (data: { ticket_id?: string }) => {
      assertEquals(data.ticket_id, mockTicketId);
      return mockAppointment;
    },
    async () => {
      const response = await create(request, employee);
      assertEquals(response.status, 201);
    }
  );
});

// =============================================================================
// UPDATE ENDPOINT TESTS
// =============================================================================

Deno.test('PUT /api-appointments/:id - update success', async () => {
  const employee = createMockEmployeeWithLevel(1);
  const request = createMockJsonRequest('PUT', `http://localhost/api-appointments/${mockAppointment.id}`, {
    appointment_date: '2026-01-26',
    appointment_time_start: '14:00',
  });

  // Mock canApproveAppointments to return false
  const authModule = await import('../../supabase/functions/_shared/auth.ts');
  const originalCanApprove = authModule.canApproveAppointments;
  (authModule as Record<string, unknown>).canApproveAppointments = async () => false;

  await withMockedService(
    'update',
    async (_id: string, data: { is_approved?: boolean }) => {
      // Should set is_approved to false for non-approvers
      assertEquals(data.is_approved, false);
      return { ...mockAppointment, appointment_date: '2026-01-26' };
    },
    async () => {
      try {
        const response = await update(request, employee, mockAppointment.id);
        assertEquals(response.status, 200);
      } finally {
        (authModule as Record<string, unknown>).canApproveAppointments = originalCanApprove;
      }
    }
  );
});

Deno.test('PUT /api-appointments/:id - requires level 1', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockJsonRequest('PUT', `http://localhost/api-appointments/${mockAppointment.id}`, {
    appointment_date: '2026-01-26',
  });

  await assertRejects(
    async () => await update(request, employee, mockAppointment.id),
    Error,
    'ต้องมีสิทธิ์ระดับ 1'
  );
});

Deno.test('PUT /api-appointments/:id - invalid UUID', async () => {
  const employee = createMockEmployeeWithLevel(1);
  const request = createMockJsonRequest('PUT', 'http://localhost/api-appointments/bad-id', {
    appointment_date: '2026-01-26',
  });

  await assertRejects(
    async () => await update(request, employee, 'bad-id'),
    Error,
    'UUID'
  );
});

// =============================================================================
// DELETE ENDPOINT TESTS
// =============================================================================

Deno.test('DELETE /api-appointments/:id - success', async () => {
  const employee = createMockEmployeeWithLevel(1);
  const request = createMockRequest('DELETE', `http://localhost/api-appointments/${mockAppointment.id}`);

  await withMockedService(
    'delete',
    async () => undefined,
    async () => {
      const response = await deleteAppointment(request, employee, mockAppointment.id);
      assertEquals(response.status, 200);
      const json = await response.json();
      assertEquals(json.data.message, 'ลบการนัดหมายสำเร็จ');
    }
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

Deno.test('DELETE /api-appointments/:id - invalid UUID', async () => {
  const employee = createMockEmployeeWithLevel(1);
  const request = createMockRequest('DELETE', 'http://localhost/api-appointments/invalid');

  await assertRejects(
    async () => await deleteAppointment(request, employee, 'invalid'),
    Error,
    'UUID'
  );
});

// =============================================================================
// SEARCH ENDPOINT TESTS
// =============================================================================

Deno.test('GET /api-appointments/search - success', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-appointments/search?q=morning');

  await withMockedService(
    'search',
    async (query: string) => {
      assertEquals(query, 'morning');
      return [{ ...mockAppointment, appointment_type: 'half_morning' }];
    },
    async () => {
      const response = await search(request, employee);
      assertEquals(response.status, 200);
      const data = await assertSuccessResponse<Appointment[]>(response);
      assertEquals(Array.isArray(data), true);
      assertEquals(data.length, 1);
    }
  );
});

Deno.test('GET /api-appointments/search - empty query returns empty', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-appointments/search?q=');

  await withMockedService(
    'search',
    async () => [],
    async () => {
      const response = await search(request, employee);
      assertEquals(response.status, 200);
      const data = await assertSuccessResponse<Appointment[]>(response);
      assertEquals(data.length, 0);
    }
  );
});

Deno.test('GET /api-appointments/search - no q param', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-appointments/search');

  await withMockedService(
    'search',
    async (query: string) => {
      assertEquals(query, '');
      return [];
    },
    async () => {
      const response = await search(request, employee);
      assertEquals(response.status, 200);
    }
  );
});

// =============================================================================
// APPROVE ENDPOINT TESTS
// =============================================================================

Deno.test('POST /api-appointments/approve - approve success', async () => {
  // Create employee with approver permissions
  const employee = createMockEmployee({
    role_data: {
      id: '123e4567-e89b-12d3-a456-426614174001',
      code: 'PM',
      name_th: 'Project Manager',
      level: 2,
    },
  });

  const request = createMockJsonRequest('POST', 'http://localhost/api-appointments/approve', {
    id: mockAppointment.id,
  });

  // Mock requireCanApproveAppointments to not throw
  const authModule = await import('../../supabase/functions/_shared/auth.ts');
  const originalRequireCanApprove = authModule.requireCanApproveAppointments;
  (authModule as Record<string, unknown>).requireCanApproveAppointments = async () => undefined;

  await withMockedService(
    'approve',
    async (_id: string, data: { is_approved?: boolean }) => {
      assertEquals(data.is_approved, true); // Default to true
      return mockApprovedAppointment;
    },
    async () => {
      try {
        const response = await approve(request, employee);
        assertEquals(response.status, 200);
        const data = await assertSuccessResponse<Appointment>(response);
        assertEquals(data.is_approved, true);
      } finally {
        (authModule as Record<string, unknown>).requireCanApproveAppointments = originalRequireCanApprove;
      }
    }
  );
});

Deno.test('POST /api-appointments/approve - unapprove', async () => {
  const employee = createMockEmployee({
    role_data: { id: '1', code: 'PM', name_th: 'PM', level: 2 },
  });

  const request = createMockJsonRequest('POST', 'http://localhost/api-appointments/approve', {
    id: mockAppointment.id,
    is_approved: false,
  });

  const authModule = await import('../../supabase/functions/_shared/auth.ts');
  const originalRequireCanApprove = authModule.requireCanApproveAppointments;
  (authModule as Record<string, unknown>).requireCanApproveAppointments = async () => undefined;

  await withMockedService(
    'approve',
    async (_id: string, data: { is_approved?: boolean }) => {
      assertEquals(data.is_approved, false);
      return { ...mockAppointment, is_approved: false };
    },
    async () => {
      try {
        const response = await approve(request, employee);
        assertEquals(response.status, 200);
      } finally {
        (authModule as Record<string, unknown>).requireCanApproveAppointments = originalRequireCanApprove;
      }
    }
  );
});

Deno.test('POST /api-appointments/approve - missing id', async () => {
  const employee = createMockEmployee({
    role_data: { id: '1', code: 'PM', name_th: 'PM', level: 2 },
  });

  const request = createMockJsonRequest('POST', 'http://localhost/api-appointments/approve', {});

  const authModule = await import('../../supabase/functions/_shared/auth.ts');
  const originalRequireCanApprove = authModule.requireCanApproveAppointments;
  (authModule as Record<string, unknown>).requireCanApproveAppointments = async () => undefined;

  try {
    await assertRejects(
      async () => await approve(request, employee),
      Error,
      'จำเป็นต้องระบุ'
    );
  } finally {
    (authModule as Record<string, unknown>).requireCanApproveAppointments = originalRequireCanApprove;
  }
});

Deno.test('POST /api-appointments/approve - invalid UUID', async () => {
  const employee = createMockEmployee({
    role_data: { id: '1', code: 'PM', name_th: 'PM', level: 2 },
  });

  const request = createMockJsonRequest('POST', 'http://localhost/api-appointments/approve', {
    id: 'not-a-uuid',
  });

  const authModule = await import('../../supabase/functions/_shared/auth.ts');
  const originalRequireCanApprove = authModule.requireCanApproveAppointments;
  (authModule as Record<string, unknown>).requireCanApproveAppointments = async () => undefined;

  try {
    await assertRejects(
      async () => await approve(request, employee),
      Error,
      'UUID'
    );
  } finally {
    (authModule as Record<string, unknown>).requireCanApproveAppointments = originalRequireCanApprove;
  }
});

Deno.test('POST /api-appointments/approve - with optional fields', async () => {
  const employee = createMockEmployee({
    role_data: { id: '1', code: 'PM', name_th: 'PM', level: 2 },
  });

  const request = createMockJsonRequest('POST', 'http://localhost/api-appointments/approve', {
    id: mockAppointment.id,
    appointment_date: '2026-01-28',
    appointment_time_start: '10:00',
    appointment_type: 'half_morning',
  });

  const authModule = await import('../../supabase/functions/_shared/auth.ts');
  const originalRequireCanApprove = authModule.requireCanApproveAppointments;
  (authModule as Record<string, unknown>).requireCanApproveAppointments = async () => undefined;

  await withMockedService(
    'approve',
    async (_id: string, data: Record<string, unknown>) => {
      assertEquals(data.is_approved, true);
      assertEquals(data.appointment_date, '2026-01-28');
      assertEquals(data.appointment_time_start, '10:00');
      assertEquals(data.appointment_type, 'half_morning');
      return { ...mockApprovedAppointment, appointment_date: '2026-01-28' };
    },
    async () => {
      try {
        const response = await approve(request, employee);
        assertEquals(response.status, 200);
      } finally {
        (authModule as Record<string, unknown>).requireCanApproveAppointments = originalRequireCanApprove;
      }
    }
  );
});

// =============================================================================
// PERMISSION LEVEL TESTS
// =============================================================================

Deno.test('Permission levels - level 0 can read', async () => {
  const employee = createMockEmployeeWithLevel(0);

  await withMockedService('getAll', async () => ({ data: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 0, hasNext: false, hasPrevious: false } }), async () => {
    const listReq = createMockRequest('GET', 'http://localhost/api-appointments');
    const listRes = await list(listReq, employee);
    assertEquals(listRes.status, 200);
  });

  await withMockedService('getById', async () => mockAppointment, async () => {
    const getReq = createMockRequest('GET', `http://localhost/api-appointments/${mockAppointment.id}`);
    const getRes = await get(getReq, employee, mockAppointment.id);
    assertEquals(getRes.status, 200);
  });

  await withMockedService('search', async () => [], async () => {
    const searchReq = createMockRequest('GET', 'http://localhost/api-appointments/search?q=test');
    const searchRes = await search(searchReq, employee);
    assertEquals(searchRes.status, 200);
  });
});

Deno.test('Permission levels - level 0 cannot write', async () => {
  const employee = createMockEmployeeWithLevel(0);

  const createReq = createMockJsonRequest('POST', 'http://localhost/api-appointments', { appointment_type: 'full_day' });
  await assertRejects(() => create(createReq, employee), Error);

  const updateReq = createMockJsonRequest('PUT', `http://localhost/api-appointments/${mockAppointment.id}`, {});
  await assertRejects(() => update(updateReq, employee, mockAppointment.id), Error);

  const deleteReq = createMockRequest('DELETE', `http://localhost/api-appointments/${mockAppointment.id}`);
  await assertRejects(() => deleteAppointment(deleteReq, employee, mockAppointment.id), Error);
});

Deno.test('Permission levels - level 1+ can write', async () => {
  for (const level of [1, 2, 3]) {
    const employee = createMockEmployeeWithLevel(level);

    // Mock canApproveAppointments
    const authModule = await import('../../supabase/functions/_shared/auth.ts');
    const originalCanApprove = authModule.canApproveAppointments;
    (authModule as Record<string, unknown>).canApproveAppointments = async () => level >= 2;

    await withMockedService('create', async () => mockAppointment, async () => {
      const createReq = createMockJsonRequest('POST', 'http://localhost/api-appointments', { appointment_type: 'full_day' });
      const createRes = await create(createReq, employee);
      assertEquals(createRes.status, 201, `Level ${level} should be able to create`);
    });

    await withMockedService('update', async () => mockAppointment, async () => {
      const updateReq = createMockJsonRequest('PUT', `http://localhost/api-appointments/${mockAppointment.id}`, { appointment_date: '2026-02-01' });
      try {
        const updateRes = await update(updateReq, employee, mockAppointment.id);
        assertEquals(updateRes.status, 200, `Level ${level} should be able to update`);
      } finally {
        (authModule as Record<string, unknown>).canApproveAppointments = originalCanApprove;
      }
    });

    await withMockedService('delete', async () => undefined, async () => {
      const deleteReq = createMockRequest('DELETE', `http://localhost/api-appointments/${mockAppointment.id}`);
      const deleteRes = await deleteAppointment(deleteReq, employee, mockAppointment.id);
      assertEquals(deleteRes.status, 200, `Level ${level} should be able to delete`);
    });
  }
});
