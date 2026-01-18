/**
 * Unit tests for Search API handlers
 */

import { assertEquals, assertRejects } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { search } from '../../supabase/functions/api-search/handlers/search.ts';
import { createMockRequest, createMockEmployeeWithLevel, assertSuccessResponse } from '../_shared/mocks.ts';

const mockSearchResult = {
  companies: [
    { id: '1', name: 'Test Company', type: 'company' },
  ],
  sites: [
    { id: '2', name: 'Test Site', type: 'site' },
  ],
  tickets: [
    { id: '3', code: 'TK-001', type: 'ticket' },
  ],
  merchandise: [
    { id: '4', serial_no: 'SN001', type: 'merchandise' },
  ],
  employees: [
    { id: '5', name: 'Test Employee', type: 'employee' },
  ],
};

Deno.test('search - success (level 0)', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-search?q=test');

  const module = await import('../../supabase/functions/api-search/services/globalSearchService.ts');
  const originalSearch = module.GlobalSearchService.search;
  module.GlobalSearchService.search = async () => mockSearchResult;

  try {
    const response = await search(request, employee);
    const data = await assertSuccessResponse<typeof mockSearchResult>(response);
    assertEquals(typeof data, 'object');
    assertEquals(Array.isArray(data.companies), true);
    assertEquals(Array.isArray(data.sites), true);
    assertEquals(Array.isArray(data.tickets), true);
  } finally {
    module.GlobalSearchService.search = originalSearch;
  }
});

Deno.test('search - with limit', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-search?q=test&limit=5');

  const module = await import('../../supabase/functions/api-search/services/globalSearchService.ts');
  const originalSearch = module.GlobalSearchService.search;
  module.GlobalSearchService.search = async () => mockSearchResult;

  try {
    const response = await search(request, employee);
    assertEquals(response.status, 200);
  } finally {
    module.GlobalSearchService.search = originalSearch;
  }
});

Deno.test('search - short query throws validation error', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-search?q=a');

  await assertRejects(
    async () => await search(request, employee),
    Error,
    'อย่างน้อย 2'
  );
});

Deno.test('search - with type filter', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-search?q=test&types=company,site');

  const module = await import('../../supabase/functions/api-search/services/globalSearchService.ts');
  const originalSearch = module.GlobalSearchService.search;
  module.GlobalSearchService.search = async () => mockSearchResult;

  try {
    const response = await search(request, employee);
    assertEquals(response.status, 200);
  } finally {
    module.GlobalSearchService.search = originalSearch;
  }
});

