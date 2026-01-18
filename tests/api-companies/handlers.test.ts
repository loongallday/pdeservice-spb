/**
 * Unit tests for Companies API handlers
 * Tests validation logic and permission checks only
 */

import { assertEquals, assertRejects } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { getById } from '../../supabase/functions/api-companies/handlers/getById.ts';
import { globalSearch } from '../../supabase/functions/api-companies/handlers/globalSearch.ts';
import { hint } from '../../supabase/functions/api-companies/handlers/hint.ts';
import { create } from '../../supabase/functions/api-companies/handlers/create.ts';
import { update } from '../../supabase/functions/api-companies/handlers/update.ts';
import { deleteCompany } from '../../supabase/functions/api-companies/handlers/delete.ts';
import { createMockRequest, createMockJsonRequest, createMockEmployeeWithLevel, assertSuccessResponse } from '../_shared/mocks.ts';

const mockCompany = {
  tax_id: '1234567890123',
  name_th: 'บริษัท ทดสอบ จำกัด',
  name_en: 'Test Company Ltd.',
};

// ============ Handler Existence Tests ============

Deno.test('getById handler exists', () => {
  assertEquals(typeof getById, 'function');
});

Deno.test('globalSearch handler exists', () => {
  assertEquals(typeof globalSearch, 'function');
});

Deno.test('hint handler exists', () => {
  assertEquals(typeof hint, 'function');
});

Deno.test('create handler exists', () => {
  assertEquals(typeof create, 'function');
});

Deno.test('update handler exists', () => {
  assertEquals(typeof update, 'function');
});

Deno.test('deleteCompany handler exists', () => {
  assertEquals(typeof deleteCompany, 'function');
});

// ============ Permission Tests ============

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

Deno.test('delete company - requires level 1', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('DELETE', 'http://localhost/api-companies/1234567890123');

  await assertRejects(
    async () => await deleteCompany(request, employee, '1234567890123'),
    Error,
    'ต้องมีสิทธิ์ระดับ 1'
  );
});

// ============ Validation Tests ============

Deno.test('create company - missing required fields throws error', async () => {
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

// ============ Mocked Success Tests ============

Deno.test('hint - success with mocking', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-companies/hint?q=test');

  const module = await import('../../supabase/functions/api-companies/services/companyService.ts');
  const originalHint = module.CompanyService.hint;
  module.CompanyService.hint = async () => [mockCompany];

  try {
    const response = await hint(request, employee);
    assertEquals(response.status, 200);
  } finally {
    module.CompanyService.hint = originalHint;
  }
});

Deno.test('getById - success with mocking', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-companies/1234567890123');

  const module = await import('../../supabase/functions/api-companies/services/companyService.ts');
  const originalGetById = module.CompanyService.getById;
  module.CompanyService.getById = async () => mockCompany;

  try {
    const response = await getById(request, employee, '1234567890123');
    const data = await assertSuccessResponse<typeof mockCompany>(response);
    assertEquals(data.tax_id, mockCompany.tax_id);
  } finally {
    module.CompanyService.getById = originalGetById;
  }
});

Deno.test('update - success with mocking', async () => {
  const employee = createMockEmployeeWithLevel(1);
  const request = createMockJsonRequest('PUT', 'http://localhost/api-companies/1234567890123', {
    name_th: 'Updated Name',
  });

  const module = await import('../../supabase/functions/api-companies/services/companyService.ts');
  const originalUpdate = module.CompanyService.update;
  module.CompanyService.update = async () => ({ ...mockCompany, name_th: 'Updated Name' });

  try {
    const response = await update(request, employee, '1234567890123');
    assertEquals(response.status, 200);
  } finally {
    module.CompanyService.update = originalUpdate;
  }
});

Deno.test('delete - success with mocking', async () => {
  const employee = createMockEmployeeWithLevel(1);
  const request = createMockRequest('DELETE', 'http://localhost/api-companies/1234567890123');

  const module = await import('../../supabase/functions/api-companies/services/companyService.ts');
  const originalDelete = module.CompanyService.delete;
  module.CompanyService.delete = async () => {};

  try {
    const response = await deleteCompany(request, employee, '1234567890123');
    assertEquals(response.status, 200);
  } finally {
    module.CompanyService.delete = originalDelete;
  }
});

