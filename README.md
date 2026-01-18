# pdeservice-spb

A service project.

## Getting Started

This project is currently under development.

## Prerequisites

- **Docker Desktop** - Required only for local Supabase development
  - Download and install from: https://docs.docker.com/desktop/install/windows-install/
  - Make sure Docker Desktop is running before starting local development
  - **NOT needed for deploying functions to remote**

- **Node.js** (v18 or higher) - For running Supabase CLI

## Installation

1. **Install Docker Desktop** (if not already installed):
   - Download from: https://docs.docker.com/desktop/install/windows-install/
   - Install and start Docker Desktop
   - Wait for Docker Desktop to fully start (whale icon in system tray)

2. **Install Supabase CLI** (if not already installed):
   ```bash
   npm install -g supabase
   ```

3. **Start Supabase locally**:
   ```bash
   npx supabase start
   ```

   **Note**: If you encounter permission errors, try running PowerShell as Administrator.

## Usage

### Local Development

**Start local Supabase:**
```bash
supabase start
```

Once Supabase is running locally, you can access:
- **Supabase Studio**: http://localhost:54323
- **API URL**: http://localhost:54321
- **Database**: localhost:54322

**Testing functions locally:**
Each function has its own `deno.json` file for proper dependency management and linting. Your VS Code is already configured to use Deno for the functions directory.

To test a function locally:
```bash
supabase functions serve <function-name>
```

Or serve all functions:
```bash
supabase functions serve
```

**Stop local Supabase:**
```bash
supabase stop
```

### Deploying Functions to Remote

Deploy a single function (clean, no warnings):
```bash
supabase functions deploy <function-name> --no-verify-jwt --use-api
```

Deploy all functions:
```bash
supabase functions deploy --no-verify-jwt --use-api
```

**Why `--use-api`?**
- Uses the Management API to bundle functions remotely
- Eliminates all local bundling warnings
- No Docker required for deployment
- Faster and cleaner deployment process

**Each function includes:**
- `deno.json` - Deno configuration for dependencies and compiler options
- Proper TypeScript types and linting
- Isolated dependency management

## Testing

This project has two types of tests:
- **Unit tests** - Fast tests with mocks, no database required
- **E2E tests** - Full integration tests against local Supabase with test data

### Running Unit Tests

Unit tests use mocks and don't require a running database.

**Run all unit tests:**
```bash
deno test tests/ --allow-all --no-lock --no-check
```

**Run tests for specific API:**
```bash
deno test tests/api-appointments/ --allow-all --no-lock --no-check
```

**Run tests in watch mode:**
```bash
deno test tests/ --allow-all --no-lock --no-check --watch
```

**Run tests with coverage:**
```bash
deno test tests/ --allow-all --no-lock --no-check --coverage=coverage/
deno coverage coverage/
```

### Running E2E Tests

E2E tests run against a local Supabase instance with real test data.

#### Prerequisites

- **Docker Desktop** - Must be running before starting Supabase
- **Supabase CLI** - Install with `npm install -g supabase`
- **PostgreSQL client** - `psql` command (comes with PostgreSQL or can install standalone)
- **Deno** - Install from https://deno.land

#### First-Time Setup (Fresh Environment)

If this is your first time or you want a completely fresh start:

```bash
# 1. Ensure Docker Desktop is running
docker info  # Should show Docker version

# 2. Stop any existing Supabase instance
supabase stop

# 3. Start fresh Supabase (downloads images on first run)
supabase start

# 4. Wait for all services to be ready (check output for URLs)
# You should see:
#   API URL: http://localhost:54321
#   DB URL: postgresql://postgres:postgres@localhost:54322/postgres
#   Studio URL: http://localhost:54323
```

#### Option 1: Automated Script (Recommended)

The easiest way to run E2E tests is using the automated script:

```bash
# Make script executable (first time only)
chmod +x scripts/run-e2e-tests.sh

# Run all E2E tests
./scripts/run-e2e-tests.sh

# Run specific test file (by pattern)
./scripts/run-e2e-tests.sh tickets     # Runs tests/e2e/*tickets*.test.ts
./scripts/run-e2e-tests.sh employees   # Runs tests/e2e/*employees*.test.ts
./scripts/run-e2e-tests.sh companies   # Runs tests/e2e/*companies*.test.ts
```

