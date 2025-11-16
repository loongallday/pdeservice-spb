/**
 * Unit tests for Polls API handlers
 */

import { assertEquals, assertRejects } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { list } from '../../supabase/functions/api-polls/handlers/list.ts';
import { create } from '../../supabase/functions/api-polls/handlers/create.ts';
import { vote } from '../../supabase/functions/api-polls/handlers/vote.ts';
import { createMockRequest, createMockJsonRequest, createMockEmployeeWithLevel, assertSuccessResponse } from '../_shared/mocks.ts';

const mockPoll = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  question: 'What is your favorite feature?',
  poll_type: 'single_choice',
  expires_at: '2025-12-31T23:59:59Z',
};

Deno.test('list polls - success', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-polls?page=1&limit=20');

  // Mock PollService.getAll
  const originalGetAll = (await import('../../supabase/functions/api-polls/services/pollService.ts')).PollService.getAll;
  (await import('../../supabase/functions/api-polls/services/pollService.ts')).PollService.getAll = async () => ({
    data: [mockPoll],
    pagination: { page: 1, limit: 20, total: 1, totalPages: 1, hasNext: false, hasPrevious: false },
  });

  try {
    const response = await list(request, employee);
    const data = await assertSuccessResponse<{ data: unknown[]; pagination: unknown }>(response);
    assertEquals(Array.isArray(data.data), true);
  } finally {
    (await import('../../supabase/functions/api-polls/services/pollService.ts')).PollService.getAll = originalGetAll;
  }
});

Deno.test('create poll - requires level 0 (all authenticated users)', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockJsonRequest('POST', 'http://localhost/api-polls', {
    question: 'Test question?',
    poll_type: 'single_choice',
  });

  // Mock PollService.create
  const originalCreate = (await import('../../supabase/functions/api-polls/services/pollService.ts')).PollService.create;
  (await import('../../supabase/functions/api-polls/services/pollService.ts')).PollService.create = async () => mockPoll;

  try {
    const response = await create(request, employee);
    const data = await assertSuccessResponse<Record<string, unknown>>(response, 201);
    // Mock returns mockPoll, so check against that
    assertEquals(data.question, mockPoll.question);
  } finally {
    (await import('../../supabase/functions/api-polls/services/pollService.ts')).PollService.create = originalCreate;
  }
});

Deno.test('vote on poll - success', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockJsonRequest('POST', 'http://localhost/api-polls/123e4567-e89b-12d3-a456-426614174000/vote', {
    option_id: '123e4567-e89b-12d3-a456-426614174001',
  });

  // Mock PollService.vote
  const originalVote = (await import('../../supabase/functions/api-polls/services/pollService.ts')).PollService.vote;
  (await import('../../supabase/functions/api-polls/services/pollService.ts')).PollService.vote = async () => ({
    id: '1',
    poll_id: '123e4567-e89b-12d3-a456-426614174000',
    employee_id: employee.id,
    option_id: '123e4567-e89b-12d3-a456-426614174001',
  });

  try {
    const response = await vote(request, employee, '123e4567-e89b-12d3-a456-426614174000');
    // Vote creation returns 201, not 200
    const data = await assertSuccessResponse<Record<string, unknown>>(response, 201);
    assertEquals(data.poll_id, '123e4567-e89b-12d3-a456-426614174000');
  } finally {
    (await import('../../supabase/functions/api-polls/services/pollService.ts')).PollService.vote = originalVote;
  }
});

Deno.test('list polls - filter active polls', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-polls?page=1&limit=20&filter=active');

  // Mock PollService.getAll
  const originalGetAll = (await import('../../supabase/functions/api-polls/services/pollService.ts')).PollService.getAll;
  (await import('../../supabase/functions/api-polls/services/pollService.ts')).PollService.getAll = async () => ({
    data: [mockPoll],
    pagination: { page: 1, limit: 20, total: 1, totalPages: 1, hasNext: false, hasPrevious: false },
  });

  try {
    const response = await list(request, employee);
    const data = await assertSuccessResponse<{ data: unknown[]; pagination: unknown }>(response);
    assertEquals(Array.isArray(data.data), true);
  } finally {
    (await import('../../supabase/functions/api-polls/services/pollService.ts')).PollService.getAll = originalGetAll;
  }
});

Deno.test('list polls - filter expired polls', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-polls?page=1&limit=20&filter=expired');

  // Mock PollService.getAll
  const originalGetAll = (await import('../../supabase/functions/api-polls/services/pollService.ts')).PollService.getAll;
  (await import('../../supabase/functions/api-polls/services/pollService.ts')).PollService.getAll = async () => ({
    data: [],
    pagination: { page: 1, limit: 20, total: 0, totalPages: 0, hasNext: false, hasPrevious: false },
  });

  try {
    const response = await list(request, employee);
    const data = await assertSuccessResponse<{ data: unknown[]; pagination: unknown }>(response);
    assertEquals(Array.isArray(data.data), true);
    assertEquals(data.data.length, 0);
  } finally {
    (await import('../../supabase/functions/api-polls/services/pollService.ts')).PollService.getAll = originalGetAll;
  }
});

Deno.test('list polls - filter all polls (default)', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-polls?page=1&limit=20&filter=all');

  // Mock PollService.getAll
  const originalGetAll = (await import('../../supabase/functions/api-polls/services/pollService.ts')).PollService.getAll;
  (await import('../../supabase/functions/api-polls/services/pollService.ts')).PollService.getAll = async () => ({
    data: [mockPoll],
    pagination: { page: 1, limit: 20, total: 1, totalPages: 1, hasNext: false, hasPrevious: false },
  });

  try {
    const response = await list(request, employee);
    const data = await assertSuccessResponse<{ data: unknown[]; pagination: unknown }>(response);
    assertEquals(Array.isArray(data.data), true);
  } finally {
    (await import('../../supabase/functions/api-polls/services/pollService.ts')).PollService.getAll = originalGetAll;
  }
});

