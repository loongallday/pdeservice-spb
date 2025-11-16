/**
 * Unit tests for Sites API handlers
 */

import { assertEquals, assertRejects } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { list } from '../../supabase/functions/api-sites/handlers/list.ts';
import { create } from '../../supabase/functions/api-sites/handlers/create.ts';
import { createMockRequest, createMockJsonRequest, createMockEmployeeWithLevel, assertSuccessResponse } from '../_shared/mocks.ts';

const mockSite = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  name: 'Main Office',
  company_id: '1234567890123',
  address_detail: '123 Main Street',
};

Deno.test('list sites - success', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-sites?page=1&limit=20');

  // Mock SiteService.getAll
  const originalGetAll = (await import('../../supabase/functions/api-sites/services/siteService.ts')).SiteService.getAll;
  (await import('../../supabase/functions/api-sites/services/siteService.ts')).SiteService.getAll = async () => ({
    data: [mockSite],
    pagination: { page: 1, limit: 20, total: 1, totalPages: 1, hasNext: false, hasPrevious: false },
  });

  try {
    const response = await list(request, employee);
    const data = await assertSuccessResponse<{ data: unknown[]; pagination: unknown }>(response);
    assertEquals(Array.isArray(data.data), true);
  } finally {
    (await import('../../supabase/functions/api-sites/services/siteService.ts')).SiteService.getAll = originalGetAll;
  }
});

Deno.test('create site - requires level 1', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockJsonRequest('POST', 'http://localhost/api-sites', {
    name: 'New Site',
    company_id: '1234567890123',
  });

  await assertRejects(
    async () => await create(request, employee),
    Error,
    'ต้องมีสิทธิ์ระดับ 1'
  );
});

Deno.test('list sites - pagination with filters', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-sites?page=1&limit=10&company_id=1234567890123');

  // Mock SiteService.getAll
  const originalGetAll = (await import('../../supabase/functions/api-sites/services/siteService.ts')).SiteService.getAll;
  (await import('../../supabase/functions/api-sites/services/siteService.ts')).SiteService.getAll = async () => ({
    data: [mockSite],
    pagination: { page: 1, limit: 10, total: 1, totalPages: 1, hasNext: false, hasPrevious: false },
  });

  try {
    const response = await list(request, employee);
    const data = await assertSuccessResponse<{ data: unknown[]; pagination: unknown }>(response);
    assertEquals(Array.isArray(data.data), true);
  } finally {
    (await import('../../supabase/functions/api-sites/services/siteService.ts')).SiteService.getAll = originalGetAll;
  }
});

Deno.test('list sites - pagination edge cases', async () => {
  const employee = createMockEmployeeWithLevel(0);
  
  // Test with large limit
  const request1 = createMockRequest('GET', 'http://localhost/api-sites?page=1&limit=100');
  const originalGetAll = (await import('../../supabase/functions/api-sites/services/siteService.ts')).SiteService.getAll;
  (await import('../../supabase/functions/api-sites/services/siteService.ts')).SiteService.getAll = async () => ({
    data: [mockSite],
    pagination: { page: 1, limit: 100, total: 1, totalPages: 1, hasNext: false, hasPrevious: false },
  });

  try {
    const response = await list(request1, employee);
    const data = await assertSuccessResponse<{ data: unknown[]; pagination: { limit: number } }>(response);
    assertEquals(data.pagination.limit, 100);
  } finally {
    (await import('../../supabase/functions/api-sites/services/siteService.ts')).SiteService.getAll = originalGetAll;
  }
});