The script automatically:
1. Checks if Supabase is running (starts if not)
2. Resets database to clean state
3. Seeds reference data (work types, statuses, leave types)
4. Seeds location data (provinces, districts)
5. Seeds test data (employees, companies, sites, tickets)
6. Creates test auth users in Supabase Auth
7. Starts the Edge Functions server
8. Runs the E2E tests
9. **Generates HTML report** at `coverage/e2e-report.html`
10. Opens the report in browser (macOS)
11. Cleans up on exit

**HTML Report includes:**
- Overall pass/fail status
- Total tests, passed, failed counts
- Test duration
- Pass rate with progress bar
- Results grouped by test file (expandable)
- Error details for failed tests

#### Option 2: Manual Setup (Step-by-Step)

If you prefer to set up manually or need to debug issues:

**Step 1: Start Supabase**
```bash
# Start all Supabase services
supabase start

# Verify it's running
supabase status
```

**Step 2: Reset database and apply migrations**
```bash
# Reset database (applies all migrations from supabase/migrations/)
supabase db reset --no-seed
```

**Step 3: Seed the database (in order)**
```bash
# 1. Reference data (work types, statuses, leave types, etc.)
psql postgresql://postgres:postgres@localhost:54322/postgres \
  -f supabase/seeds/20260118080000_seed_reference_data.sql

# 2. Location data (Thai provinces, districts, subdistricts)
psql postgresql://postgres:postgres@localhost:54322/postgres \
  -f supabase/seeds/20260118080001_seed_location_data.sql

# 3. Test data (employees, companies, sites, tickets, appointments)
psql postgresql://postgres:postgres@localhost:54322/postgres \
  -f supabase/seeds/20260118080002_seed_test_data.sql

# 4. Auth users (creates users in auth.users and links to employees)
psql postgresql://postgres:postgres@localhost:54322/postgres \
  -f supabase/seeds/20260118080003_seed_auth_users.sql
```

**Step 4: Start Edge Functions server**
```bash
# In a terminal (keep running)
supabase functions serve --no-verify-jwt
```

**Step 5: Run E2E tests** (in a new terminal)
```bash
# Run all E2E tests
deno test tests/e2e/ --allow-all --unstable-temporal

# Run specific test file
deno test tests/e2e/api-tickets.test.ts --allow-all --unstable-temporal

# Run with verbose output
deno test tests/e2e/ --allow-all --unstable-temporal -- --reporter=verbose
```

#### Verifying Setup

After setup, verify everything is working:

```bash
# 1. Check Supabase services are running
supabase status

# 2. Check database has test data
psql postgresql://postgres:postgres@localhost:54322/postgres \
  -c "SELECT COUNT(*) FROM main_employees;"
# Should return 10

# 3. Check auth users exist
psql postgresql://postgres:postgres@localhost:54322/postgres \
  -c "SELECT email FROM auth.users ORDER BY email;"
# Should list test users (admin@pdeservice.com, etc.)

# 4. Test API endpoint (requires functions server running)
curl http://localhost:54321/functions/v1/api-reference-data/work-types \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"
# Should return JSON with work types
```

#### Resetting Between Test Runs

If tests modified data and you need a fresh state:

```bash
# Quick reset (keeps Supabase running)
supabase db reset --no-seed && \
psql postgresql://postgres:postgres@localhost:54322/postgres -f supabase/seeds/20260118080000_seed_reference_data.sql && \
psql postgresql://postgres:postgres@localhost:54322/postgres -f supabase/seeds/20260118080001_seed_location_data.sql && \
psql postgresql://postgres:postgres@localhost:54322/postgres -f supabase/seeds/20260118080002_seed_test_data.sql && \
psql postgresql://postgres:postgres@localhost:54322/postgres -f supabase/seeds/20260118080003_seed_auth_users.sql
```

#### Viewing Test Reports

After running E2E tests, HTML reports are available:

