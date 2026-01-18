/**
 * Unit tests for Analytics API handlers
 * Tests validation logic and permission checks
 */

import { assertEquals, assertRejects } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { getUtilization, getUtilizationSummary } from '../../supabase/functions/api-analytics/handlers/utilization.ts';
import { getWorkload, getWorkloadDistribution } from '../../supabase/functions/api-analytics/handlers/workload.ts';
import { getTrends } from '../../supabase/functions/api-analytics/handlers/trends.ts';
import { getTechnicianDetail } from '../../supabase/functions/api-analytics/handlers/technicianDetail.ts';
import { createMockRequest, createMockEmployeeWithLevel, assertSuccessResponse } from '../_shared/mocks.ts';

const mockUtilization = {
  technicians: [
    {
      id: '123e4567-e89b-12d3-a456-426614174000',
      name: 'Test Technician',
      utilization_rate: 0.75,
      total_hours: 8,
      assigned_hours: 6,
    },
  ],
  summary: {
    average_utilization: 0.75,
    total_technicians: 1,
  },
};

const mockWorkload = {
  technicians: [
    {
      id: '123e4567-e89b-12d3-a456-426614174000',
      name: 'Test Technician',
      ticket_count: 5,
      appointment_count: 8,
    },
  ],
  summary: {
    total_tickets: 5,
    total_appointments: 8,
  },
};

const mockTrends = {
  data: [
    { date: '2025-01-01', utilization: 0.75, tickets: 10 },
    { date: '2025-01-02', utilization: 0.80, tickets: 12 },
  ],
  interval: 'daily',
};

const mockTechnicianDetail = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  name: 'Test Technician',
  utilization_rate: 0.75,
  daily_stats: [],
};

// ============ Handler Existence Tests ============

Deno.test('getUtilization handler exists', () => {
  assertEquals(typeof getUtilization, 'function');
});

Deno.test('getUtilizationSummary handler exists', () => {
  assertEquals(typeof getUtilizationSummary, 'function');
});

Deno.test('getWorkload handler exists', () => {
  assertEquals(typeof getWorkload, 'function');
});

Deno.test('getWorkloadDistribution handler exists', () => {
  assertEquals(typeof getWorkloadDistribution, 'function');
});

Deno.test('getTrends handler exists', () => {
  assertEquals(typeof getTrends, 'function');
});

Deno.test('getTechnicianDetail handler exists', () => {
  assertEquals(typeof getTechnicianDetail, 'function');
});

// ============ Utilization Validation Tests ============

Deno.test('getUtilization - missing date throws error', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-analytics/technicians/utilization');

  await assertRejects(
    async () => await getUtilization(request, employee),
    Error,
    'วันที่'
  );
});

Deno.test('getUtilization - invalid date format throws error', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-analytics/technicians/utilization?date=invalid');

  await assertRejects(
    async () => await getUtilization(request, employee),
    Error,
    'รูปแบบ'
  );
});

Deno.test('getUtilizationSummary - missing dates throws error', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-analytics/technicians/utilization/summary');

  await assertRejects(
    async () => await getUtilizationSummary(request, employee),
    Error,
    'start_date'
  );
});

Deno.test('getUtilizationSummary - invalid date format throws error', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-analytics/technicians/utilization/summary?start_date=invalid&end_date=2025-01-31');

  await assertRejects(
    async () => await getUtilizationSummary(request, employee),
    Error,
    'รูปแบบ'
  );
});

Deno.test('getUtilizationSummary - start_date after end_date throws error', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-analytics/technicians/utilization/summary?start_date=2025-01-31&end_date=2025-01-01');

  await assertRejects(
    async () => await getUtilizationSummary(request, employee),
    Error,
    'start_date'
  );
});

Deno.test('getUtilizationSummary - range over 90 days throws error', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-analytics/technicians/utilization/summary?start_date=2025-01-01&end_date=2025-06-01');

  await assertRejects(
    async () => await getUtilizationSummary(request, employee),
    Error,
    '90'
  );
});

// ============ Workload Validation Tests ============

Deno.test('getWorkload - missing date throws error', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-analytics/technicians/workload');

  await assertRejects(
    async () => await getWorkload(request, employee),
    Error,
    'วันที่'
  );
});

Deno.test('getWorkload - invalid date format throws error', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-analytics/technicians/workload?date=01-01-2025');

  await assertRejects(
    async () => await getWorkload(request, employee),
    Error,
    'รูปแบบ'
  );
});

Deno.test('getWorkloadDistribution - missing dates throws error', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-analytics/technicians/workload/distribution');

  await assertRejects(
    async () => await getWorkloadDistribution(request, employee),
    Error,
    'start_date'
  );
});

