/**
 * Unit tests for Notifications API handlers
 */

import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { getNotifications } from '../../supabase/functions/api-notifications/handlers/get.ts';
import { markAsRead } from '../../supabase/functions/api-notifications/handlers/markAsRead.ts';
import { createMockRequest, createMockJsonRequest, createMockEmployeeWithLevel, assertSuccessResponse } from '../_shared/mocks.ts';

const mockNotification = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  recipient_id: '123e4567-e89b-12d3-a456-426614174001',
  type: 'ticket_update',
  title: 'Test Notification',
  message: 'This is a test notification',
  ticket_id: '123e4567-e89b-12d3-a456-426614174002',
  comment_id: null,
  audit_id: null,
  is_read: false,
  read_at: null,
  created_at: '2025-01-01T00:00:00Z',
};

const mockPaginatedResult = {
  data: [mockNotification],
  pagination: { page: 1, limit: 20, total: 1, totalPages: 1, hasNext: false, hasPrevious: false },
  unread_count: 1,
};

Deno.test('getNotifications - success', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-notifications?page=1&limit=20');

  // Mock NotificationService.getByRecipient
  const module = await import('../../supabase/functions/api-tickets/services/notificationService.ts');
  const originalGetByRecipient = module.NotificationService.getByRecipient;
  module.NotificationService.getByRecipient = async () => mockPaginatedResult;

  try {
    const response = await getNotifications(request, employee);
    assertEquals(response.status, 200);
    const data = await response.json();
    assertEquals(Array.isArray(data.data), true);
    assertEquals(typeof data.unread_count, 'number');
  } finally {
    module.NotificationService.getByRecipient = originalGetByRecipient;
  }
});

Deno.test('getNotifications - with unread_only filter', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-notifications?unread_only=true');

  const module = await import('../../supabase/functions/api-tickets/services/notificationService.ts');
  const originalGetByRecipient = module.NotificationService.getByRecipient;
  module.NotificationService.getByRecipient = async () => mockPaginatedResult;

  try {
    const response = await getNotifications(request, employee);
    assertEquals(response.status, 200);
  } finally {
    module.NotificationService.getByRecipient = originalGetByRecipient;
  }
});

Deno.test('getNotifications - with search filter', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-notifications?search=test');

  const module = await import('../../supabase/functions/api-tickets/services/notificationService.ts');
  const originalGetByRecipient = module.NotificationService.getByRecipient;
  module.NotificationService.getByRecipient = async () => mockPaginatedResult;

  try {
    const response = await getNotifications(request, employee);
    assertEquals(response.status, 200);
  } finally {
    module.NotificationService.getByRecipient = originalGetByRecipient;
  }
});

Deno.test('markAsRead - mark specific notifications', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockJsonRequest('PUT', 'http://localhost/api-notifications/read', {
    notification_ids: [mockNotification.id],
  });

  const module = await import('../../supabase/functions/api-tickets/services/notificationService.ts');
  const originalMarkAsRead = module.NotificationService.markAsRead;
  module.NotificationService.markAsRead = async () => ({ marked_count: 1 });

  try {
    const response = await markAsRead(request, employee);
    const data = await assertSuccessResponse<{ marked_count: number }>(response);
    assertEquals(data.marked_count, 1);
  } finally {
    module.NotificationService.markAsRead = originalMarkAsRead;
  }
});

Deno.test('markAsRead - mark all notifications (no ids)', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockJsonRequest('PUT', 'http://localhost/api-notifications/read', {});

  const module = await import('../../supabase/functions/api-tickets/services/notificationService.ts');
  const originalMarkAsRead = module.NotificationService.markAsRead;
  module.NotificationService.markAsRead = async () => ({ marked_count: 5 });

  try {
    const response = await markAsRead(request, employee);
    const data = await assertSuccessResponse<{ marked_count: number }>(response);
    assertEquals(data.marked_count, 5);
  } finally {
    module.NotificationService.markAsRead = originalMarkAsRead;
  }
});