```bash
# E2E test report (generated by run-e2e-tests.sh)
open coverage/e2e-report.html

# Unit test coverage report (if generated)
deno test tests/ --allow-all --no-lock --no-check --coverage=coverage/
deno coverage coverage/ --html
open coverage/html/index.html
```

**Report locations:**
| Report | Location | Generated By |
|--------|----------|--------------|
| E2E Test Results | `coverage/e2e-report.html` | `./scripts/run-e2e-tests.sh` |
| Unit Test Coverage | `coverage/html/index.html` | `deno coverage --html` |

#### Troubleshooting E2E Tests

**Docker not running:**
```
Error: Cannot connect to Docker daemon
```
→ Start Docker Desktop and wait for it to fully initialize

**Port already in use:**
```
Error: Port 54321 is already in use
```
→ Run `supabase stop` then `supabase start`

**Functions not found:**
```
Error: Function not found
```
→ Ensure `supabase functions serve --no-verify-jwt` is running in another terminal

**Auth errors:**
```
Error: Invalid JWT
```
→ Re-run the auth users seed: `psql ... -f supabase/seeds/20260118080003_seed_auth_users.sql`

**Test data missing:**
```
Error: No rows returned
```
→ Re-seed the test data in order (reference → location → test → auth)

**psql not found:**
```
Command not found: psql
```
→ Install PostgreSQL client:
  - macOS: `brew install libpq && brew link --force libpq`
  - Ubuntu: `sudo apt install postgresql-client`
  - Windows: Install PostgreSQL or use the psql from Docker

### Test Data

E2E tests use pre-defined test data from seed files:

| Entity | Example IDs |
|--------|-------------|
| Employees | `00000000-0000-0000-0000-00000000000X` (1-10) |
| Companies | `10000000-0000-0000-0000-00000000000X` (1-5) |
| Sites | `20000000-0000-0000-0000-00000000000X` (1-8) |
| Tickets | `60000000-0000-0000-0000-00000000000X` (1-5) |
| Appointments | `50000000-0000-0000-0000-00000000000X` (1-5) |

**Test users and roles:**
| Email | Role | Permission Level |
|-------|------|------------------|
| admin@pdeservice.com | Superadmin | 3 |
| admin2@pdeservice.com | Admin | 2 |
| assigner@pdeservice.com | Assigner | 1 |
| tech1@pdeservice.com | Technician | 0 |
| sales1@pdeservice.com | Sales | 1 |
| pm1@pdeservice.com | PM | 1 |

All test users have password: `test123456`

### E2E Test Files

```
tests/e2e/
├── setup.ts              # Auth user setup
├── test-utils.ts         # API helpers (apiGet, apiPost, etc.)
├── api-*.test.ts         # API endpoint tests
├── security-tests.test.ts
├── authorization-boundary-tests.test.ts
├── data-consistency-tests.test.ts
└── edge-case-tests.test.ts
```

### Unit Test Coverage

All 32 API functions have unit tests covering:

| Test Type | Description |
|-----------|-------------|
| Handler Existence | Verifies exported handlers are callable functions |
| Permission Tests | Verifies correct authorization levels are enforced |
| Validation Tests | Verifies input validation without database |
| Mocked Success | Tests handlers with mocked services (where possible) |

**APIs with Unit Tests:**

