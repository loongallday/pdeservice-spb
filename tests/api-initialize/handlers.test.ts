/**
 * Unit tests for Initialize API handlers
 */

import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { initialize } from '../../supabase/functions/api-initialize/handlers/initialize.ts';
import { createMockRequest, createMockEmployeeWithLevel, assertSuccessResponse } from '../_shared/mocks.ts';

import type { InitializeData } from '../../supabase/functions/api-initialize/services/initializeService.ts';
import { createMockEmployee } from '../_shared/mocks.ts';

const mockInitializeData: InitializeData = {
  employee: createMockEmployee(),
  roles: [
    { id: '1', code: 'ADMIN', name_th: 'ผู้ดูแลระบบ', level: 2 } as Record<string, unknown>,
  ],
  departments: [
    { id: '1', code: 'IT', name_th: 'แผนกเทคโนโลยี' } as Record<string, unknown>,
  ],
  features: [
    { id: '1', code: 'DASHBOARD', name_th: 'แดชบอร์ด', min_level: 0 } as Record<string, unknown>,
  ],
};

Deno.test('initialize - success', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-initialize');

  // Mock InitializeService.getInitializeData
  const originalGetInitializeData = (await import('../../supabase/functions/api-initialize/services/initializeService.ts')).InitializeService.getInitializeData;
  (await import('../../supabase/functions/api-initialize/services/initializeService.ts')).InitializeService.getInitializeData = async () => mockInitializeData;

  try {
    const response = await initialize(request, employee);
    const data = await assertSuccessResponse<InitializeData>(response);
    
    assertEquals(data.employee.id, mockInitializeData.employee.id);
    assertEquals(Array.isArray(data.roles), true);
    assertEquals(Array.isArray(data.departments), true);
    assertEquals(Array.isArray(data.features), true);
  } finally {
    (await import('../../supabase/functions/api-initialize/services/initializeService.ts')).InitializeService.getInitializeData = originalGetInitializeData;
  }
});

Deno.test('initialize - requires level 0', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-initialize');

  // Mock InitializeService.getInitializeData
  const originalGetInitializeData = (await import('../../supabase/functions/api-initialize/services/initializeService.ts')).InitializeService.getInitializeData;
  (await import('../../supabase/functions/api-initialize/services/initializeService.ts')).InitializeService.getInitializeData = async () => mockInitializeData;

  try {
    // Should not throw for level 0
    const response = await initialize(request, employee);
    assertEquals(response.status < 400, true);
  } finally {
    (await import('../../supabase/functions/api-initialize/services/initializeService.ts')).InitializeService.getInitializeData = originalGetInitializeData;
  }
});

