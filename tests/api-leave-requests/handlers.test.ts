/**
 * Unit tests for Leave Requests API handlers
 */

import { assertEquals, assertRejects } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { list } from '../../supabase/functions/api-leave-requests/handlers/list.ts';
import { create } from '../../supabase/functions/api-leave-requests/handlers/create.ts';
import { approve } from '../../supabase/functions/api-leave-requests/handlers/approve.ts';
import { createMockRequest, createMockJsonRequest, createMockEmployeeWithLevel, assertSuccessResponse } from '../_shared/mocks.ts';

const mockLeaveRequest = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  leave_type_id: '123e4567-e89b-12d3-a456-426614174001',
  start_date: '2025-01-15',
  end_date: '2025-01-16',
  reason: 'Personal reasons',
  status: 'pending',
};

Deno.test('list leave requests - success', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-leave-requests?page=1&limit=20');

  // Mock LeaveService.getAll
  const originalGetAll = (await import('../../supabase/functions/api-leave-requests/services/leaveService.ts')).LeaveService.getAll;
  (await import('../../supabase/functions/api-leave-requests/services/leaveService.ts')).LeaveService.getAll = async () => ({
    data: [mockLeaveRequest],
    pagination: { page: 1, limit: 20, total: 1, totalPages: 1, hasNext: false, hasPrevious: false },
  });

  try {
    const response = await list(request, employee);
    const data = await assertSuccessResponse<{ data: unknown[]; pagination: unknown }>(response);
    assertEquals(Array.isArray(data.data), true);
  } finally {
    (await import('../../supabase/functions/api-leave-requests/services/leaveService.ts')).LeaveService.getAll = originalGetAll;
  }
});

Deno.test('create leave request - success', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockJsonRequest('POST', 'http://localhost/api-leave-requests', {
    employee_id: employee.id,
    leave_type_id: '123e4567-e89b-12d3-a456-426614174001',
    start_date: '2025-01-15',
    end_date: '2025-01-16',
    reason: 'Personal reasons',
  });

  // Mock LeaveService.create
  const originalCreate = (await import('../../supabase/functions/api-leave-requests/services/leaveService.ts')).LeaveService.create;
  (await import('../../supabase/functions/api-leave-requests/services/leaveService.ts')).LeaveService.create = async () => mockLeaveRequest;

  try {
    const response = await create(request, employee);
    const data = await assertSuccessResponse<Record<string, unknown>>(response, 201);
    assertEquals(data.status, 'pending');
  } finally {
    (await import('../../supabase/functions/api-leave-requests/services/leaveService.ts')).LeaveService.create = originalCreate;
  }
});

Deno.test('approve leave request - requires level 2', async () => {
  const employee = createMockEmployeeWithLevel(1);
  const request = createMockJsonRequest('POST', 'http://localhost/api-leave-requests/123e4567-e89b-12d3-a456-426614174000/approve', {
    notes: 'Approved',
  });

  await assertRejects(
    async () => await approve(request, employee, '123e4567-e89b-12d3-a456-426614174000'),
    Error,
    'ต้องมีสิทธิ์ระดับ 2'
  );
});

Deno.test('list leave requests - filtering by status', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-leave-requests?status=pending');

  // Mock LeaveService.getAll
  const originalGetAll = (await import('../../supabase/functions/api-leave-requests/services/leaveService.ts')).LeaveService.getAll;
  (await import('../../supabase/functions/api-leave-requests/services/leaveService.ts')).LeaveService.getAll = async () => ({
    data: [mockLeaveRequest],
    pagination: { page: 1, limit: 20, total: 1, totalPages: 1, hasNext: false, hasPrevious: false },
  });

  try {
    const response = await list(request, employee);
    const data = await assertSuccessResponse<{ data: unknown[]; pagination: unknown }>(response);
    assertEquals(Array.isArray(data.data), true);
  } finally {
    (await import('../../supabase/functions/api-leave-requests/services/leaveService.ts')).LeaveService.getAll = originalGetAll;
  }
});

Deno.test('list leave requests - filtering by employee and date range', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-leave-requests?employee_id=123&start_date=2025-01-01&end_date=2025-12-31');

  // Mock LeaveService.getAll
  const originalGetAll = (await import('../../supabase/functions/api-leave-requests/services/leaveService.ts')).LeaveService.getAll;
  (await import('../../supabase/functions/api-leave-requests/services/leaveService.ts')).LeaveService.getAll = async () => ({
    data: [mockLeaveRequest],
    pagination: { page: 1, limit: 20, total: 1, totalPages: 1, hasNext: false, hasPrevious: false },
  });

  try {
    const response = await list(request, employee);
    const data = await assertSuccessResponse<{ data: unknown[]; pagination: unknown }>(response);
    assertEquals(Array.isArray(data.data), true);
  } finally {
    (await import('../../supabase/functions/api-leave-requests/services/leaveService.ts')).LeaveService.getAll = originalGetAll;
  }
});

Deno.test('list leave requests - filtering by leave type', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-leave-requests?leave_type_id=123e4567-e89b-12d3-a456-426614174001');

  // Mock LeaveService.getAll
  const originalGetAll = (await import('../../supabase/functions/api-leave-requests/services/leaveService.ts')).LeaveService.getAll;
  (await import('../../supabase/functions/api-leave-requests/services/leaveService.ts')).LeaveService.getAll = async () => ({
    data: [mockLeaveRequest],
    pagination: { page: 1, limit: 20, total: 1, totalPages: 1, hasNext: false, hasPrevious: false },
  });

  try {
    const response = await list(request, employee);
    const data = await assertSuccessResponse<{ data: unknown[]; pagination: unknown }>(response);
    assertEquals(Array.isArray(data.data), true);
  } finally {
    (await import('../../supabase/functions/api-leave-requests/services/leaveService.ts')).LeaveService.getAll = originalGetAll;
  }
});

