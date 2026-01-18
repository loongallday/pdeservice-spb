/**
 * Unit tests for Package Services API handlers
 * Tests validation logic and permission checks only
 */

import { assertEquals, assertRejects } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { list } from '../../supabase/functions/api-package-services/handlers/list.ts';
import { getById } from '../../supabase/functions/api-package-services/handlers/getById.ts';
import { create } from '../../supabase/functions/api-package-services/handlers/create.ts';
import { update } from '../../supabase/functions/api-package-services/handlers/update.ts';
import { deletePackageService } from '../../supabase/functions/api-package-services/handlers/delete.ts';
import { createMockRequest, createMockJsonRequest, createMockEmployeeWithLevel, assertSuccessResponse } from '../_shared/mocks.ts';

const mockPackageService = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  code: 'PKG001',
  name_th: 'แพ็คเกจบริการ',
  name_en: 'Service Package',
  price: 1000,
  is_active: true,
};

// ============ Handler Existence Tests ============

Deno.test('list handler exists', () => {
  assertEquals(typeof list, 'function');
});

Deno.test('getById handler exists', () => {
  assertEquals(typeof getById, 'function');
});

Deno.test('create handler exists', () => {
  assertEquals(typeof create, 'function');
});

Deno.test('update handler exists', () => {
  assertEquals(typeof update, 'function');
});

Deno.test('deletePackageService handler exists', () => {
  assertEquals(typeof deletePackageService, 'function');
});

// ============ Permission Tests ============

Deno.test('create - requires level 1', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockJsonRequest('POST', 'http://localhost/api-package-services', {
    code: 'NEW001',
    name_th: 'แพ็คเกจใหม่',
  });

  await assertRejects(
    async () => await create(request, employee),
    Error,
    'ต้องมีสิทธิ์ระดับ 1'
  );
});

Deno.test('update - requires level 1', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockJsonRequest('PUT', `http://localhost/api-package-services/${mockPackageService.id}`, {
    name_th: 'Updated Name',
  });

  await assertRejects(
    async () => await update(request, employee, mockPackageService.id),
    Error,
    'ต้องมีสิทธิ์ระดับ 1'
  );
});

Deno.test('delete - requires level 2', async () => {
  const employee = createMockEmployeeWithLevel(1);
  const request = createMockRequest('DELETE', `http://localhost/api-package-services/${mockPackageService.id}`);

  await assertRejects(
    async () => await deletePackageService(request, employee, mockPackageService.id),
    Error,
    'ต้องมีสิทธิ์ระดับ 2'
  );
});

// ============ Validation Tests ============

Deno.test('create - missing code throws error', async () => {
  const employee = createMockEmployeeWithLevel(1);
  const request = createMockJsonRequest('POST', 'http://localhost/api-package-services', {
    name_th: 'แพ็คเกจใหม่',
  });

  await assertRejects(
    async () => await create(request, employee),
    Error,
    'รหัสบริการ'
  );
});

Deno.test('create - missing name_th throws error', async () => {
  const employee = createMockEmployeeWithLevel(1);
  const request = createMockJsonRequest('POST', 'http://localhost/api-package-services', {
    code: 'NEW001',
  });

  await assertRejects(
    async () => await create(request, employee),
    Error,
    'ชื่อภาษาไทย'
  );
});

Deno.test('update - invalid UUID throws error', async () => {
  const employee = createMockEmployeeWithLevel(1);
  const request = createMockJsonRequest('PUT', 'http://localhost/api-package-services/invalid-uuid', {
    name_th: 'Updated Name',
  });

  await assertRejects(
    async () => await update(request, employee, 'invalid-uuid'),
    Error,
    'ไม่ถูกต้อง'
  );
});

Deno.test('update - empty body throws error', async () => {
  const employee = createMockEmployeeWithLevel(1);
  const request = createMockJsonRequest('PUT', `http://localhost/api-package-services/${mockPackageService.id}`, {});

  await assertRejects(
    async () => await update(request, employee, mockPackageService.id),
    Error,
    'ไม่มีข้อมูลที่จะอัปเดต'
  );
});

Deno.test('getById - invalid UUID throws error', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-package-services/invalid-uuid');

  await assertRejects(
    async () => await getById(request, employee, 'invalid-uuid'),
    Error,
    'ไม่ถูกต้อง'
  );
});

Deno.test('delete - invalid UUID throws error', async () => {
  const employee = createMockEmployeeWithLevel(2);
  const request = createMockRequest('DELETE', 'http://localhost/api-package-services/invalid-uuid');

  await assertRejects(
    async () => await deletePackageService(request, employee, 'invalid-uuid'),
    Error,
    'ไม่ถูกต้อง'
  );
});

// ============ Mocked Success Tests ============

Deno.test('create - success with level 1', async () => {
  const employee = createMockEmployeeWithLevel(1);
  const request = createMockJsonRequest('POST', 'http://localhost/api-package-services', {
    code: 'NEW001',
    name_th: 'แพ็คเกจใหม่',
  });

  const module = await import('../../supabase/functions/api-package-services/services/packageServiceService.ts');
  const originalCreate = module.PackageServiceService.create;
  module.PackageServiceService.create = async () => mockPackageService;

  try {
    const response = await create(request, employee);
    assertEquals(response.status, 201);
  } finally {
    module.PackageServiceService.create = originalCreate;
  }
});

Deno.test('update - success with level 1', async () => {
  const employee = createMockEmployeeWithLevel(1);
  const request = createMockJsonRequest('PUT', `http://localhost/api-package-services/${mockPackageService.id}`, {
    name_th: 'Updated Name',
  });

  const module = await import('../../supabase/functions/api-package-services/services/packageServiceService.ts');
  const originalUpdate = module.PackageServiceService.update;
  module.PackageServiceService.update = async () => ({ ...mockPackageService, name_th: 'Updated Name' });

  try {
    const response = await update(request, employee, mockPackageService.id);
    assertEquals(response.status, 200);
  } finally {
    module.PackageServiceService.update = originalUpdate;
  }
});

Deno.test('getById - success with mocking', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', `http://localhost/api-package-services/${mockPackageService.id}`);

  const module = await import('../../supabase/functions/api-package-services/services/packageServiceService.ts');
  const originalGetById = module.PackageServiceService.getById;
  module.PackageServiceService.getById = async () => mockPackageService;

  try {
    const response = await getById(request, employee, mockPackageService.id);
    assertEquals(response.status, 200);
  } finally {
    module.PackageServiceService.getById = originalGetById;
  }
});

Deno.test('delete - success with level 2', async () => {
  const employee = createMockEmployeeWithLevel(2);
  const request = createMockRequest('DELETE', `http://localhost/api-package-services/${mockPackageService.id}`);

  const module = await import('../../supabase/functions/api-package-services/services/packageServiceService.ts');
  const originalDelete = module.PackageServiceService.delete;
  module.PackageServiceService.delete = async () => {};

  try {
    const response = await deletePackageService(request, employee, mockPackageService.id);
    assertEquals(response.status, 200);
  } finally {
    module.PackageServiceService.delete = originalDelete;
  }
});

