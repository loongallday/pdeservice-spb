/**
 * Unit tests for Contacts API handlers
 * Tests validation logic and permission checks only
 */

import { assertEquals, assertRejects } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { list } from '../../supabase/functions/api-contacts/handlers/list.ts';
import { get } from '../../supabase/functions/api-contacts/handlers/get.ts';
import { create } from '../../supabase/functions/api-contacts/handlers/create.ts';
import { update } from '../../supabase/functions/api-contacts/handlers/update.ts';
import { deleteContact } from '../../supabase/functions/api-contacts/handlers/delete.ts';
import { getBySite } from '../../supabase/functions/api-contacts/handlers/getBySite.ts';
import { search } from '../../supabase/functions/api-contacts/handlers/search.ts';
import { createMockRequest, createMockJsonRequest, createMockEmployeeWithLevel } from '../_shared/mocks.ts';

const mockContact = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  person_name: 'Test Contact',
  phone: '0812345678',
  email: 'test@example.com',
  site_id: '123e4567-e89b-12d3-a456-426614174001',
};

// ============ Handler Existence Tests ============

Deno.test('list handler exists', () => {
  assertEquals(typeof list, 'function');
});

Deno.test('get handler exists', () => {
  assertEquals(typeof get, 'function');
});

Deno.test('create handler exists', () => {
  assertEquals(typeof create, 'function');
});

Deno.test('update handler exists', () => {
  assertEquals(typeof update, 'function');
});

Deno.test('deleteContact handler exists', () => {
  assertEquals(typeof deleteContact, 'function');
});

Deno.test('getBySite handler exists', () => {
  assertEquals(typeof getBySite, 'function');
});

Deno.test('search handler exists', () => {
  assertEquals(typeof search, 'function');
});

// ============ Permission Tests ============

Deno.test('create contact - requires level 1', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockJsonRequest('POST', 'http://localhost/api-contacts', {
    person_name: 'New Contact',
    phone: '0812345678',
    site_id: mockContact.site_id,
  });

  await assertRejects(
    async () => await create(request, employee),
    Error,
    'ต้องมีสิทธิ์ระดับ 1'
  );
});

Deno.test('update contact - requires level 1', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockJsonRequest('PUT', `http://localhost/api-contacts/${mockContact.id}`, {
    person_name: 'Updated Contact',
  });

  await assertRejects(
    async () => await update(request, employee, mockContact.id),
    Error,
    'ต้องมีสิทธิ์ระดับ 1'
  );
});

Deno.test('delete contact - requires level 2', async () => {
  const employee = createMockEmployeeWithLevel(1);
  const request = createMockRequest('DELETE', `http://localhost/api-contacts/${mockContact.id}`);

  await assertRejects(
    async () => await deleteContact(request, employee, mockContact.id),
    Error,
    'ต้องมีสิทธิ์ระดับ 2'
  );
});

// ============ Validation Tests ============

Deno.test('get - invalid UUID throws error', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-contacts/invalid-uuid');

  await assertRejects(
    async () => await get(request, employee, 'invalid-uuid'),
    Error,
    'ไม่ถูกต้อง'
  );
});

Deno.test('update - invalid UUID throws error', async () => {
  const employee = createMockEmployeeWithLevel(1);
  const request = createMockJsonRequest('PUT', 'http://localhost/api-contacts/invalid-uuid', {
    person_name: 'Test',
  });

  await assertRejects(
    async () => await update(request, employee, 'invalid-uuid'),
    Error,
    'ไม่ถูกต้อง'
  );
});

Deno.test('delete - invalid UUID throws error', async () => {
  const employee = createMockEmployeeWithLevel(2);
  const request = createMockRequest('DELETE', 'http://localhost/api-contacts/invalid-uuid');

  await assertRejects(
    async () => await deleteContact(request, employee, 'invalid-uuid'),
    Error,
    'ไม่ถูกต้อง'
  );
});

