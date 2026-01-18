/**
 * Unit tests for Employee Site Trainings API handlers
 */

import { assertEquals, assertRejects } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { list } from '../../supabase/functions/api-employee-site-trainings/handlers/list.ts';
import { create } from '../../supabase/functions/api-employee-site-trainings/handlers/create.ts';
import { createMockRequest, createMockJsonRequest, createMockEmployeeWithLevel } from '../_shared/mocks.ts';

const mockTraining = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  employee_id: '123e4567-e89b-12d3-a456-426614174001',
  site_id: '123e4567-e89b-12d3-a456-426614174002',
  trained_at: '2025-01-01T00:00:00Z',
  created_at: '2025-01-01T00:00:00Z',
};

const mockPaginatedResult = {
  data: [mockTraining],
  pagination: { page: 1, limit: 20, total: 1, totalPages: 1, hasNext: false, hasPrevious: false },
};

Deno.test('list trainings - success (level 0)', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-employee-site-trainings?page=1&limit=20');

  const module = await import('../../supabase/functions/api-employee-site-trainings/services/employeeSiteTrainingService.ts');
  const originalGetAll = module.EmployeeSiteTrainingService.getAll;
  module.EmployeeSiteTrainingService.getAll = async () => mockPaginatedResult;

  try {
    const response = await list(request, employee);
    assertEquals(response.status, 200);
  } finally {
    module.EmployeeSiteTrainingService.getAll = originalGetAll;
  }
});

Deno.test('list trainings - with employee filter', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', `http://localhost/api-employee-site-trainings?employee_id=${mockTraining.employee_id}`);

  const module = await import('../../supabase/functions/api-employee-site-trainings/services/employeeSiteTrainingService.ts');
  const originalGetAll = module.EmployeeSiteTrainingService.getAll;
  module.EmployeeSiteTrainingService.getAll = async () => mockPaginatedResult;

  try {
    const response = await list(request, employee);
    assertEquals(response.status, 200);
  } finally {
    module.EmployeeSiteTrainingService.getAll = originalGetAll;
  }
});

Deno.test('list trainings - with site filter', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', `http://localhost/api-employee-site-trainings?site_id=${mockTraining.site_id}`);

  const module = await import('../../supabase/functions/api-employee-site-trainings/services/employeeSiteTrainingService.ts');
  const originalGetAll = module.EmployeeSiteTrainingService.getAll;
  module.EmployeeSiteTrainingService.getAll = async () => mockPaginatedResult;

  try {
    const response = await list(request, employee);
    assertEquals(response.status, 200);
  } finally {
    module.EmployeeSiteTrainingService.getAll = originalGetAll;
  }
});

Deno.test('create training - requires level 1', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockJsonRequest('POST', 'http://localhost/api-employee-site-trainings', {
    employee_id: mockTraining.employee_id,
    site_id: mockTraining.site_id,
  });

  await assertRejects(
    async () => await create(request, employee),
    Error,
    'ต้องมีสิทธิ์ระดับ 1'
  );
});

Deno.test('create training - success with level 1', async () => {
  const employee = createMockEmployeeWithLevel(1);
  const request = createMockJsonRequest('POST', 'http://localhost/api-employee-site-trainings', {
    employee_id: mockTraining.employee_id,
    site_id: mockTraining.site_id,
  });

  const module = await import('../../supabase/functions/api-employee-site-trainings/services/employeeSiteTrainingService.ts');
  const originalCreate = module.EmployeeSiteTrainingService.create;
  module.EmployeeSiteTrainingService.create = async () => mockTraining;

  try {
    const response = await create(request, employee);
    assertEquals(response.status, 201);
  } finally {
    module.EmployeeSiteTrainingService.create = originalCreate;
  }
});

