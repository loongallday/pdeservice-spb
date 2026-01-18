# Run E2E Tests

Run end-to-end tests with automatic setup and HTML report generation.

## Usage
```
/e2e [pattern]
```

## Examples
```
/e2e                     # Run all E2E tests
/e2e tickets             # Run tests matching "tickets"
/e2e employees           # Run tests matching "employees"
/e2e companies           # Run tests matching "companies"
```

## What It Does

The automated script (`./scripts/run-e2e-tests.sh`):

1. **Check Supabase** - Starts if not running
2. **Reset Database** - `supabase db reset --no-seed`
3. **Seed Reference Data** - Work types, statuses, leave types
4. **Seed Location Data** - Thai provinces, districts, subdistricts
5. **Seed Test Data** - Employees, companies, sites, tickets
6. **Create Auth Users** - Test users in Supabase Auth
7. **Start Functions** - `supabase functions serve --no-verify-jwt`
8. **Run Tests** - `deno test tests/e2e/`
9. **Generate Report** - HTML report at `coverage/e2e-report.html`
10. **Open Report** - Auto-opens in browser (macOS)
11. **Cleanup** - Stops functions server

## Command
```bash
./scripts/run-e2e-tests.sh [pattern]
```

## Test Files

```
tests/e2e/
├── setup.ts                          # Auth user setup
├── test-utils.ts                     # API helpers
├── api-tickets.test.ts               # Ticket tests
├── api-employees.test.ts             # Employee tests
├── api-companies.test.ts             # Company tests
├── api-sites.test.ts                 # Site tests
├── api-appointments.test.ts          # Appointment tests
├── api-contacts.test.ts              # Contact tests
├── ...                               # More API tests
├── security-tests.test.ts            # Security tests
├── authorization-boundary-tests.test.ts
├── data-consistency-tests.test.ts
└── edge-case-tests.test.ts
```

## Test Utilities

```typescript
import {
  apiGet,           // GET request with auth
  apiPost,          // POST request with auth
  apiPut,           // PUT request with auth
  apiDelete,        // DELETE request with auth
  assertSuccess,    // Assert 200 and return data
  assertError,      // Assert error status
  TEST_EMPLOYEES,   // Test employee IDs
  TEST_COMPANIES,   // Test company IDs
  TEST_SITES,       // Test site IDs
  TEST_TICKETS,     // Test ticket IDs
} from './test-utils.ts';
```

## Test Users

| Email | Role | Level |
|-------|------|-------|
| admin@pdeservice.com | Superadmin | 3 |
| admin2@pdeservice.com | Admin | 2 |
| assigner@pdeservice.com | Assigner | 1 |
| tech1@pdeservice.com | Technician | 0 |
| sales1@pdeservice.com | Sales | 1 |
| pm1@pdeservice.com | PM | 1 |

Password for all: `test123456`

## Report

After running, view the HTML report:
```bash
open coverage/e2e-report.html
```

The report shows:
- Overall pass/fail status
- Total, passed, failed counts
- Duration
- Pass rate with progress bar
- Results grouped by test file
- Error details for failures

## Prerequisites

- Docker Desktop running
- Supabase CLI installed
- `psql` command available
- Deno installed