Deno.test('create - missing person_name throws error', async () => {
  const employee = createMockEmployeeWithLevel(1);
  const request = createMockJsonRequest('POST', 'http://localhost/api-contacts', {
    phone: '0812345678',
  });

  await assertRejects(
    async () => await create(request, employee),
    Error,
    'ชื่อผู้ติดต่อ'
  );
});

// ============ Mocked Success Tests ============

Deno.test('list contacts - success with mocking', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-contacts?page=1&limit=20');

  const module = await import('../../supabase/functions/api-contacts/services/contactService.ts');
  const originalGetAll = module.ContactService.getAll;
  module.ContactService.getAll = async () => ({
    data: [mockContact],
    pagination: { page: 1, limit: 20, total: 1, totalPages: 1, hasNext: false, hasPrevious: false },
  });

  try {
    const response = await list(request, employee);
    assertEquals(response.status, 200);
  } finally {
    module.ContactService.getAll = originalGetAll;
  }
});

Deno.test('get - success with mocking', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', `http://localhost/api-contacts/${mockContact.id}`);

  const module = await import('../../supabase/functions/api-contacts/services/contactService.ts');
  const originalGetById = module.ContactService.getById;
  module.ContactService.getById = async () => mockContact;

  try {
    const response = await get(request, employee, mockContact.id);
    assertEquals(response.status, 200);
  } finally {
    module.ContactService.getById = originalGetById;
  }
});

Deno.test('create - success with level 1', async () => {
  const employee = createMockEmployeeWithLevel(1);
  const request = createMockJsonRequest('POST', 'http://localhost/api-contacts', {
    person_name: 'New Contact',
    phone: '0812345678',
  });

  const module = await import('../../supabase/functions/api-contacts/services/contactService.ts');
  const originalCreate = module.ContactService.create;
  module.ContactService.create = async () => mockContact;

  try {
    const response = await create(request, employee);
    assertEquals(response.status, 201);
  } finally {
    module.ContactService.create = originalCreate;
  }
});

Deno.test('update - success with level 1', async () => {
  const employee = createMockEmployeeWithLevel(1);
  const request = createMockJsonRequest('PUT', `http://localhost/api-contacts/${mockContact.id}`, {
    person_name: 'Updated Contact',
  });

  const module = await import('../../supabase/functions/api-contacts/services/contactService.ts');
  const originalUpdate = module.ContactService.update;
  module.ContactService.update = async () => ({ ...mockContact, person_name: 'Updated Contact' });

  try {
    const response = await update(request, employee, mockContact.id);
    assertEquals(response.status, 200);
  } finally {
    module.ContactService.update = originalUpdate;
  }
});

Deno.test('delete - success with level 2', async () => {
  const employee = createMockEmployeeWithLevel(2);
  const request = createMockRequest('DELETE', `http://localhost/api-contacts/${mockContact.id}`);

  const module = await import('../../supabase/functions/api-contacts/services/contactService.ts');
  const originalDelete = module.ContactService.delete;
  module.ContactService.delete = async () => {};

  try {
    const response = await deleteContact(request, employee, mockContact.id);
    assertEquals(response.status, 200);
  } finally {
    module.ContactService.delete = originalDelete;
  }
});

Deno.test('getBySite - success with mocking', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', `http://localhost/api-contacts/site/${mockContact.site_id}`);

  const module = await import('../../supabase/functions/api-contacts/services/contactService.ts');
  const originalGetBySite = module.ContactService.getBySite;
  module.ContactService.getBySite = async () => [mockContact];

  try {
    const response = await getBySite(request, employee, mockContact.site_id);
    assertEquals(response.status, 200);
  } finally {
    module.ContactService.getBySite = originalGetBySite;
  }
});

Deno.test('search - success with mocking', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-contacts/search?q=test');

  const module = await import('../../supabase/functions/api-contacts/services/contactService.ts');
  const originalSearch = module.ContactService.search;
  module.ContactService.search = async () => [mockContact];

  try {
    const response = await search(request, employee);
    assertEquals(response.status, 200);
  } finally {
    module.ContactService.search = originalSearch;
  }
});