Deno.test('getWorkloadDistribution - invalid date format throws error', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-analytics/technicians/workload/distribution?start_date=2025-01-01&end_date=invalid');

  await assertRejects(
    async () => await getWorkloadDistribution(request, employee),
    Error,
    'รูปแบบ'
  );
});

Deno.test('getWorkloadDistribution - start_date after end_date throws error', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-analytics/technicians/workload/distribution?start_date=2025-02-01&end_date=2025-01-01');

  await assertRejects(
    async () => await getWorkloadDistribution(request, employee),
    Error,
    'start_date'
  );
});

Deno.test('getWorkloadDistribution - range over 90 days throws error', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-analytics/technicians/workload/distribution?start_date=2025-01-01&end_date=2025-06-01');

  await assertRejects(
    async () => await getWorkloadDistribution(request, employee),
    Error,
    '90'
  );
});

// ============ Trends Validation Tests ============

Deno.test('getTrends - missing dates throws error', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-analytics/technicians/trends');

  await assertRejects(
    async () => await getTrends(request, employee),
    Error,
    'start_date'
  );
});

Deno.test('getTrends - invalid date format throws error', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-analytics/technicians/trends?start_date=invalid&end_date=2025-01-31');

  await assertRejects(
    async () => await getTrends(request, employee),
    Error,
    'รูปแบบ'
  );
});

Deno.test('getTrends - start_date after end_date throws error', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-analytics/technicians/trends?start_date=2025-01-31&end_date=2025-01-01');

  await assertRejects(
    async () => await getTrends(request, employee),
    Error,
    'start_date'
  );
});

Deno.test('getTrends - invalid interval throws error', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-analytics/technicians/trends?start_date=2025-01-01&end_date=2025-01-31&interval=monthly');

  await assertRejects(
    async () => await getTrends(request, employee),
    Error,
    'interval'
  );
});

Deno.test('getTrends - daily interval over 90 days throws error', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-analytics/technicians/trends?start_date=2025-01-01&end_date=2025-06-01&interval=daily');

  await assertRejects(
    async () => await getTrends(request, employee),
    Error,
    '90'
  );
});

Deno.test('getTrends - weekly interval over 365 days throws error', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-analytics/technicians/trends?start_date=2024-01-01&end_date=2025-06-01&interval=weekly');

  await assertRejects(
    async () => await getTrends(request, employee),
    Error,
    '365'
  );
});

// ============ Technician Detail Validation Tests ============

Deno.test('getTechnicianDetail - invalid UUID throws error', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-analytics/technicians/invalid-uuid?start_date=2025-01-01&end_date=2025-01-31');

  await assertRejects(
    async () => await getTechnicianDetail(request, employee, 'invalid-uuid'),
    Error,
    'รหัสพนักงาน'
  );
});

Deno.test('getTechnicianDetail - missing dates throws error', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-analytics/technicians/123e4567-e89b-12d3-a456-426614174000');

  await assertRejects(
    async () => await getTechnicianDetail(request, employee, '123e4567-e89b-12d3-a456-426614174000'),
    Error,
    'start_date'
  );
});

Deno.test('getTechnicianDetail - invalid date format throws error', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-analytics/technicians/123e4567-e89b-12d3-a456-426614174000?start_date=invalid&end_date=2025-01-31');

  await assertRejects(
    async () => await getTechnicianDetail(request, employee, '123e4567-e89b-12d3-a456-426614174000'),
    Error,
    'รูปแบบ'
  );
});

Deno.test('getTechnicianDetail - start_date after end_date throws error', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-analytics/technicians/123e4567-e89b-12d3-a456-426614174000?start_date=2025-01-31&end_date=2025-01-01');

  await assertRejects(
    async () => await getTechnicianDetail(request, employee, '123e4567-e89b-12d3-a456-426614174000'),
    Error,
    'start_date'
  );
});

Deno.test('getTechnicianDetail - range over 90 days throws error', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-analytics/technicians/123e4567-e89b-12d3-a456-426614174000?start_date=2025-01-01&end_date=2025-06-01');

  await assertRejects(
    async () => await getTechnicianDetail(request, employee, '123e4567-e89b-12d3-a456-426614174000'),
    Error,
    '90'
  );
});

// ============ Mocked Success Tests ============

