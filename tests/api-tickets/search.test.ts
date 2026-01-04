/**
 * Unit tests for Tickets API search handler
 * 
 * Tests the enhanced search endpoint that returns display-ready data
 * with pre-resolved location names and pre-formatted strings.
 */

import { assertEquals, assertExists } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { search } from '../../supabase/functions/api-tickets/handlers/search.ts';
import { createMockRequest, createMockEmployeeWithLevel, assertSuccessResponse } from '../_shared/mocks.ts';
import type { TicketDisplayItem } from '../../supabase/functions/api-tickets/services/ticketDisplayTypes.ts';

// Mock display item for testing
const createMockTicketDisplayItem = (overrides: Partial<TicketDisplayItem> = {}): TicketDisplayItem => ({
  id: '123e4567-e89b-12d3-a456-426614174000',
  site_name: 'ABC Corp HQ',
  company_name: 'ABC Corporation',
  work_type_name: 'PM',
  work_type_code: 'PM',
  status_name: 'In Progress',
  status_code: 'in_progress',
  assigner_name: 'John Doe',
  creator_name: 'Jane Smith',
  location: {
    province_code: 1,
    province_name: 'กรุงเทพมหานคร',
    district_code: 1001,
    district_name: 'เขตพระนคร',
    subdistrict_code: 100101,
    subdistrict_name: 'พระบรมมหาราชวัง',
    address_detail: '123 ถนนราชดำเนิน',
    display: 'พระนคร, กทม.',
  },
  appointment: {
    id: '123e4567-e89b-12d3-a456-426614174001',
    date: '2026-01-15',
    time_start: '09:00',
    time_end: '12:00',
    type: 'time_range',
    type_display: '09:00 - 12:00',
    is_approved: true,
  },
  employees: [
    {
      id: '123e4567-e89b-12d3-a456-426614174010',
      name: 'Tech One',
      code: 'EMP001',
      is_key: true,
      profile_image_url: null,
    },
    {
      id: '123e4567-e89b-12d3-a456-426614174011',
      name: 'Tech Two',
      code: 'EMP002',
      is_key: false,
      profile_image_url: null,
    },
  ],
  employee_count: 2,
  details: 'Test ticket details',
  additional: 'Additional notes',
  merchandise: [
    {
      id: '123e4567-e89b-12d3-a456-426614174020',
      serial_no: 'SN-001',
      model_name: 'Model X',
    },
  ],
  merchandise_count: 1,
  created_at: '2026-01-10T08:00:00.000Z',
  updated_at: '2026-01-10T10:00:00.000Z',
  _ids: {
    site_id: '123e4567-e89b-12d3-a456-426614174030',
    status_id: '123e4567-e89b-12d3-a456-426614174031',
    work_type_id: '123e4567-e89b-12d3-a456-426614174032',
    assigner_id: '123e4567-e89b-12d3-a456-426614174033',
    contact_id: '123e4567-e89b-12d3-a456-426614174034',
  },
  ...overrides,
});

Deno.test('search tickets - returns display-ready format', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-tickets/search');

  const mockDisplayItem = createMockTicketDisplayItem();
  const mockSearchResults = {
    data: [mockDisplayItem],
    pagination: {
      page: 1,
      limit: 20,
      total: 1,
      totalPages: 1,
      hasNext: false,
      hasPrevious: false,
    },
  };

  // Mock TicketService.search
  const ticketServiceModule = await import('../../supabase/functions/api-tickets/services/ticketService.ts');
  const originalSearch = ticketServiceModule.TicketService.search;
  ticketServiceModule.TicketService.search = async () => mockSearchResults;

  try {
    const response = await search(request, employee);
    const result = await assertSuccessResponse<{ data: TicketDisplayItem[]; pagination: unknown }>(response);
    
    assertEquals(Array.isArray(result.data), true);
    assertEquals(result.data.length, 1);
    
    const ticket = result.data[0];
    
    // Check display strings
    assertEquals(ticket.site_name, 'ABC Corp HQ');
    assertEquals(ticket.company_name, 'ABC Corporation');
    assertEquals(ticket.work_type_name, 'PM');
    assertEquals(ticket.status_name, 'In Progress');
    assertEquals(ticket.assigner_name, 'John Doe');
    
    // Check location is pre-resolved
    assertExists(ticket.location);
    assertEquals(ticket.location.province_name, 'กรุงเทพมหานคร');
    assertEquals(ticket.location.district_name, 'เขตพระนคร');
    assertEquals(ticket.location.display, 'พระนคร, กทม.');
    
    // Check appointment is pre-formatted
    assertExists(ticket.appointment);
    assertEquals(ticket.appointment.type_display, '09:00 - 12:00');
    assertEquals(ticket.appointment.is_approved, true);
    
    // Check employees are included with full data
    assertEquals(ticket.employees.length, 2);
    assertEquals(ticket.employees[0].name, 'Tech One');
    assertEquals(ticket.employees[0].is_key, true);
    assertEquals(ticket.employee_count, 2);
    
    // Check merchandise is summarized
    assertEquals(ticket.merchandise.length, 1);
    assertEquals(ticket.merchandise[0].serial_no, 'SN-001');
    assertEquals(ticket.merchandise_count, 1);
    
    // Check IDs are included in full mode
    assertExists(ticket._ids);
    assertEquals(ticket._ids.site_id, '123e4567-e89b-12d3-a456-426614174030');
  } finally {
    ticketServiceModule.TicketService.search = originalSearch;
  }
});

