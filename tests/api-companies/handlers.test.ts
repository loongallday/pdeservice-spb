/**
 * Unit tests for Companies API handlers
 */

import { assertEquals, assertRejects } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { list } from '../../supabase/functions/api-companies/handlers/list.ts';
import { get } from '../../supabase/functions/api-companies/handlers/get.ts';
import { search } from '../../supabase/functions/api-companies/handlers/search.ts';
import { create } from '../../supabase/functions/api-companies/handlers/create.ts';
import { createMockRequest, createMockJsonRequest, createMockEmployeeWithLevel, assertSuccessResponse } from '../_shared/mocks.ts';

const mockCompany = {
  tax_id: '1234567890123',
  name_th: 'บริษัท ทดสอบ จำกัด',
  name_en: 'Test Company Ltd.',
};

Deno.test('list companies - success', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-companies?page=1&limit=20');

  // Mock CompanyService.getAll
  const originalGetAll = (await import('../../supabase/functions/api-companies/services/companyService.ts')).CompanyService.getAll;
  (await import('../../supabase/functions/api-companies/services/companyService.ts')).CompanyService.getAll = async () => ({
    data: [mockCompany],
    pagination: { page: 1, limit: 20, total: 1, totalPages: 1, hasNext: false, hasPrevious: false },
  });

  try {
    const response = await list(request, employee);
    const data = await assertSuccessResponse<{ data: unknown[]; pagination: unknown }>(response);
    assertEquals(Array.isArray(data.data), true);
  } finally {
    (await import('../../supabase/functions/api-companies/services/companyService.ts')).CompanyService.getAll = originalGetAll;
  }
});

Deno.test('search companies - success', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-companies/search?q=test');

  // Mock CompanyService.search - returns array, not paginated
  const originalSearch = (await import('../../supabase/functions/api-companies/services/companyService.ts')).CompanyService.search;
  (await import('../../supabase/functions/api-companies/services/companyService.ts')).CompanyService.search = async () => [mockCompany];

  try {
    const response = await search(request, employee);
    const data = await assertSuccessResponse<unknown[]>(response);
    assertEquals(Array.isArray(data), true);
  } finally {
    (await import('../../supabase/functions/api-companies/services/companyService.ts')).CompanyService.search = originalSearch;
  }
});

Deno.test('create company - requires level 1', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockJsonRequest('POST', 'http://localhost/api-companies', {
    tax_id: '1234567890123',
    name_th: 'บริษัท ทดสอบ จำกัด',
  });

  await assertRejects(
    async () => await create(request, employee),
    Error,
    'ต้องมีสิทธิ์ระดับ 1'
  );
});

Deno.test('create company - missing required fields', async () => {
  const employee = createMockEmployeeWithLevel(1);
  const request = createMockJsonRequest('POST', 'http://localhost/api-companies', {
    tax_id: '1234567890123',
    // Missing name_th
  });

  await assertRejects(
    async () => await create(request, employee),
    Error,
    'จำเป็นต้องระบุ'
  );
});

Deno.test('list companies - pagination with different page and limit', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-companies?page=2&limit=10');

  // Mock CompanyService.getAll
  const originalGetAll = (await import('../../supabase/functions/api-companies/services/companyService.ts')).CompanyService.getAll;
  (await import('../../supabase/functions/api-companies/services/companyService.ts')).CompanyService.getAll = async () => ({
    data: [mockCompany],
    pagination: { page: 2, limit: 10, total: 25, totalPages: 3, hasNext: true, hasPrevious: true },
  });

  try {
    const response = await list(request, employee);
    const data = await assertSuccessResponse<{ data: unknown[]; pagination: { page: number; limit: number; total: number; totalPages: number; hasNext: boolean; hasPrevious: boolean } }>(response);
    assertEquals(data.pagination.page, 2);
    assertEquals(data.pagination.limit, 10);
    assertEquals(data.pagination.total, 25);
    assertEquals(data.pagination.totalPages, 3);
    assertEquals(data.pagination.hasNext, true);
    assertEquals(data.pagination.hasPrevious, true);
  } finally {
    (await import('../../supabase/functions/api-companies/services/companyService.ts')).CompanyService.getAll = originalGetAll;
  }
});

Deno.test('list companies - pagination first page', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-companies?page=1&limit=20');

  // Mock CompanyService.getAll
  const originalGetAll = (await import('../../supabase/functions/api-companies/services/companyService.ts')).CompanyService.getAll;
  (await import('../../supabase/functions/api-companies/services/companyService.ts')).CompanyService.getAll = async () => ({
    data: [mockCompany],
    pagination: { page: 1, limit: 20, total: 5, totalPages: 1, hasNext: false, hasPrevious: false },
  });

  try {
    const response = await list(request, employee);
    const data = await assertSuccessResponse<{ data: unknown[]; pagination: { hasNext: boolean; hasPrevious: boolean } }>(response);
    assertEquals(data.pagination.hasNext, false);
    assertEquals(data.pagination.hasPrevious, false);
  } finally {
    (await import('../../supabase/functions/api-companies/services/companyService.ts')).CompanyService.getAll = originalGetAll;
  }
});

Deno.test('list companies - pagination last page', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-companies?page=5&limit=10');

  // Mock CompanyService.getAll
  const originalGetAll = (await import('../../supabase/functions/api-companies/services/companyService.ts')).CompanyService.getAll;
  (await import('../../supabase/functions/api-companies/services/companyService.ts')).CompanyService.getAll = async () => ({
    data: [mockCompany],
    pagination: { page: 5, limit: 10, total: 50, totalPages: 5, hasNext: false, hasPrevious: true },
  });

  try {
    const response = await list(request, employee);
    const data = await assertSuccessResponse<{ data: unknown[]; pagination: { hasNext: boolean; hasPrevious: boolean } }>(response);
    assertEquals(data.pagination.hasNext, false);
    assertEquals(data.pagination.hasPrevious, true);
  } finally {
    (await import('../../supabase/functions/api-companies/services/companyService.ts')).CompanyService.getAll = originalGetAll;
  }
});

Deno.test('list companies - default pagination (no params)', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-companies');

  // Mock CompanyService.getAll - should use defaults (page=1, limit=20)
  const originalGetAll = (await import('../../supabase/functions/api-companies/services/companyService.ts')).CompanyService.getAll;
  (await import('../../supabase/functions/api-companies/services/companyService.ts')).CompanyService.getAll = async () => ({
    data: [mockCompany],
    pagination: { page: 1, limit: 20, total: 1, totalPages: 1, hasNext: false, hasPrevious: false },
  });

  try {
    const response = await list(request, employee);
    const data = await assertSuccessResponse<{ data: unknown[]; pagination: { page: number; limit: number } }>(response);
    assertEquals(data.pagination.page, 1);
    assertEquals(data.pagination.limit, 20);
  } finally {
    (await import('../../supabase/functions/api-companies/services/companyService.ts')).CompanyService.getAll = originalGetAll;
  }
});

Deno.test('search companies - empty results', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-companies/search?q=nonexistent');

  // Mock CompanyService.search - returns empty array
  const originalSearch = (await import('../../supabase/functions/api-companies/services/companyService.ts')).CompanyService.search;
  (await import('../../supabase/functions/api-companies/services/companyService.ts')).CompanyService.search = async () => [];

  try {
    const response = await search(request, employee);
    const data = await assertSuccessResponse<unknown[]>(response);
    assertEquals(Array.isArray(data), true);
    assertEquals(data.length, 0);
  } finally {
    (await import('../../supabase/functions/api-companies/services/companyService.ts')).CompanyService.search = originalSearch;
  }
});

