/**
 * E2E Test Utilities
 * Provides helpers for making authenticated API calls to local Supabase functions
 */

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

const BASE_URL = 'http://localhost:54321/functions/v1';
const SUPABASE_URL = 'http://localhost:54321';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

// Test employee IDs from seed data
export const TEST_EMPLOYEES = {
  superAdmin: '00000000-0000-0000-0000-000000000001',
  admin: '00000000-0000-0000-0000-000000000002',
  assigner: '00000000-0000-0000-0000-000000000003',
  tech1: '00000000-0000-0000-0000-000000000004',
  tech2: '00000000-0000-0000-0000-000000000005',
  tech3: '00000000-0000-0000-0000-000000000006',
  sales1: '00000000-0000-0000-0000-000000000007',
  pm1: '00000000-0000-0000-0000-000000000008',
  rma1: '00000000-0000-0000-0000-000000000009',
  stock: '00000000-0000-0000-0000-000000000010',
};

// Test company IDs from seed data
export const TEST_COMPANIES = {
  testCompany: '10000000-0000-0000-0000-000000000001',
  abcCorp: '10000000-0000-0000-0000-000000000002',
  thaiTech: '10000000-0000-0000-0000-000000000003',
  bangkokElectronics: '10000000-0000-0000-0000-000000000004',
  siamPower: '10000000-0000-0000-0000-000000000005',
};

// Test site IDs from seed data
export const TEST_SITES = {
  testCompanyHQ: '20000000-0000-0000-0000-000000000001',
  testCompanyBranch1: '20000000-0000-0000-0000-000000000002',
  abcCorpMain: '20000000-0000-0000-0000-000000000003',
  abcCorpWarehouse: '20000000-0000-0000-0000-000000000004',
  thaiTechOffice: '20000000-0000-0000-0000-000000000005',
  bangkokElectronicsFactory: '20000000-0000-0000-0000-000000000006',
  siamPowerHQ: '20000000-0000-0000-0000-000000000007',
  siamPowerServiceCenter: '20000000-0000-0000-0000-000000000008',
};

// Test ticket IDs from seed data
export const TEST_TICKETS = {
  pm1: '60000000-0000-0000-0000-000000000001',
  pm2: '60000000-0000-0000-0000-000000000002',
  rma: '60000000-0000-0000-0000-000000000003',
  sales: '60000000-0000-0000-0000-000000000004',
  survey: '60000000-0000-0000-0000-000000000005',
};

// Test appointment IDs from seed data
export const TEST_APPOINTMENTS = {
  appt1: '50000000-0000-0000-0000-000000000001',
  appt2: '50000000-0000-0000-0000-000000000002',
  appt3: '50000000-0000-0000-0000-000000000003',
  appt4: '50000000-0000-0000-0000-000000000004',
  appt5: '50000000-0000-0000-0000-000000000005',
};

// Reference data IDs
export const REF_DATA = {
  workTypes: {
    pm: 'f1093c78-0680-4181-8284-dc07ab7ba38a',
    rma: 'f243515b-ef8b-484b-8399-988d54fd122f',
    sales: '7b2a377b-fe11-478b-9a08-e8e9822d027b',
    survey: '7a08defc-63e0-4461-b6c4-1dbc34f218d3',
  },
  statuses: {
    normal: '36491478-9c1f-4635-90e2-a293968314df',
    urgent: '6798860c-4555-456a-a995-d89522b8982b',
  },
};

// Email to employee ID mapping
const EMAIL_TO_EMPLOYEE: Record<string, string> = {
  'admin@pdeservice.com': TEST_EMPLOYEES.superAdmin,
  'admin2@pdeservice.com': TEST_EMPLOYEES.admin,
  'assigner@pdeservice.com': TEST_EMPLOYEES.assigner,
  'tech1@pdeservice.com': TEST_EMPLOYEES.tech1,
  'tech2@pdeservice.com': TEST_EMPLOYEES.tech2,
  'tech3@pdeservice.com': TEST_EMPLOYEES.tech3,
  'sales1@pdeservice.com': TEST_EMPLOYEES.sales1,
  'pm1@pdeservice.com': TEST_EMPLOYEES.pm1,
  'rma1@pdeservice.com': TEST_EMPLOYEES.rma1,
  'stock@pdeservice.com': TEST_EMPLOYEES.stock,
};

// Cache for access tokens
const tokenCache: Map<string, string> = new Map();

// Service role client for admin operations
let serviceClient: SupabaseClient | null = null;

/**
 * Get service role Supabase client
 */
