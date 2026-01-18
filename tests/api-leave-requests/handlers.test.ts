/**
 * Unit tests for Leave Requests API handlers
 * Tests validation logic and permission checks only
 */

import { assertEquals, assertRejects } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { list } from '../../supabase/functions/api-leave-requests/handlers/list.ts';
import { create } from '../../supabase/functions/api-leave-requests/handlers/create.ts';
import { approve } from '../../supabase/functions/api-leave-requests/handlers/approve.ts';
import { createMockRequest, createMockJsonRequest, createMockEmployeeWithLevel } from '../_shared/mocks.ts';

const mockLeaveRequest = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  employee_id: '123e4567-e89b-12d3-a456-426614174001',
  leave_type_id: '123e4567-e89b-12d3-a456-426614174002',
  start_date: '2025-01-15',
  end_date: '2025-01-16',
  reason: 'ลาป่วย',
  status: 'pending',
};

// ============ Handler Existence Tests ============

Deno.test('list handler exists', () => {
  assertEquals(typeof list, 'function');
});

Deno.test('create handler exists', () => {
  assertEquals(typeof create, 'function');
});

Deno.test('approve handler exists', () => {
  assertEquals(typeof approve, 'function');
});

// ============ Permission Tests ============

Deno.test('approve - requires level 2', async () => {
  const employee = createMockEmployeeWithLevel(1);
  const request = createMockJsonRequest('POST', `http://localhost/api-leave-requests/${mockLeaveRequest.id}/approve`, {
    is_approved: true,
  });

  await assertRejects(
    async () => await approve(request, employee, mockLeaveRequest.id),
    Error,
    'ต้องมีสิทธิ์ระดับ 2'
  );
});

// ============ Validation Tests ============

Deno.test('approve - invalid UUID throws error', async () => {
  const employee = createMockEmployeeWithLevel(2);
  const request = createMockRequest('POST', 'http://localhost/api-leave-requests/invalid-uuid/approve');

  await assertRejects(
    async () => await approve(request, employee, 'invalid-uuid'),
    Error,
    'ไม่ถูกต้อง'
  );
});

Deno.test('create - missing employee_id throws error', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockJsonRequest('POST', 'http://localhost/api-leave-requests', {
    leave_type_id: mockLeaveRequest.leave_type_id,
    start_date: mockLeaveRequest.start_date,
    end_date: mockLeaveRequest.end_date,
  });

  await assertRejects(
    async () => await create(request, employee),
    Error,
    'Employee ID'
  );
});

Deno.test('create - missing leave_type_id throws error', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockJsonRequest('POST', 'http://localhost/api-leave-requests', {
    employee_id: mockLeaveRequest.employee_id,
    start_date: mockLeaveRequest.start_date,
    end_date: mockLeaveRequest.end_date,
  });

  await assertRejects(
    async () => await create(request, employee),
    Error,
    'Leave Type ID'
  );
});

Deno.test('create - missing start_date throws error', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockJsonRequest('POST', 'http://localhost/api-leave-requests', {
    employee_id: mockLeaveRequest.employee_id,
    leave_type_id: mockLeaveRequest.leave_type_id,
    end_date: mockLeaveRequest.end_date,
  });

  await assertRejects(
    async () => await create(request, employee),
    Error,
    'Start Date'
  );
});

Deno.test('create - missing end_date throws error', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockJsonRequest('POST', 'http://localhost/api-leave-requests', {
    employee_id: mockLeaveRequest.employee_id,
    leave_type_id: mockLeaveRequest.leave_type_id,
    start_date: mockLeaveRequest.start_date,
  });

  await assertRejects(
    async () => await create(request, employee),
    Error,
    'End Date'
  );
});

// ============ Mocked Success Tests ============

Deno.test('approve - success with level 2', async () => {
  const employee = createMockEmployeeWithLevel(2);
  const request = createMockRequest('POST', `http://localhost/api-leave-requests/${mockLeaveRequest.id}/approve`);

  const module = await import('../../supabase/functions/api-leave-requests/services/leaveService.ts');
  const originalApprove = module.LeaveService.approve;
  module.LeaveService.approve = async () => ({ ...mockLeaveRequest, status: 'approved' });

  try {
    const response = await approve(request, employee, mockLeaveRequest.id);
    assertEquals(response.status, 200);
  } finally {
    module.LeaveService.approve = originalApprove;
  }
});

Deno.test('list - success with mocking', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-leave-requests?page=1&limit=20');

  const module = await import('../../supabase/functions/api-leave-requests/services/leaveService.ts');
  const originalGetAll = module.LeaveService.getAll;
  module.LeaveService.getAll = async () => ({
    data: [mockLeaveRequest],
    pagination: { page: 1, limit: 20, total: 1, totalPages: 1, hasNext: false, hasPrevious: false },
  });

  try {
    const response = await list(request, employee);
    assertEquals(response.status, 200);
  } finally {
    module.LeaveService.getAll = originalGetAll;
  }
});

Deno.test('create - success with mocking', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockJsonRequest('POST', 'http://localhost/api-leave-requests', {
    employee_id: mockLeaveRequest.employee_id,
    leave_type_id: mockLeaveRequest.leave_type_id,
    start_date: mockLeaveRequest.start_date,
    end_date: mockLeaveRequest.end_date,
    total_days: 2,
    reason: mockLeaveRequest.reason,
  });

  const module = await import('../../supabase/functions/api-leave-requests/services/leaveService.ts');
  const originalCreate = module.LeaveService.create;
  module.LeaveService.create = async () => mockLeaveRequest;

  try {
    const response = await create(request, employee);
    assertEquals(response.status, 201);
  } finally {
    module.LeaveService.create = originalCreate;
  }
});

