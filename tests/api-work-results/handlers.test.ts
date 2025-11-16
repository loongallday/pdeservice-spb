/**
 * Unit tests for Work Results API handlers
 */

import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { get } from '../../supabase/functions/api-work-results/handlers/get.ts';
import { create } from '../../supabase/functions/api-work-results/handlers/create.ts';
import { createMockRequest, createMockJsonRequest, createMockEmployeeWithLevel, assertSuccessResponse } from '../_shared/mocks.ts';

const mockWorkResult = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  ticket_id: '123e4567-e89b-12d3-a456-426614174001',
  description: 'Work completed',
  result_note: 'All tasks finished',
  created_by: '123e4567-e89b-12d3-a456-426614174002',
};

Deno.test('get work result by id - success', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-work-results/123e4567-e89b-12d3-a456-426614174000');

  // Mock WorkResultService.getById
  const originalGetById = (await import('../../supabase/functions/api-work-results/services/workResultService.ts')).WorkResultService.getById;
  (await import('../../supabase/functions/api-work-results/services/workResultService.ts')).WorkResultService.getById = async () => mockWorkResult;

  try {
    const response = await get(request, employee, '123e4567-e89b-12d3-a456-426614174000');
    const data = await assertSuccessResponse<Record<string, unknown>>(response);
    assertEquals(data.id, '123e4567-e89b-12d3-a456-426614174000');
  } finally {
    (await import('../../supabase/functions/api-work-results/services/workResultService.ts')).WorkResultService.getById = originalGetById;
  }
});

Deno.test('create work result - requires level 0 (all authenticated users)', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockJsonRequest('POST', 'http://localhost/api-work-results', {
    ticket_id: '123e4567-e89b-12d3-a456-426614174001',
    description: 'Work completed',
  });

  // Mock WorkResultService.create
  const originalCreate = (await import('../../supabase/functions/api-work-results/services/workResultService.ts')).WorkResultService.create;
  (await import('../../supabase/functions/api-work-results/services/workResultService.ts')).WorkResultService.create = async () => mockWorkResult;

  try {
    const response = await create(request, employee);
    const data = await assertSuccessResponse<Record<string, unknown>>(response, 201);
    assertEquals(data.ticket_id, '123e4567-e89b-12d3-a456-426614174001');
  } finally {
    (await import('../../supabase/functions/api-work-results/services/workResultService.ts')).WorkResultService.create = originalCreate;
  }
});

