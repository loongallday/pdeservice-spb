/**
 * Unit tests for Reports API handlers
 * Tests validation logic only (Excel generation requires database)
 */

import { assertEquals, assertRejects } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { getDailyReport } from '../../supabase/functions/api-reports/handlers/daily.ts';
import { getRmaExcel } from '../../supabase/functions/api-reports/handlers/rmaExcel.ts';
import { getPmExcel, getSalesExcel } from '../../supabase/functions/api-reports/handlers/workTypeExcel.ts';
import { createMockRequest, createMockEmployeeWithLevel } from '../_shared/mocks.ts';

const mockDailyReport = {
  date: '2025-01-01',
  summary: {
    total_tickets: 50,
    completed_tickets: 30,
    pending_tickets: 20,
  },
};

// ============ Handler Existence Tests ============

Deno.test('getDailyReport handler exists', () => {
  assertEquals(typeof getDailyReport, 'function');
});

Deno.test('getRmaExcel handler exists', () => {
  assertEquals(typeof getRmaExcel, 'function');
});

Deno.test('getPmExcel handler exists', () => {
  assertEquals(typeof getPmExcel, 'function');
});

Deno.test('getSalesExcel handler exists', () => {
  assertEquals(typeof getSalesExcel, 'function');
});

// ============ Validation Tests ============

Deno.test('getDailyReport - missing date throws error', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-reports/daily');

  await assertRejects(
    async () => await getDailyReport(request, employee),
    Error,
    'กรุณาระบุวันที่'
  );
});

Deno.test('getDailyReport - invalid date format throws error', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-reports/daily?date=invalid');

  await assertRejects(
    async () => await getDailyReport(request, employee),
    Error,
    'รูปแบบ'
  );
});

Deno.test('getWorkTypeExcel - missing start_date throws error', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-reports/rma/excel?end_date=2025-01-31');

  await assertRejects(
    async () => await getRmaExcel(request, employee),
    Error,
    'start_date'
  );
});

Deno.test('getWorkTypeExcel - missing end_date throws error', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-reports/rma/excel?start_date=2025-01-01');

  await assertRejects(
    async () => await getRmaExcel(request, employee),
    Error,
    'end_date'
  );
});

Deno.test('getWorkTypeExcel - date range too large throws error', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-reports/rma/excel?start_date=2025-01-01&end_date=2025-03-01');

  await assertRejects(
    async () => await getRmaExcel(request, employee),
    Error,
    '31'
  );
});

// ============ Mocked Success Tests ============

Deno.test('getDailyReport - success with mocking', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-reports/daily?date=2025-01-01');

  const module = await import('../../supabase/functions/api-reports/services/dailyReportService.ts');
  const originalGenerateReport = module.DailyReportService.generateReport;
  module.DailyReportService.generateReport = async () => mockDailyReport;

  try {
    const response = await getDailyReport(request, employee);
    assertEquals(response.status, 200);
  } finally {
    module.DailyReportService.generateReport = originalGenerateReport;
  }
});