export function getServiceClient(): SupabaseClient {
  if (!serviceClient) {
    serviceClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return serviceClient;
}

/**
 * Setup test auth users - ensures employees are active
 * Note: Auth users are created via SQL seed script (supabase/seeds/20260118080003_seed_auth_users.sql)
 * This function just ensures the employees are active for tests
 */
export async function setupTestUsers(): Promise<void> {
  const supabase = getServiceClient();

  const employeeIds = [
    TEST_EMPLOYEES.superAdmin,
    TEST_EMPLOYEES.admin,
    TEST_EMPLOYEES.assigner,
    TEST_EMPLOYEES.tech1,
    TEST_EMPLOYEES.tech2,
    TEST_EMPLOYEES.tech3,
    TEST_EMPLOYEES.sales1,
    TEST_EMPLOYEES.pm1,
    TEST_EMPLOYEES.rma1,
    TEST_EMPLOYEES.stock,
  ];

  // Ensure all test employees are active (auth users created via SQL seed)
  const { error: activateError } = await supabase
    .from('main_employees')
    .update({ is_active: true })
    .in('id', employeeIds);

  if (activateError) {
    console.error('Failed to activate test employees:', activateError.message);
  }
}

/**
 * Get access token for an employee
 */
export async function getAccessToken(employeeId: string): Promise<string> {
  // Check cache first
  if (tokenCache.has(employeeId)) {
    return tokenCache.get(employeeId)!;
  }

  // Find email for this employee
  const email = Object.entries(EMAIL_TO_EMPLOYEE).find(([_, id]) => id === employeeId)?.[0];

  if (!email) {
    throw new Error(`No email mapping for employee ${employeeId}`);
  }

  const supabase = getServiceClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: 'test123456',
  });

  if (error || !data.session) {
    throw new Error(`Failed to sign in as ${email}: ${error?.message}`);
  }

  tokenCache.set(employeeId, data.session.access_token);
  return data.session.access_token;
}

/**
 * Create authenticated headers for API calls
 */
export async function createHeaders(employeeId: string): Promise<HeadersInit> {
  const accessToken = await getAccessToken(employeeId);

  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`,
    'apikey': ANON_KEY,
  };
}

/**
 * Make a GET request to an API endpoint
 */
export async function apiGet(
  endpoint: string,
  employeeId: string = TEST_EMPLOYEES.superAdmin
): Promise<Response> {
  const url = `${BASE_URL}/${endpoint}`;
  const headers = await createHeaders(employeeId);
  return fetch(url, {
    method: 'GET',
    headers,
  });
}

/**
 * Make a POST request to an API endpoint
 */
export async function apiPost(
  endpoint: string,
  body: unknown,
  employeeId: string = TEST_EMPLOYEES.superAdmin
): Promise<Response> {
  const url = `${BASE_URL}/${endpoint}`;
  const headers = await createHeaders(employeeId);
  return fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

/**
 * Make a PUT request to an API endpoint
 */
export async function apiPut(
  endpoint: string,
  body: unknown,
  employeeId: string = TEST_EMPLOYEES.superAdmin
): Promise<Response> {
  const url = `${BASE_URL}/${endpoint}`;
  const headers = await createHeaders(employeeId);
  return fetch(url, {
    method: 'PUT',
    headers,
    body: JSON.stringify(body),
  });
}

/**
 * Make a DELETE request to an API endpoint
 */
export async function apiDelete(
  endpoint: string,
  employeeId: string = TEST_EMPLOYEES.superAdmin
): Promise<Response> {
  const url = `${BASE_URL}/${endpoint}`;
  const headers = await createHeaders(employeeId);
  return fetch(url, {
    method: 'DELETE',
    headers,
  });
}

/**
 * Assert response is successful and return data
 */
export async function assertSuccess<T = unknown>(
  response: Response,
  expectedStatus = 200
): Promise<T> {
  if (response.status !== expectedStatus) {
    const text = await response.text();
    throw new Error(
      `Expected status ${expectedStatus}, got ${response.status}. Response: ${text}`
    );
  }

  const json = await response.json();
  return json.data as T;
}

/**
 * Assert response is an error
 */
export async function assertError(
  response: Response,
  expectedStatus: number
): Promise<string> {
  if (response.status !== expectedStatus) {
    const text = await response.text();
    throw new Error(
      `Expected error status ${expectedStatus}, got ${response.status}. Response: ${text}`
    );
  }

  const json = await response.json();
  return json.error as string;
}

/**
 * Generate a random UUID for testing
 */
export function randomUUID(): string {
  return crypto.randomUUID();
}

/**
 * Wait for a specified number of milliseconds
 */
export function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Clean up test data created during tests
 */
export async function cleanupTestData(): Promise<void> {
  const supabase = getServiceClient();

  // Delete test tickets created during tests (those with IDs starting with 'e2e-')
  // For now, we'll rely on db reset between test runs
}