Deno.test('getUtilization - success with mocking', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-analytics/technicians/utilization?date=2025-01-01');

  const module = await import('../../supabase/functions/api-analytics/services/technicianUtilizationService.ts');
  const originalGetUtilizationForDate = module.TechnicianUtilizationService.getUtilizationForDate;
  module.TechnicianUtilizationService.getUtilizationForDate = async () => mockUtilization;

  try {
    const response = await getUtilization(request, employee);
    assertEquals(response.status, 200);
    const json = await response.json();
    assertEquals(Array.isArray(json.data.technicians), true);
  } finally {
    module.TechnicianUtilizationService.getUtilizationForDate = originalGetUtilizationForDate;
  }
});

Deno.test('getUtilizationSummary - success with mocking', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-analytics/technicians/utilization/summary?start_date=2025-01-01&end_date=2025-01-31');

  const module = await import('../../supabase/functions/api-analytics/services/technicianUtilizationService.ts');
  const originalGetUtilizationSummary = module.TechnicianUtilizationService.getUtilizationSummary;
  module.TechnicianUtilizationService.getUtilizationSummary = async () => mockUtilization.summary;

  try {
    const response = await getUtilizationSummary(request, employee);
    assertEquals(response.status, 200);
  } finally {
    module.TechnicianUtilizationService.getUtilizationSummary = originalGetUtilizationSummary;
  }
});

Deno.test('getWorkload - success with mocking', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-analytics/technicians/workload?date=2025-01-01');

  const module = await import('../../supabase/functions/api-analytics/services/workloadAnalyticsService.ts');
  const originalGetWorkloadForDate = module.WorkloadAnalyticsService.getWorkloadForDate;
  module.WorkloadAnalyticsService.getWorkloadForDate = async () => mockWorkload;

  try {
    const response = await getWorkload(request, employee);
    assertEquals(response.status, 200);
    const json = await response.json();
    assertEquals(Array.isArray(json.data.technicians), true);
  } finally {
    module.WorkloadAnalyticsService.getWorkloadForDate = originalGetWorkloadForDate;
  }
});

Deno.test('getWorkloadDistribution - success with mocking', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-analytics/technicians/workload/distribution?start_date=2025-01-01&end_date=2025-01-31');

  const module = await import('../../supabase/functions/api-analytics/services/workloadAnalyticsService.ts');
  const originalGetWorkloadDistribution = module.WorkloadAnalyticsService.getWorkloadDistribution;
  module.WorkloadAnalyticsService.getWorkloadDistribution = async () => mockWorkload;

  try {
    const response = await getWorkloadDistribution(request, employee);
    assertEquals(response.status, 200);
  } finally {
    module.WorkloadAnalyticsService.getWorkloadDistribution = originalGetWorkloadDistribution;
  }
});

Deno.test('getTrends - success with daily interval', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-analytics/technicians/trends?start_date=2025-01-01&end_date=2025-01-31&interval=daily');

  const module = await import('../../supabase/functions/api-analytics/services/trendAnalyticsService.ts');
  const originalGetTrends = module.TrendAnalyticsService.getTrends;
  module.TrendAnalyticsService.getTrends = async () => mockTrends;

  try {
    const response = await getTrends(request, employee);
    assertEquals(response.status, 200);
    const json = await response.json();
    assertEquals(Array.isArray(json.data.data), true);
  } finally {
    module.TrendAnalyticsService.getTrends = originalGetTrends;
  }
});

Deno.test('getTrends - success with weekly interval', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', 'http://localhost/api-analytics/technicians/trends?start_date=2025-01-01&end_date=2025-03-31&interval=weekly');

  const module = await import('../../supabase/functions/api-analytics/services/trendAnalyticsService.ts');
  const originalGetTrends = module.TrendAnalyticsService.getTrends;
  module.TrendAnalyticsService.getTrends = async () => ({ ...mockTrends, interval: 'weekly' });

  try {
    const response = await getTrends(request, employee);
    assertEquals(response.status, 200);
  } finally {
    module.TrendAnalyticsService.getTrends = originalGetTrends;
  }
});

Deno.test('getTechnicianDetail - success with mocking', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const technicianId = '123e4567-e89b-12d3-a456-426614174000';
  const request = createMockRequest('GET', `http://localhost/api-analytics/technicians/${technicianId}?start_date=2025-01-01&end_date=2025-01-31`);

  const module = await import('../../supabase/functions/api-analytics/services/trendAnalyticsService.ts');
  const originalGetTechnicianDetail = module.TrendAnalyticsService.getTechnicianDetail;
  module.TrendAnalyticsService.getTechnicianDetail = async () => mockTechnicianDetail;

  try {
    const response = await getTechnicianDetail(request, employee, technicianId);
    assertEquals(response.status, 200);
    const json = await response.json();
    assertEquals(json.data.id, technicianId);
  } finally {
    module.TrendAnalyticsService.getTechnicianDetail = originalGetTechnicianDetail;
  }
});

