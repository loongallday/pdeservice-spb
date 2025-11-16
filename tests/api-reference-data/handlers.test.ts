/**
 * Unit tests for Reference Data API handlers
 */

import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { getWorkTypes } from '../../supabase/functions/api-reference-data/handlers/workTypes.ts';
import { getStatuses } from '../../supabase/functions/api-reference-data/handlers/statuses.ts';
import { getLeaveTypes } from '../../supabase/functions/api-reference-data/handlers/leaveTypes.ts';
import { getProvinces } from '../../supabase/functions/api-reference-data/handlers/provinces.ts';
import { createMockRequest, createMockEmployeeWithLevel, assertSuccessResponse } from '../_shared/mocks.ts';

Deno.test('get work types - success', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-reference-data/work-types');

  // Mock ReferenceService.getWorkTypes
  const originalGetWorkTypes = (await import('../../supabase/functions/api-reference-data/services/referenceService.ts')).ReferenceService.getWorkTypes;
  (await import('../../supabase/functions/api-reference-data/services/referenceService.ts')).ReferenceService.getWorkTypes = async () => [
    { id: '1', name: 'Installation', code: 'INSTALL' },
  ];

  try {
    const response = await getWorkTypes(request, employee);
    const data = await assertSuccessResponse<unknown[]>(response);
    assertEquals(Array.isArray(data), true);
  } finally {
    (await import('../../supabase/functions/api-reference-data/services/referenceService.ts')).ReferenceService.getWorkTypes = originalGetWorkTypes;
  }
});

Deno.test('get statuses - success', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-reference-data/statuses');

  // Mock ReferenceService.getTicketStatuses (correct method name)
  const originalGetTicketStatuses = (await import('../../supabase/functions/api-reference-data/services/referenceService.ts')).ReferenceService.getTicketStatuses;
  (await import('../../supabase/functions/api-reference-data/services/referenceService.ts')).ReferenceService.getTicketStatuses = async () => [
    { id: '1', name: 'Pending', code: 'PENDING' },
  ];

  try {
    const response = await getStatuses(request, employee);
    const data = await assertSuccessResponse<unknown[]>(response);
    assertEquals(Array.isArray(data), true);
  } finally {
    (await import('../../supabase/functions/api-reference-data/services/referenceService.ts')).ReferenceService.getTicketStatuses = originalGetTicketStatuses;
  }
});

Deno.test('get leave types - success', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-reference-data/leave-types');

  // Mock ReferenceService.getLeaveTypes
  const originalGetLeaveTypes = (await import('../../supabase/functions/api-reference-data/services/referenceService.ts')).ReferenceService.getLeaveTypes;
  (await import('../../supabase/functions/api-reference-data/services/referenceService.ts')).ReferenceService.getLeaveTypes = async () => [
    { id: '1', name_th: 'ลาป่วย', name_en: 'Sick Leave', code: 'SICK' },
  ];

  try {
    const response = await getLeaveTypes(request, employee);
    const data = await assertSuccessResponse<unknown[]>(response);
    assertEquals(Array.isArray(data), true);
  } finally {
    (await import('../../supabase/functions/api-reference-data/services/referenceService.ts')).ReferenceService.getLeaveTypes = originalGetLeaveTypes;
  }
});

Deno.test('get provinces - success', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-reference-data/provinces');

  // Mock ReferenceService.getProvinces
  const originalGetProvinces = (await import('../../supabase/functions/api-reference-data/services/referenceService.ts')).ReferenceService.getProvinces;
  (await import('../../supabase/functions/api-reference-data/services/referenceService.ts')).ReferenceService.getProvinces = async () => [
    { id: '1', name_th: 'กรุงเทพมหานคร', name_en: 'Bangkok', code: 'BKK' },
  ];

  try {
    const response = await getProvinces(request, employee);
    const data = await assertSuccessResponse<unknown[]>(response);
    assertEquals(Array.isArray(data), true);
  } finally {
    (await import('../../supabase/functions/api-reference-data/services/referenceService.ts')).ReferenceService.getProvinces = originalGetProvinces;
  }
});

