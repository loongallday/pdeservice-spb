/**
 * Unit tests for Announcements API handlers
 * Tests validation logic and permission checks only
 */

import { assertEquals, assertRejects } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { list } from '../../supabase/functions/api-announcements/handlers/list.ts';
import { getById } from '../../supabase/functions/api-announcements/handlers/getById.ts';
import { create } from '../../supabase/functions/api-announcements/handlers/create.ts';
import { update } from '../../supabase/functions/api-announcements/handlers/update.ts';
import { deleteAnnouncement } from '../../supabase/functions/api-announcements/handlers/delete.ts';
import { createMockRequest, createMockJsonRequest, createMockEmployeeWithLevel, assertSuccessResponse } from '../_shared/mocks.ts';

const mockAnnouncement = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  title: 'Test Announcement',
  content: 'This is a test announcement',
  priority: 'normal',
  is_active: true,
  created_at: '2025-01-01T00:00:00Z',
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

Deno.test('deleteAnnouncement handler exists', () => {
  assertEquals(typeof deleteAnnouncement, 'function');
});

// ============ Permission Tests ============

Deno.test('create - requires level 3 (superadmin)', async () => {
  const employee = createMockEmployeeWithLevel(2);
  const request = createMockJsonRequest('POST', 'http://localhost/api-announcements', {
    message: 'New Announcement',
  });

  await assertRejects(
    async () => await create(request, employee),
    Error,
    'ต้องมีสิทธิ์ระดับ 3'
  );
});

Deno.test('update - requires level 3 (superadmin)', async () => {
  const employee = createMockEmployeeWithLevel(2);
  const request = createMockJsonRequest('PUT', `http://localhost/api-announcements/${mockAnnouncement.id}`, {
    title: 'Updated Title',
  });

  await assertRejects(
    async () => await update(request, employee, mockAnnouncement.id),
    Error,
    'ต้องมีสิทธิ์ระดับ 3'
  );
});

Deno.test('delete - requires level 3 (superadmin)', async () => {
  const employee = createMockEmployeeWithLevel(2);
  const request = createMockRequest('DELETE', `http://localhost/api-announcements/${mockAnnouncement.id}`);

  await assertRejects(
    async () => await deleteAnnouncement(request, employee, mockAnnouncement.id),
    Error,
    'ต้องมีสิทธิ์ระดับ 3'
  );
});

// ============ Mocked Success Tests ============

Deno.test('list - success (level 0)', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-announcements');

  const module = await import('../../supabase/functions/api-announcements/services/announcementService.ts');
  const originalGetAll = module.AnnouncementService.getAll;
  module.AnnouncementService.getAll = async () => ({
    data: [mockAnnouncement],
    pagination: { page: 1, limit: 20, total: 1, totalPages: 1, hasNext: false, hasPrevious: false },
  });

  try {
    const response = await list(request, employee);
    assertEquals(response.status, 200);
  } finally {
    module.AnnouncementService.getAll = originalGetAll;
  }
});

Deno.test('getById - success', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', `http://localhost/api-announcements/${mockAnnouncement.id}`);

  const module = await import('../../supabase/functions/api-announcements/services/announcementService.ts');
  const originalGetById = module.AnnouncementService.getById;
  module.AnnouncementService.getById = async () => mockAnnouncement;

  try {
    const response = await getById(request, employee, mockAnnouncement.id);
    assertEquals(response.status, 200);
  } finally {
    module.AnnouncementService.getById = originalGetById;
  }
});

Deno.test('create - success with level 3', async () => {
  const employee = createMockEmployeeWithLevel(3);
  const request = createMockJsonRequest('POST', 'http://localhost/api-announcements', {
    message: 'New Announcement Content',
  });

  const module = await import('../../supabase/functions/api-announcements/services/announcementService.ts');
  const originalCreate = module.AnnouncementService.create;
  module.AnnouncementService.create = async () => mockAnnouncement;

  try {
    const response = await create(request, employee);
    assertEquals(response.status, 200);
  } finally {
    module.AnnouncementService.create = originalCreate;
  }
});

Deno.test('delete - success with level 3', async () => {
  const employee = createMockEmployeeWithLevel(3);
  const request = createMockRequest('DELETE', `http://localhost/api-announcements/${mockAnnouncement.id}`);

  const module = await import('../../supabase/functions/api-announcements/services/announcementService.ts');
  const originalDelete = module.AnnouncementService.delete;
  module.AnnouncementService.delete = async () => {};

  try {
    const response = await deleteAnnouncement(request, employee, mockAnnouncement.id);
    assertEquals(response.status, 200);
  } finally {
    module.AnnouncementService.delete = originalDelete;
  }
});

