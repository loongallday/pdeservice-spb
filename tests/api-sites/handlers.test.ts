/**
 * Unit tests for Sites API handlers
 * Tests validation logic and permission checks only
 */

import { assertEquals, assertRejects } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { getById } from '../../supabase/functions/api-sites/handlers/getById.ts';
import { globalSearch } from '../../supabase/functions/api-sites/handlers/globalSearch.ts';
import { create } from '../../supabase/functions/api-sites/handlers/create.ts';
import { createMockRequest, createMockJsonRequest, createMockEmployeeWithLevel } from '../_shared/mocks.ts';

const mockSite = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  name: 'Test Site',
  code: 'SITE001',
  address: '123 Test Street',
  company_id: '1234567890123',
  subdistrict_code: '100101',
  district_code: '1001',
  province_code: '10',
  postal_code: '10200',
};

// ============ Handler Existence Tests ============

Deno.test('getById handler exists', () => {
  assertEquals(typeof getById, 'function');
});

Deno.test('globalSearch handler exists', () => {
  assertEquals(typeof globalSearch, 'function');
});

Deno.test('create handler exists', () => {
  assertEquals(typeof create, 'function');
});

// ============ Permission Tests ============

Deno.test('create site - requires level 1', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockJsonRequest('POST', 'http://localhost/api-sites', {
    name: 'New Site',
    company_id: mockSite.company_id,
  });

  await assertRejects(
    async () => await create(request, employee),
    Error,
    'ต้องมีสิทธิ์ระดับ 1'
  );
});

// ============ Validation Tests ============

Deno.test('getById - invalid UUID throws error', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-sites/invalid-uuid');

  await assertRejects(
    async () => await getById(request, employee, 'invalid-uuid'),
    Error,
    'ไม่ถูกต้อง'
  );
});

Deno.test('create - missing name throws error', async () => {
  const employee = createMockEmployeeWithLevel(1);
  const request = createMockJsonRequest('POST', 'http://localhost/api-sites', {
    subdistrict_code: mockSite.subdistrict_code,
    district_code: mockSite.district_code,
    province_code: mockSite.province_code,
    postal_code: mockSite.postal_code,
  });

  await assertRejects(
    async () => await create(request, employee),
    Error,
    'ชื่อสถานที่'
  );
});

Deno.test('create - missing subdistrict_code throws error', async () => {
  const employee = createMockEmployeeWithLevel(1);
  const request = createMockJsonRequest('POST', 'http://localhost/api-sites', {
    name: 'Test Site',
    district_code: mockSite.district_code,
    province_code: mockSite.province_code,
    postal_code: mockSite.postal_code,
  });

  await assertRejects(
    async () => await create(request, employee),
    Error,
    'รหัสตำบล'
  );
});

// ============ Mocked Success Tests ============

Deno.test('getById - success with mocking', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', `http://localhost/api-sites/${mockSite.id}`);

  const module = await import('../../supabase/functions/api-sites/services/siteService.ts');
  const originalGetById = module.SiteService.getById;
  module.SiteService.getById = async () => mockSite;

  try {
    const response = await getById(request, employee, mockSite.id);
    assertEquals(response.status, 200);
  } finally {
    module.SiteService.getById = originalGetById;
  }
});

Deno.test('globalSearch - success with mocking', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-sites/global-search?q=test');

  const module = await import('../../supabase/functions/api-sites/services/siteService.ts');
  const originalGlobalSearch = module.SiteService.globalSearch;
  module.SiteService.globalSearch = async () => ({
    data: [mockSite],
    pagination: { page: 1, limit: 20, total: 1, totalPages: 1, hasNext: false, hasPrevious: false },
  });

  try {
    const response = await globalSearch(request, employee);
    assertEquals(response.status, 200);
  } finally {
    module.SiteService.globalSearch = originalGlobalSearch;
  }
});

Deno.test('create - success with level 1', async () => {
  const employee = createMockEmployeeWithLevel(1);
  const request = createMockJsonRequest('POST', 'http://localhost/api-sites', {
    name: 'New Site',
    subdistrict_code: mockSite.subdistrict_code,
    district_code: mockSite.district_code,
    province_code: mockSite.province_code,
    postal_code: mockSite.postal_code,
  });

  const module = await import('../../supabase/functions/api-sites/services/siteService.ts');
  const originalCreate = module.SiteService.create;
  module.SiteService.create = async () => mockSite;

  try {
    const response = await create(request, employee);
    assertEquals(response.status, 201);
  } finally {
    module.SiteService.create = originalCreate;
  }
});