| API | Test File | Coverage |
|-----|-----------|----------|
| api-ai | `tests/api-ai/handlers.test.ts` | Handler, Validation |
| api-ai-summary | `tests/api-ai-summary/handlers.test.ts` | Handler, Validation |
| api-analytics | `tests/api-analytics/handlers.test.ts` | Handler, Validation, Mocked |
| api-announcements | `tests/api-announcements/handlers.test.ts` | Handler, Permission, Mocked |
| api-appointments | `tests/api-appointments/handlers.test.ts` | Handler, Permission, Validation, Mocked |
| api-companies | `tests/api-companies/handlers.test.ts` | Handler, Permission, Validation, Mocked |
| api-contacts | `tests/api-contacts/handlers.test.ts` | Handler, Permission, Validation, Mocked |
| api-departments | `tests/api-departments/handlers.test.ts` | Handler, Permission, Mocked |
| api-employee-site-trainings | `tests/api-employee-site-trainings/handlers.test.ts` | Handler, Permission, Mocked |
| api-employees | `tests/api-employees/handlers.test.ts` | Handler, Permission, Validation, Mocked |
| api-features | `tests/api-features/handlers.test.ts` | Handler, Mocked |
| api-fleet | `tests/api-fleet/handlers.test.ts` | Handler, Permission, Mocked |
| api-fleet-sync | `tests/api-fleet-sync/handlers.test.ts` | Handler, Validation |
| api-initialize | `tests/api-initialize/handlers.test.ts` | Handler, Mocked |
| api-leave-requests | `tests/api-leave-requests/handlers.test.ts` | Handler, Permission, Mocked |
| api-line-webhook | `tests/api-line-webhook/handlers.test.ts` | Handler, Validation |
| api-merchandise | `tests/api-merchandise/handlers.test.ts` | Handler, Permission, Mocked |
| api-models | `tests/api-models/handlers.test.ts` | Handler, Permission, Mocked |
| api-notifications | `tests/api-notifications/handlers.test.ts` | Handler, Mocked |
| api-package-services | `tests/api-package-services/handlers.test.ts` | Handler, Permission, Mocked |
| api-places | `tests/api-places/handlers.test.ts` | Handler, Validation |
| api-reference-data | `tests/api-reference-data/handlers.test.ts` | Handler, Mocked |
| api-reports | `tests/api-reports/handlers.test.ts` | Handler, Validation |
| api-roles | `tests/api-roles/handlers.test.ts` | Handler, Permission, Mocked |
| api-route-optimization | `tests/api-route-optimization/handlers.test.ts` | Handler, Validation |
| api-search | `tests/api-search/handlers.test.ts` | Handler, Validation |
| api-sites | `tests/api-sites/handlers.test.ts` | Handler, Permission, Validation, Mocked |
| api-staging | `tests/api-staging/handlers.test.ts` | Handler, Permission, Validation |
| api-stock | `tests/api-stock/handlers.test.ts` | Handler, Validation |
| api-ticket-work-estimates | `tests/api-ticket-work-estimates/handlers.test.ts` | Handler, Validation |
| api-tickets | `tests/api-tickets/handlers.test.ts` | Handler, Permission, Validation, Mocked |
| api-todos | `tests/api-todos/handlers.test.ts` | Handler, Permission, Validation, Mocked |

**Shared Module Tests (`tests/_shared/`):**

| Test File | Coverage |
|-----------|----------|
| `auth.test.ts` | Auth utilities (pure functions) |
| `cors.test.ts` | CORS handler |
| `error.test.ts` | Error classes and handleError |
| `response.test.ts` | Response utilities |
| `sanitize.test.ts` | Input sanitization |
| `validation.test.ts` | Validation utilities |

### Writing New Tests

When adding tests for a new API or handler:

1. **Create test file** in `tests/api-{name}/handlers.test.ts`
2. **Import mock utilities:**
   ```typescript
   import { createMockRequest, createMockJsonRequest, createMockEmployeeWithLevel } from '../_shared/mocks.ts';
   ```
3. **Test in this order:**
   - Handler existence tests
   - Permission tests (use `assertRejects` with Thai error messages)
   - Validation tests (missing required fields, invalid formats)
   - Mocked success tests (if service is class-based)

4. **Run tests:**
   ```bash
   deno test tests/api-{name}/ --allow-all --no-lock --no-check
   ```

### Validation Test Cases

For each handler that accepts input, test these validation scenarios:

| Scenario | Test Case | Expected Error |
|----------|-----------|----------------|
| Missing required field | Omit `name`, `email`, etc. | `กรุณาระบุ{field}` |
| Empty string | `{ "name": "" }` | `กรุณาระบุ{field}` |
| Invalid UUID | `{ "id": "not-a-uuid" }` | `รูปแบบ ID ไม่ถูกต้อง` |
| Invalid email | `{ "email": "invalid" }` | `รูปแบบอีเมลไม่ถูกต้อง` |
| Invalid date | `{ "date": "not-a-date" }` | `รูปแบบวันที่ไม่ถูกต้อง` |
| Negative number | `{ "quantity": -1 }` | `ต้องมากกว่า 0` |
| String too long | `{ "name": "x".repeat(256) }` | `ความยาวเกินกำหนด` |