Deno.test('search tickets - minimal mode excludes _ids', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-tickets/search?include=minimal');

  // Create a minimal display item (no _ids)
  const { _ids, ...minimalItem } = createMockTicketDisplayItem();
  const mockSearchResults = {
    data: [minimalItem as TicketDisplayItem],
    pagination: {
      page: 1,
      limit: 20,
      total: 1,
      totalPages: 1,
      hasNext: false,
      hasPrevious: false,
    },
  };

  const ticketServiceModule = await import('../../supabase/functions/api-tickets/services/ticketService.ts');
  const originalSearch = ticketServiceModule.TicketService.search;
  ticketServiceModule.TicketService.search = async () => mockSearchResults;

  try {
    const response = await search(request, employee);
    const result = await assertSuccessResponse<{ data: TicketDisplayItem[]; pagination: unknown }>(response);
    
    assertEquals(result.data.length, 1);
    assertEquals(result.data[0]._ids, undefined);
  } finally {
    ticketServiceModule.TicketService.search = originalSearch;
  }
});

Deno.test('search tickets - empty results returns empty array', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-tickets/search?details=nonexistent');

  const mockSearchResults = {
    data: [],
    pagination: {
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 0,
      hasNext: false,
      hasPrevious: false,
    },
  };

  const ticketServiceModule = await import('../../supabase/functions/api-tickets/services/ticketService.ts');
  const originalSearch = ticketServiceModule.TicketService.search;
  ticketServiceModule.TicketService.search = async () => mockSearchResults;

  try {
    const response = await search(request, employee);
    const result = await assertSuccessResponse<{ data: TicketDisplayItem[]; pagination: unknown }>(response);
    
    assertEquals(Array.isArray(result.data), true);
    assertEquals(result.data.length, 0);
  } finally {
    ticketServiceModule.TicketService.search = originalSearch;
  }
});

Deno.test('search tickets - appointment type displays correctly', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-tickets/search');

  // Test different appointment types
  const testCases = [
    { type: 'full_day', expected: 'เต็มวัน' },
    { type: 'half_morning', expected: 'ครึ่งเช้า' },
    { type: 'half_afternoon', expected: 'ครึ่งบ่าย' },
    { type: 'call_to_schedule', expected: 'รอนัดหมาย' },
    { type: 'backlog', expected: 'Backlog' },
  ];

  const ticketServiceModule = await import('../../supabase/functions/api-tickets/services/ticketService.ts');
  const originalSearch = ticketServiceModule.TicketService.search;

  for (const testCase of testCases) {
    const mockItem = createMockTicketDisplayItem({
      appointment: {
        id: '123',
        date: '2026-01-15',
        time_start: null,
        time_end: null,
        type: testCase.type as 'full_day' | 'half_morning' | 'half_afternoon' | 'call_to_schedule' | 'backlog',
        type_display: testCase.expected,
        is_approved: true,
      },
    });
    
    const mockSearchResults = {
      data: [mockItem],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1, hasNext: false, hasPrevious: false },
    };

    ticketServiceModule.TicketService.search = async () => mockSearchResults;

    try {
      const response = await search(request, employee);
      const result = await assertSuccessResponse<{ data: TicketDisplayItem[]; pagination: unknown }>(response);
      
      assertEquals(
        result.data[0].appointment.type_display, 
        testCase.expected,
        `Appointment type ${testCase.type} should display as "${testCase.expected}"`
      );
    } finally {
      // Continue to next test case
    }
  }

  ticketServiceModule.TicketService.search = originalSearch;
});

Deno.test('search tickets - pagination info included', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-tickets/search?page=2&limit=10');

  const mockSearchResults = {
    data: [createMockTicketDisplayItem()],
    pagination: {
      page: 2,
      limit: 10,
      total: 25,
      totalPages: 3,
      hasNext: true,
      hasPrevious: true,
    },
  };

  const ticketServiceModule = await import('../../supabase/functions/api-tickets/services/ticketService.ts');
  const originalSearch = ticketServiceModule.TicketService.search;
  ticketServiceModule.TicketService.search = async () => mockSearchResults;

  try {
    const response = await search(request, employee);
    const result = await assertSuccessResponse<{ data: TicketDisplayItem[]; pagination: unknown }>(response);
    
    const pagination = result.pagination as {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrevious: boolean;
    };
    
    assertEquals(pagination.page, 2);
    assertEquals(pagination.limit, 10);
    assertEquals(pagination.total, 25);
    assertEquals(pagination.totalPages, 3);
    assertEquals(pagination.hasNext, true);
    assertEquals(pagination.hasPrevious, true);
  } finally {
    ticketServiceModule.TicketService.search = originalSearch;
  }
});

Deno.test('search tickets - filters are passed correctly', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest(
    'GET', 
    'http://localhost/api-tickets/search?work_type_id=wt1&status_id=st1&assigner_id=as1&start_date=2026-01-01&end_date=2026-01-31'
  );

  let capturedParams: Record<string, unknown> = {};

  const ticketServiceModule = await import('../../supabase/functions/api-tickets/services/ticketService.ts');
  const originalSearch = ticketServiceModule.TicketService.search;
  ticketServiceModule.TicketService.search = async (params: Record<string, unknown>) => {
    capturedParams = params;
    return {
      data: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0, hasNext: false, hasPrevious: false },
    };
  };

  try {
    await search(request, employee);
    
    assertEquals(capturedParams.work_type_id, 'wt1');
    assertEquals(capturedParams.status_id, 'st1');
    assertEquals(capturedParams.assigner_id, 'as1');
    assertEquals(capturedParams.start_date, '2026-01-01');
    assertEquals(capturedParams.end_date, '2026-01-31');
    assertEquals(capturedParams.include, 'full'); // Default to full
  } finally {
    ticketServiceModule.TicketService.search = originalSearch;
  }
});
