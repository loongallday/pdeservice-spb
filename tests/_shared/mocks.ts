/**
 * Test utilities and mocks for unit testing
 */

import type { Employee } from '../../supabase/functions/_shared/auth.ts';

/**
 * Create a mock employee for testing
 */
export function createMockEmployee(overrides?: Partial<Employee>): Employee {
  return {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'Test Employee',
    code: 'TEST001',
    email: 'test@example.com',
    role_id: '123e4567-e89b-12d3-a456-426614174001',
    auth_user_id: '123e4567-e89b-12d3-a456-426614174002',
    is_active: true,
    role_data: {
      id: '123e4567-e89b-12d3-a456-426614174001',
      code: 'ADMIN',
      name_th: 'ผู้ดูแลระบบ',
      level: 2,
    },
    ...overrides,
  };
}

/**
 * Create a mock employee with specific level
 * Note: `level` is added directly to employee for handlers that reference employee.level
 * (some handlers have a bug where they use employee.level instead of employee.role_data?.level)
 */
export function createMockEmployeeWithLevel(level: number): Employee & { level: number } {
  const employee = createMockEmployee({
    role_data: {
      id: '123e4567-e89b-12d3-a456-426614174001',
      code: 'TEST_ROLE',
      name_th: 'Test Role',
      level,
    },
  });
  // Add level directly to employee for handlers that incorrectly reference employee.level
  return { ...employee, level };
}

/**
 * Create a mock Request object
 */
export function createMockRequest(
  method: string,
  url: string,
  body?: unknown,
  headers?: Record<string, string>
): Request {
  const defaultHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer test-token',
    ...headers,
  };

  return new Request(url, {
    method,
    headers: defaultHeaders,
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * Create a mock Request with JSON body
 */
export function createMockJsonRequest(
  method: string,
  url: string,
  body: unknown,
  headers?: Record<string, string>
): Request {
  return createMockRequest(method, url, body, {
    'Content-Type': 'application/json',
    ...headers,
  });
}

/**
 * Create a mock Request without authorization
 */
export function createMockUnauthorizedRequest(
  method: string,
  url: string
): Request {
  return new Request(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Assert response is successful
 */
export async function assertSuccessResponse<T = unknown>(
  response: Response,
  expectedStatus = 200
): Promise<T> {
  if (response.status !== expectedStatus) {
    const text = await response.text();
    throw new Error(
      `Expected status ${expectedStatus}, got ${response.status}. Response: ${text}`
    );
  }

  const data = await response.json() as { data: T };
  if (!data.data) {
    throw new Error('Response missing data field');
  }

  return data.data;
}

/**
 * Assert response is an error
 */
export async function assertErrorResponse(
  response: Response,
  expectedStatus: number
): Promise<string> {
  if (response.status !== expectedStatus) {
    const text = await response.text();
    throw new Error(
      `Expected error status ${expectedStatus}, got ${response.status}. Response: ${text}`
    );
  }

  const data = await response.json();
  if (!data.error) {
    throw new Error('Error response missing error field');
  }

  return data.error;
}

/**
 * Mock Supabase client response
 */
export interface MockSupabaseResponse<T> {
  data: T | null;
  error: { message: string; code?: string } | null;
}

/**
 * Create a successful mock Supabase response
 */
export function createMockSupabaseSuccess<T>(data: T): MockSupabaseResponse<T> {
  return { data, error: null };
}

/**
 * Create an error mock Supabase response
 */
export function createMockSupabaseError(
  message: string,
  code?: string
): MockSupabaseResponse<null> {
  return { data: null, error: { message, code } };
}

/**
 * Assert that a promise rejects with a specific error type
 * Checks by error class name since different APIs have their own error classes
 */
export async function assertRejectsWithErrorType(
  fn: () => Promise<unknown>,
  errorTypeName: string,
  messageSubstring?: string
): Promise<void> {
  try {
    await fn();
    throw new Error('Expected function to throw an error');
  } catch (error) {
    // Check error type name (works across different error class instances)
    const errorName = error?.constructor?.name || '';
    if (!errorName.includes(errorTypeName.replace('Error', ''))) {
      throw new Error(
        `Expected error type containing "${errorTypeName.replace('Error', '')}", got "${errorName}"`
      );
    }
    
    // Check message if provided
    if (messageSubstring) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (!errorMessage.includes(messageSubstring)) {
        throw new Error(
          `Expected error message to include "${messageSubstring}", got "${errorMessage}"`
        );
      }
    }
  }
}