### Permission Test Reference

| Level | Role | Thai Error Message |
|-------|------|-------------------|
| 0 | Technician L1 | (no restriction) |
| 1 | Assigner/PM/Sales | `ต้องมีสิทธิ์ระดับ 1 ขึ้นไป` |
| 2 | Admin | `ต้องมีสิทธิ์ระดับ 2 ขึ้นไป` |
| 3 | Superadmin | `ต้องมีสิทธิ์ระดับ 3` or `เฉพาะ Superadmin เท่านั้น` |

### Handler Test Checklist

Use this checklist to ensure complete coverage for each handler type:

**GET (Read) Handlers:**
- [ ] Handler exists and is a function
- [ ] Returns 200 with valid data (mocked)
- [ ] Handles not found (404)

**POST (Create) Handlers:**
- [ ] Handler exists and is a function
- [ ] Permission level enforced
- [ ] Required fields validated
- [ ] Invalid format rejected
- [ ] Returns 201 on success (mocked)

**PUT/PATCH (Update) Handlers:**
- [ ] Handler exists and is a function
- [ ] Permission level enforced
- [ ] ID parameter validated
- [ ] Required fields validated
- [ ] Returns 200 on success (mocked)

**DELETE Handlers:**
- [ ] Handler exists and is a function
- [ ] Permission level enforced
- [ ] ID parameter validated
- [ ] Returns 200 on success (mocked)

**Search Handlers:**
- [ ] Handler exists and is a function
- [ ] Pagination parameters validated
- [ ] Filter parameters validated
- [ ] Returns paginated results (mocked)

### Mock Utilities Reference

```typescript
// Create GET request
const req = createMockRequest('GET', 'http://localhost/api-tickets?page=1&limit=20');

// Create POST/PUT request with JSON body
const req = createMockJsonRequest('POST', 'http://localhost/api-tickets', {
  ticket: { work_type_id: 'uuid', assigner_id: 'uuid' }
});

// Create employee with permission level
const tech = createMockEmployeeWithLevel(0);      // Technician
const assigner = createMockEmployeeWithLevel(1);  // Assigner/PM/Sales
const admin = createMockEmployeeWithLevel(2);     // Admin
const superadmin = createMockEmployeeWithLevel(3); // Superadmin
```

### Running All Tests

```bash
# Run all unit tests
deno test tests/ --allow-all --no-lock --no-check

# Run with verbose output
deno test tests/ --allow-all --no-lock --no-check -- --reporter=verbose

# Run specific API tests
deno test tests/api-tickets/ --allow-all --no-lock --no-check

# Run tests matching pattern
deno test tests/ --allow-all --no-lock --no-check --filter "permission"

# Run with coverage report
deno test tests/ --allow-all --no-lock --no-check --coverage=coverage/
deno coverage coverage/ --html
```

See [tests/README.md](./tests/README.md) for detailed handler matrix and examples.

## Troubleshooting

### Migration History Mismatch

If you encounter an error like "The remote database's migration history does not match local files", it means your remote database has migrations that don't exist locally.

**Solution 1: Pull Current Schema (Recommended - Single Operation)**
If your local migrations directory is empty or out of sync, pull your current remote schema:

```bash
supabase db pull
```

This creates a new migration file that matches your current remote database schema. This is faster and avoids rate limiting issues.

**Solution 2: Repair Migration History (Use with caution - many API calls)**
If you need to mark remote migrations as "reverted" instead:

```powershell
.\repair-migrations.ps1
```

⚠️ **Note**: This script makes many API calls and may trigger rate limiting. Wait 15-30 minutes between runs if you get IP banned. The script now includes delays and retry logic to minimize this issue.

**Solution 3: Manual Repair**
You can also repair individual migrations manually:

```bash
supabase migration repair --status reverted <timestamp>
```

## License

TBD
