/**
 * Unit tests for PM Summary API handlers
 */

import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { getSummary } from '../../supabase/functions/api-pm-summary/handlers/getSummary.ts';
import { getMerchandiseSummary } from '../../supabase/functions/api-pm-summary/handlers/getMerchandiseSummary.ts';
import { getPMLogs } from '../../supabase/functions/api-pm-summary/handlers/getPMLogs.ts';
import { createMockRequest, createMockEmployeeWithLevel, assertSuccessResponse } from '../_shared/mocks.ts';

const mockMerchandiseSummary = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  serial_no: 'SN12345',
  model_id: '123e4567-e89b-12d3-a456-426614174001',
  model: {
    id: '123e4567-e89b-12d3-a456-426614174001',
    model: 'MODEL-001',
    name: 'Test Model',
    website_url: null,
  },
  site_id: '123e4567-e89b-12d3-a456-426614174002',
  site: {
    id: '123e4567-e89b-12d3-a456-426614174002',
    name: 'Test Site',
  },
  pm_count: 10,
  distributor_id: null,
  dealer_id: null,
  replaced_by_id: null,
  distributor: null,
  dealer: null,
  replaced_by: null,
  pm_log_count: 8,
  needs_renewal: false,
  last_pm_date: '2025-11-15T10:30:00Z',
  created_at: '2025-11-17T00:00:00Z',
  updated_at: '2025-11-17T00:00:00Z',
};

const mockPMLog = {
  id: '123e4567-e89b-12d3-a456-426614174010',
  merchandise_id: '123e4567-e89b-12d3-a456-426614174000',
  description: 'เปลี่ยนน้ำมันและตรวจสอบระบบ',
  performed_at: '2025-11-17T10:30:00Z',
  performed_by: '123e4567-e89b-12d3-a456-426614174002',
  performer: {
    id: '123e4567-e89b-12d3-a456-426614174002',
    name_th: 'สมชาย ใจดี',
    nickname: 'ชาย',
  },
  created_at: '2025-11-17T00:00:00Z',
  updated_at: '2025-11-17T00:00:00Z',
};

Deno.test('get summary - success', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-pm-summary?page=1&limit=20');

  // Mock PMSummaryService.getSummary
  const originalGetSummary = (await import('../../supabase/functions/api-pm-summary/services/pmSummaryService.ts')).PMSummaryService.getSummary;
  (await import('../../supabase/functions/api-pm-summary/services/pmSummaryService.ts')).PMSummaryService.getSummary = async () => ({
    data: [mockMerchandiseSummary],
    pagination: { page: 1, limit: 20, total: 1, totalPages: 1, hasNext: false, hasPrevious: false },
  });

  try {
    const response = await getSummary(request, employee);
    const data = await assertSuccessResponse<{ data: unknown[]; pagination: unknown }>(response);
    assertEquals(Array.isArray(data.data), true);
  } finally {
    (await import('../../supabase/functions/api-pm-summary/services/pmSummaryService.ts')).PMSummaryService.getSummary = originalGetSummary;
  }
});

Deno.test('get summary with filters - success', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-pm-summary?site_id=123e4567-e89b-12d3-a456-426614174002&needs_renewal=false&page=1&limit=20');

  // Mock PMSummaryService.getSummary
  const originalGetSummary = (await import('../../supabase/functions/api-pm-summary/services/pmSummaryService.ts')).PMSummaryService.getSummary;
  (await import('../../supabase/functions/api-pm-summary/services/pmSummaryService.ts')).PMSummaryService.getSummary = async () => ({
    data: [mockMerchandiseSummary],
    pagination: { page: 1, limit: 20, total: 1, totalPages: 1, hasNext: false, hasPrevious: false },
  });

  try {
    const response = await getSummary(request, employee);
    const data = await assertSuccessResponse<{ data: unknown[]; pagination: unknown }>(response);
    assertEquals(Array.isArray(data.data), true);
  } finally {
    (await import('../../supabase/functions/api-pm-summary/services/pmSummaryService.ts')).PMSummaryService.getSummary = originalGetSummary;
  }
});

Deno.test('get merchandise summary - success', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-pm-summary/123e4567-e89b-12d3-a456-426614174000');

  // Mock PMSummaryService.getMerchandiseSummary
  const originalGetMerchandiseSummary = (await import('../../supabase/functions/api-pm-summary/services/pmSummaryService.ts')).PMSummaryService.getMerchandiseSummary;
  (await import('../../supabase/functions/api-pm-summary/services/pmSummaryService.ts')).PMSummaryService.getMerchandiseSummary = async () => mockMerchandiseSummary;

  try {
    const response = await getMerchandiseSummary(request, employee, '123e4567-e89b-12d3-a456-426614174000');
    const data = await assertSuccessResponse<typeof mockMerchandiseSummary>(response);
    assertEquals(data.serial_no, 'SN12345');
    assertEquals(data.pm_log_count, 8);
    assertEquals(data.needs_renewal, false);
  } finally {
    (await import('../../supabase/functions/api-pm-summary/services/pmSummaryService.ts')).PMSummaryService.getMerchandiseSummary = originalGetMerchandiseSummary;
  }
});

Deno.test('get merchandise summary - needs renewal', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-pm-summary/123e4567-e89b-12d3-a456-426614174000');

  // Mock PMSummaryService.getMerchandiseSummary with needs_renewal = true
  const originalGetMerchandiseSummary = (await import('../../supabase/functions/api-pm-summary/services/pmSummaryService.ts')).PMSummaryService.getMerchandiseSummary;
  const summaryNeedsRenewal = { ...mockMerchandiseSummary, pm_log_count: 10, needs_renewal: true };
  (await import('../../supabase/functions/api-pm-summary/services/pmSummaryService.ts')).PMSummaryService.getMerchandiseSummary = async () => summaryNeedsRenewal;

  try {
    const response = await getMerchandiseSummary(request, employee, '123e4567-e89b-12d3-a456-426614174000');
    const data = await assertSuccessResponse<typeof summaryNeedsRenewal>(response);
    assertEquals(data.pm_log_count, 10);
    assertEquals(data.needs_renewal, true);
  } finally {
    (await import('../../supabase/functions/api-pm-summary/services/pmSummaryService.ts')).PMSummaryService.getMerchandiseSummary = originalGetMerchandiseSummary;
  }
});

Deno.test('get pm logs for merchandise - success', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-pm-summary/123e4567-e89b-12d3-a456-426614174000/logs?page=1&limit=20');

  // Mock PMSummaryService.getPMLogs
  const originalGetPMLogs = (await import('../../supabase/functions/api-pm-summary/services/pmSummaryService.ts')).PMSummaryService.getPMLogs;
  (await import('../../supabase/functions/api-pm-summary/services/pmSummaryService.ts')).PMSummaryService.getPMLogs = async () => ({
    data: [mockPMLog],
    pagination: { page: 1, limit: 20, total: 1, totalPages: 1, hasNext: false, hasPrevious: false },
  });

  try {
    const response = await getPMLogs(request, employee, '123e4567-e89b-12d3-a456-426614174000');
    const data = await assertSuccessResponse<{ data: unknown[]; pagination: unknown }>(response);
    assertEquals(Array.isArray(data.data), true);
  } finally {
    (await import('../../supabase/functions/api-pm-summary/services/pmSummaryService.ts')).PMSummaryService.getPMLogs = originalGetPMLogs;
  }
});

