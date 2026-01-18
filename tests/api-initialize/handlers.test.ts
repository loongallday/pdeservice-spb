/**
 * Unit tests for Initialize API handlers
 * Tests validation logic and permission checks
 */

import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { initialize } from '../../supabase/functions/api-initialize/handlers/initialize.ts';
import { features } from '../../supabase/functions/api-initialize/handlers/features.ts';
import { me } from '../../supabase/functions/api-initialize/handlers/me.ts';
import { createMockRequest, createMockEmployeeWithLevel, assertSuccessResponse, createMockEmployee } from '../_shared/mocks.ts';

const mockEmployee = createMockEmployee();

const mockInitializeData = {
  employee: mockEmployee,
  department: {
    id: '1',
    code: 'IT',
    name_th: 'แผนกเทคโนโลยี',
    name_en: 'IT Department',
    is_active: true,
  },
  features: [
    { id: '1', code: 'DASHBOARD', name_th: 'แดชบอร์ด', min_level: 0 },
  ],
};

const mockFeatures = [
  { id: '1', code: 'DASHBOARD', name_th: 'แดชบอร์ด', min_level: 0, is_active: true },
  { id: '2', code: 'TICKETS', name_th: 'ตั๋วงาน', min_level: 0, is_active: true },
];

const mockUserInfo = {
  employee: mockEmployee,
  role: { id: '1', name: 'Technician', level: 0 },
  department: { id: '1', name_th: 'แผนกเทคนิค' },
  constants: {
    work_types: [],
    statuses: [],
  },
};

// ============ Handler Existence Tests ============

Deno.test('initialize handler exists', () => {
  assertEquals(typeof initialize, 'function');
});

Deno.test('features handler exists', () => {
  assertEquals(typeof features, 'function');
});

Deno.test('me handler exists', () => {
  assertEquals(typeof me, 'function');
});

// ============ Mocked Success Tests ============

Deno.test('initialize - success with level 0', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-initialize');

  const module = await import('../../supabase/functions/api-initialize/services/initializeService.ts');
  const original = module.InitializeService.getInitializeData;
  module.InitializeService.getInitializeData = async () => mockInitializeData;

  try {
    const response = await initialize(request, employee);
    assertEquals(response.status, 200);
  } finally {
    module.InitializeService.getInitializeData = original;
  }
});

Deno.test('initialize - returns employee data', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-initialize');

  const module = await import('../../supabase/functions/api-initialize/services/initializeService.ts');
  const original = module.InitializeService.getInitializeData;
  module.InitializeService.getInitializeData = async () => mockInitializeData;

  try {
    const response = await initialize(request, employee);
    const data = await assertSuccessResponse(response);
    assertEquals(data.employee.id, mockEmployee.id);
    assertEquals(Array.isArray(data.features), true);
  } finally {
    module.InitializeService.getInitializeData = original;
  }
});

Deno.test('features - success with level 0', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-initialize/features');

  const module = await import('../../supabase/functions/api-initialize/services/initializeService.ts');
  const original = module.InitializeService.getFeatures;
  module.InitializeService.getFeatures = async () => mockFeatures;

  try {
    const response = await features(request, employee);
    assertEquals(response.status, 200);
  } finally {
    module.InitializeService.getFeatures = original;
  }
});

Deno.test('features - returns feature array', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-initialize/features');

  const module = await import('../../supabase/functions/api-initialize/services/initializeService.ts');
  const original = module.InitializeService.getFeatures;
  module.InitializeService.getFeatures = async () => mockFeatures;

  try {
    const response = await features(request, employee);
    const data = await assertSuccessResponse(response);
    assertEquals(Array.isArray(data), true);
    assertEquals(data.length, 2);
  } finally {
    module.InitializeService.getFeatures = original;
  }
});

Deno.test('me - success with level 0', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-initialize/me');

  const module = await import('../../supabase/functions/api-initialize/services/initializeService.ts');
  const original = module.InitializeService.getCurrentUserInfo;
  module.InitializeService.getCurrentUserInfo = async () => mockUserInfo;

  try {
    const response = await me(request, employee);
    assertEquals(response.status, 200);
  } finally {
    module.InitializeService.getCurrentUserInfo = original;
  }
});

Deno.test('me - returns user info with role and department', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-initialize/me');

  const module = await import('../../supabase/functions/api-initialize/services/initializeService.ts');
  const original = module.InitializeService.getCurrentUserInfo;
  module.InitializeService.getCurrentUserInfo = async () => mockUserInfo;

  try {
    const response = await me(request, employee);
    const data = await assertSuccessResponse(response);
    assertEquals(data.employee.id, mockEmployee.id);
    assertEquals(typeof data.role, 'object');
    assertEquals(typeof data.department, 'object');
  } finally {
    module.InitializeService.getCurrentUserInfo = original;
  }
});

Deno.test('me - returns constants for frontend', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-initialize/me');

  const module = await import('../../supabase/functions/api-initialize/services/initializeService.ts');
  const original = module.InitializeService.getCurrentUserInfo;
  module.InitializeService.getCurrentUserInfo = async () => mockUserInfo;

  try {
    const response = await me(request, employee);
    const data = await assertSuccessResponse(response);
    assertEquals(typeof data.constants, 'object');
  } finally {
    module.InitializeService.getCurrentUserInfo = original;
  }
});

