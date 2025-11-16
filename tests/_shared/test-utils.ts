/**
 * Test utilities for common test operations
 */

import { assertEquals, assertExists, assertRejects } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import type { Employee } from '../../supabase/functions/_shared/auth.ts';
import { createMockEmployee } from './mocks.ts';

/**
 * Test employee fixtures
 */
export const testEmployees = {
  level0: createMockEmployee({
    role_data: { id: '1', code: 'TECH_L1', name_th: 'Technician L1', level: 0 },
  }),
  level1: createMockEmployee({
    role_data: { id: '2', code: 'ASSIGNER', name_th: 'Assigner', level: 1 },
  }),
  level2: createMockEmployee({
    role_data: { id: '3', code: 'ADMIN', name_th: 'Admin', level: 2 },
  }),
  level3: createMockEmployee({
    role_data: { id: '4', code: 'SUPER_ADMIN', name_th: 'Super Admin', level: 3 },
  }),
};

/**
 * Assert employee has required level
 */
export function assertEmployeeLevel(employee: Employee, minLevel: number): void {
  const level = employee.role_data?.level ?? 0;
  assertEquals(
    level >= minLevel,
    true,
    `Employee level ${level} should be >= ${minLevel}`
  );
}

/**
 * Assert response contains pagination
 */
export async function assertPagination(response: Response): Promise<void> {
  const data = await response.json();
  assertExists(data.data.pagination, 'Response should contain pagination');
  assertExists(data.data.pagination.page, 'Pagination should have page');
  assertExists(data.data.pagination.limit, 'Pagination should have limit');
  assertExists(data.data.pagination.total, 'Pagination should have total');
}

/**
 * Assert response is array
 */
export async function assertArrayResponse(response: Response): Promise<unknown[]> {
  const data = await response.json();
  assertEquals(Array.isArray(data.data), true, 'Response should be an array');
  return data.data as unknown[];
}

/**
 * Assert response is object
 */
export async function assertObjectResponse(response: Response): Promise<Record<string, unknown>> {
  const data = await response.json();
  assertEquals(typeof data.data, 'object', 'Response should be an object');
  assertEquals(Array.isArray(data.data), false, 'Response should not be an array');
  return data.data as Record<string, unknown>;
}

/**
 * Test authorization levels
 */
export async function testAuthorizationLevels(
  handler: (req: Request, employee: Employee) => Promise<Response>,
  request: Request,
  requiredLevel: number
): Promise<void> {
  // Test with insufficient level
  if (requiredLevel > 0) {
    const lowLevelEmployee = testEmployees.level0;
    if (requiredLevel > 0) {
      await assertRejects(
        async () => await handler(request, lowLevelEmployee),
        Error,
        'Should reject employee with level 0'
      );
    }
  }

  // Test with sufficient level
  const sufficientEmployee = testEmployees[`level${requiredLevel}` as keyof typeof testEmployees] || testEmployees.level3;
  const response = await handler(request, sufficientEmployee);
  assertEquals(response.status < 400, true, 'Should allow employee with sufficient level');
}

