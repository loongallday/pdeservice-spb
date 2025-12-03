/**
 * Unit tests for Tickets API search handler
 */

import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { search } from '../../supabase/functions/api-tickets/handlers/search.ts';
import { createMockRequest, createMockEmployeeWithLevel, assertSuccessResponse } from '../_shared/mocks.ts';

Deno.test('search tickets - success', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-tickets/search?q=TKT');

  const mockSearchResults = [
    {
      id: '123e4567-e89b-12d3-a456-426614174000',
      ticket_number: 'TKT-001',
      description: 'Test ticket',
      site_id: '123e4567-e89b-12d3-a456-426614174001',
      status_id: '123e4567-e89b-12d3-a456-426614174002',
    },
  ];

  // Mock TicketService.search
  const originalSearch = (await import('../../supabase/functions/api-tickets/services/ticketService.ts')).TicketService.search;
  (await import('../../supabase/functions/api-tickets/services/ticketService.ts')).TicketService.search = async () => mockSearchResults;

  try {
    const response = await search(request, employee);
    const data = await assertSuccessResponse<Record<string, unknown>[]>(response);
    assertEquals(Array.isArray(data), true);
    assertEquals(data.length, 1);
    assertEquals(data[0].ticket_number, 'TKT-001');
  } finally {
    (await import('../../supabase/functions/api-tickets/services/ticketService.ts')).TicketService.search = originalSearch;
  }
});

Deno.test('search tickets - empty query returns empty array', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-tickets/search?q=');

  // Mock TicketService.search
  const originalSearch = (await import('../../supabase/functions/api-tickets/services/ticketService.ts')).TicketService.search;
  (await import('../../supabase/functions/api-tickets/services/ticketService.ts')).TicketService.search = async () => [];

  try {
    const response = await search(request, employee);
    const data = await assertSuccessResponse<Record<string, unknown>[]>(response);
    assertEquals(Array.isArray(data), true);
    assertEquals(data.length, 0);
  } finally {
    (await import('../../supabase/functions/api-tickets/services/ticketService.ts')).TicketService.search = originalSearch;
  }
});

