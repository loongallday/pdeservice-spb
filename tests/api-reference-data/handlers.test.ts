/**
 * Unit tests for Reference Data API handlers
 * Tests all reference data endpoints
 */

import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { getWorkTypes } from '../../supabase/functions/api-reference-data/handlers/workTypes.ts';
import { getStatuses } from '../../supabase/functions/api-reference-data/handlers/statuses.ts';
import { getLeaveTypes } from '../../supabase/functions/api-reference-data/handlers/leaveTypes.ts';
import { getProvinces } from '../../supabase/functions/api-reference-data/handlers/provinces.ts';
import { getWorkGivers } from '../../supabase/functions/api-reference-data/handlers/workGivers.ts';
import { createMockRequest, createMockEmployeeWithLevel, assertSuccessResponse } from '../_shared/mocks.ts';

const mockWorkTypes = [
  { id: '1', name: 'PM', code: 'pm', name_th: 'บำรุงรักษา' },
  { id: '2', name: 'RMA', code: 'rma', name_th: 'เคลม/ซ่อม' },
];

const mockStatuses = [
  { id: '1', name: 'Open', code: 'open', name_th: 'เปิด' },
  { id: '2', name: 'Closed', code: 'closed', name_th: 'ปิด' },
];

const mockLeaveTypes = [
  { id: '1', name_th: 'ลาป่วย', name_en: 'Sick Leave', code: 'SICK' },
  { id: '2', name_th: 'ลาพักผ่อน', name_en: 'Annual Leave', code: 'ANNUAL' },
];

const mockProvinces = [
  { id: '1', name_th: 'กรุงเทพมหานคร', name_en: 'Bangkok', code: '10' },
  { id: '2', name_th: 'เชียงใหม่', name_en: 'Chiang Mai', code: '50' },
];

const mockWorkGivers = [
  { id: '1', name: 'Customer Direct', code: 'DIRECT' },
  { id: '2', name: 'Partner', code: 'PARTNER' },
];

// ============ Handler Existence Tests ============

Deno.test('getWorkTypes handler exists', () => {
  assertEquals(typeof getWorkTypes, 'function');
});

Deno.test('getStatuses handler exists', () => {
  assertEquals(typeof getStatuses, 'function');
});

Deno.test('getLeaveTypes handler exists', () => {
  assertEquals(typeof getLeaveTypes, 'function');
});

Deno.test('getProvinces handler exists', () => {
  assertEquals(typeof getProvinces, 'function');
});

Deno.test('getWorkGivers handler exists', () => {
  assertEquals(typeof getWorkGivers, 'function');
});

// ============ Mocked Success Tests ============

Deno.test('get work types - success with level 0', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-reference-data/work-types');

  const module = await import('../../supabase/functions/api-reference-data/services/referenceService.ts');
  const original = module.ReferenceService.getWorkTypes;
  module.ReferenceService.getWorkTypes = async () => mockWorkTypes;

  try {
    const response = await getWorkTypes(request, employee);
    assertEquals(response.status, 200);
  } finally {
    module.ReferenceService.getWorkTypes = original;
  }
});

Deno.test('get work types - returns array', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-reference-data/work-types');

  const module = await import('../../supabase/functions/api-reference-data/services/referenceService.ts');
  const original = module.ReferenceService.getWorkTypes;
  module.ReferenceService.getWorkTypes = async () => mockWorkTypes;

  try {
    const response = await getWorkTypes(request, employee);
    const data = await assertSuccessResponse(response);
    assertEquals(Array.isArray(data), true);
    assertEquals(data.length, 2);
  } finally {
    module.ReferenceService.getWorkTypes = original;
  }
});

Deno.test('get statuses - success with level 0', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-reference-data/statuses');

  const module = await import('../../supabase/functions/api-reference-data/services/referenceService.ts');
  const original = module.ReferenceService.getTicketStatuses;
  module.ReferenceService.getTicketStatuses = async () => mockStatuses;

  try {
    const response = await getStatuses(request, employee);
    assertEquals(response.status, 200);
  } finally {
    module.ReferenceService.getTicketStatuses = original;
  }
});

Deno.test('get statuses - returns array', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-reference-data/statuses');

  const module = await import('../../supabase/functions/api-reference-data/services/referenceService.ts');
  const original = module.ReferenceService.getTicketStatuses;
  module.ReferenceService.getTicketStatuses = async () => mockStatuses;

  try {
    const response = await getStatuses(request, employee);
    const data = await assertSuccessResponse(response);
    assertEquals(Array.isArray(data), true);
    assertEquals(data.length, 2);
  } finally {
    module.ReferenceService.getTicketStatuses = original;
  }
});

Deno.test('get leave types - success with level 0', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-reference-data/leave-types');

  const module = await import('../../supabase/functions/api-reference-data/services/referenceService.ts');
  const original = module.ReferenceService.getLeaveTypes;
  module.ReferenceService.getLeaveTypes = async () => mockLeaveTypes;

  try {
    const response = await getLeaveTypes(request, employee);
    assertEquals(response.status, 200);
  } finally {
    module.ReferenceService.getLeaveTypes = original;
  }
});

Deno.test('get leave types - returns array', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-reference-data/leave-types');

  const module = await import('../../supabase/functions/api-reference-data/services/referenceService.ts');
  const original = module.ReferenceService.getLeaveTypes;
  module.ReferenceService.getLeaveTypes = async () => mockLeaveTypes;

  try {
    const response = await getLeaveTypes(request, employee);
    const data = await assertSuccessResponse(response);
    assertEquals(Array.isArray(data), true);
    assertEquals(data.length, 2);
  } finally {
    module.ReferenceService.getLeaveTypes = original;
  }
});

Deno.test('get provinces - success with level 0', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-reference-data/provinces');

  const module = await import('../../supabase/functions/api-reference-data/services/referenceService.ts');
  const original = module.ReferenceService.getProvinces;
  module.ReferenceService.getProvinces = async () => mockProvinces;

  try {
    const response = await getProvinces(request, employee);
    assertEquals(response.status, 200);
  } finally {
    module.ReferenceService.getProvinces = original;
  }
});

Deno.test('get provinces - returns array', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-reference-data/provinces');

  const module = await import('../../supabase/functions/api-reference-data/services/referenceService.ts');
  const original = module.ReferenceService.getProvinces;
  module.ReferenceService.getProvinces = async () => mockProvinces;

  try {
    const response = await getProvinces(request, employee);
    const data = await assertSuccessResponse(response);
    assertEquals(Array.isArray(data), true);
    assertEquals(data.length, 2);
  } finally {
    module.ReferenceService.getProvinces = original;
  }
});

Deno.test('get work givers - success with level 0', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-reference-data/work-givers');

  const module = await import('../../supabase/functions/api-reference-data/services/referenceService.ts');
  const original = module.ReferenceService.getWorkGivers;
  module.ReferenceService.getWorkGivers = async () => mockWorkGivers;

  try {
    const response = await getWorkGivers(request, employee);
    assertEquals(response.status, 200);
  } finally {
    module.ReferenceService.getWorkGivers = original;
  }
});

Deno.test('get work givers - returns array', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-reference-data/work-givers');

  const module = await import('../../supabase/functions/api-reference-data/services/referenceService.ts');
  const original = module.ReferenceService.getWorkGivers;
  module.ReferenceService.getWorkGivers = async () => mockWorkGivers;

  try {
    const response = await getWorkGivers(request, employee);
    const data = await assertSuccessResponse(response);
    assertEquals(Array.isArray(data), true);
    assertEquals(data.length, 2);
  } finally {
    module.ReferenceService.getWorkGivers = original;
  }
});

