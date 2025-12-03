/**
 * Unit tests for Companies API handlers
 */

import { assertEquals, assertRejects } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { list } from '../../supabase/functions/api-companies/handlers/list.ts';
import { getById } from '../../supabase/functions/api-companies/handlers/getById.ts';
import { globalSearch } from '../../supabase/functions/api-companies/handlers/globalSearch.ts';
import { create } from '../../supabase/functions/api-companies/handlers/create.ts';
import { update } from '../../supabase/functions/api-companies/handlers/update.ts';
import { deleteCompany } from '../../supabase/functions/api-companies/handlers/delete.ts';
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

Deno.test('global search companies - success', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-companies/global-search?q=test&page=1&limit=20');

  // Mock CompanyService.globalSearch - returns paginated result
  const originalGlobalSearch = (await import('../../supabase/functions/api-companies/services/companyService.ts')).CompanyService.globalSearch;
  (await import('../../supabase/functions/api-companies/services/companyService.ts')).CompanyService.globalSearch = async () => ({
    data: [mockCompany],
    pagination: { page: 1, limit: 20, total: 1, totalPages: 1, hasNext: false, hasPrevious: false },
  });

  try {
    const response = await globalSearch(request, employee);
    const result = await assertSuccessResponse<{ data: unknown[]; pagination: { page: number; limit: number; total: number; totalPages: number; hasNext: boolean; hasPrevious: boolean } }>(response);
    assertEquals(Array.isArray(result.data), true);
    assertEquals(result.pagination !== undefined, true);
    assertEquals(result.pagination.page, 1);
    assertEquals(result.pagination.limit, 20);
  } finally {
    (await import('../../supabase/functions/api-companies/services/companyService.ts')).CompanyService.globalSearch = originalGlobalSearch;
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

Deno.test('global search companies - empty results', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-companies/global-search?q=nonexistent&page=1&limit=20');

  // Mock CompanyService.globalSearch - returns empty paginated result
  const originalGlobalSearch = (await import('../../supabase/functions/api-companies/services/companyService.ts')).CompanyService.globalSearch;
  (await import('../../supabase/functions/api-companies/services/companyService.ts')).CompanyService.globalSearch = async () => ({
    data: [],
    pagination: { page: 1, limit: 20, total: 0, totalPages: 0, hasNext: false, hasPrevious: false },
  });

  try {
    const response = await globalSearch(request, employee);
    const result = await assertSuccessResponse<{ data: unknown[]; pagination: { page: number; limit: number; total: number; totalPages: number; hasNext: boolean; hasPrevious: boolean } }>(response);
    assertEquals(Array.isArray(result.data), true);
    assertEquals(result.data.length, 0);
    assertEquals(result.pagination.total, 0);
  } finally {
    (await import('../../supabase/functions/api-companies/services/companyService.ts')).CompanyService.globalSearch = originalGlobalSearch;
  }
});

Deno.test('get company by id - success', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-companies/1234567890123');

  // Mock CompanyService.getById
  const originalGetById = (await import('../../supabase/functions/api-companies/services/companyService.ts')).CompanyService.getById;
  (await import('../../supabase/functions/api-companies/services/companyService.ts')).CompanyService.getById = async () => mockCompany;

  try {
    const response = await getById(request, employee, '1234567890123');
    const data = await assertSuccessResponse<typeof mockCompany>(response);
    assertEquals(data.tax_id, mockCompany.tax_id);
    assertEquals(data.name_th, mockCompany.name_th);
  } finally {
    (await import('../../supabase/functions/api-companies/services/companyService.ts')).CompanyService.getById = originalGetById;
  }
});

Deno.test('update company - requires level 1', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockJsonRequest('PUT', 'http://localhost/api-companies/1234567890123', {
    name_th: 'Updated Company Name',
  });

  await assertRejects(
    async () => await update(request, employee, '1234567890123'),
    Error,
    'ต้องมีสิทธิ์ระดับ 1'
  );
});

Deno.test('update company - success', async () => {
  const employee = createMockEmployeeWithLevel(1);
  const request = createMockJsonRequest('PUT', 'http://localhost/api-companies/1234567890123', {
    name_th: 'Updated Company Name',
  });

  const updatedCompany = { ...mockCompany, name_th: 'Updated Company Name' };

  // Mock CompanyService.update
  const originalUpdate = (await import('../../supabase/functions/api-companies/services/companyService.ts')).CompanyService.update;
  (await import('../../supabase/functions/api-companies/services/companyService.ts')).CompanyService.update = async () => updatedCompany;

  try {
    const response = await update(request, employee, '1234567890123');
    const data = await assertSuccessResponse<typeof updatedCompany>(response);
    assertEquals(data.name_th, 'Updated Company Name');
  } finally {
    (await import('../../supabase/functions/api-companies/services/companyService.ts')).CompanyService.update = originalUpdate;
  }
});

Deno.test('delete company - requires level 1', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('DELETE', 'http://localhost/api-companies/1234567890123');

  await assertRejects(
    async () => await deleteCompany(request, employee, '1234567890123'),
    Error,
    'ต้องมีสิทธิ์ระดับ 1'
  );
});

Deno.test('delete company - success', async () => {
  const employee = createMockEmployeeWithLevel(1);
  const request = createMockRequest('DELETE', 'http://localhost/api-companies/1234567890123');

  // Mock CompanyService.delete
  const originalDelete = (await import('../../supabase/functions/api-companies/services/companyService.ts')).CompanyService.delete;
  (await import('../../supabase/functions/api-companies/services/companyService.ts')).CompanyService.delete = async () => {};

  try {
    const response = await deleteCompany(request, employee, '1234567890123');
    const data = await assertSuccessResponse<{ message: string }>(response);
    assertEquals(data.message, 'ลบบริษัทสำเร็จ');
  } finally {
    (await import('../../supabase/functions/api-companies/services/companyService.ts')).CompanyService.delete = originalDelete;
  }
});

