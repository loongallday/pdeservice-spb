# CLAUDE.md - Project Instructions for Claude Code

## Project Overview

**pdeservice-spb** is a Field Service Management & Workforce Scheduling backend system for managing UPS service operations including tickets, appointments, employees, equipment, and fleet management.

### Tech Stack
- **Runtime**: Deno (TypeScript)
- **Database**: PostgreSQL via Supabase
- **API**: Supabase Edge Functions (REST)
- **Auth**: JWT + Supabase Auth
- **Testing**: Deno Test (unit) + E2E with local Supabase

---

## Project Structure

```
/.claude                   # Claude Code configuration
  /commands                # Custom slash commands (/deploy, /migrate, /sql, /test)
  settings.json            # Plugin settings
  settings.local.json      # Local settings (gitignored)

/supabase
  /functions
    /api-*                 # 32 Edge Functions (REST APIs)
    /_shared               # Shared utilities
  /migrations              # Database migrations (SQL)
  /seeds                   # Seed data files for testing
    /20260118080000_seed_reference_data.sql
    /20260118080001_seed_location_data.sql
    /20260118080002_seed_test_data.sql
    /20260118080003_seed_auth_users.sql

/tests                     # Test files
  /_shared                 # Mock utilities and shared module tests
  /api-*                   # Unit tests per API (handlers.test.ts)
  /e2e                     # End-to-end tests

/doc                       # API documentation
/scripts                   # Utility scripts
  /run-e2e-tests.sh        # E2E test runner with HTML report
/coverage                  # Test coverage and reports
```

---

## Test-Driven Development (TDD)

### TDD Workflow

**IMPORTANT**: Always write tests before or alongside implementation.

```
1. Write failing test → 2. Implement code → 3. Run test → 4. Refactor → 5. Repeat
```

### Test Types

| Type | Location | Purpose | Database Required |
|------|----------|---------|-------------------|
| Unit Tests | `tests/api-*/handlers.test.ts` | Test handlers with mocks | No |
| Shared Tests | `tests/_shared/*.test.ts` | Test utility functions | No |
| E2E Tests | `tests/e2e/*.test.ts` | Full API integration | Yes (local Supabase) |

### Running Tests

```bash
# Unit tests (fast, no database)
deno test tests/ --allow-all --no-lock --no-check

# Specific API tests
deno test tests/api-tickets/ --allow-all --no-lock --no-check

# E2E tests with HTML report (requires local Supabase)
./scripts/run-e2e-tests.sh

# E2E specific pattern
./scripts/run-e2e-tests.sh tickets
```

### Writing Unit Tests

For each handler, write tests in this order:

```typescript
// tests/api-{name}/handlers.test.ts
import { assertEquals, assertRejects } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { handlerName } from '../../supabase/functions/api-{name}/handlers/{handler}.ts';
import { createMockRequest, createMockJsonRequest, createMockEmployeeWithLevel } from '../_shared/mocks.ts';

// 1. Handler Existence
Deno.test('{handlerName} handler exists', () => {
  assertEquals(typeof handlerName, 'function');
});

// 2. Permission Tests
Deno.test('{handlerName} - requires level X', async () => {
  const employee = createMockEmployeeWithLevel(X - 1);
  const request = createMockJsonRequest('POST', 'http://localhost/api-{name}', {});
  await assertRejects(
    async () => await handlerName(request, employee),
    Error,
    'ต้องมีสิทธิ์ระดับ'
  );
});

// 3. Validation Tests
Deno.test('{handlerName} - missing required field', async () => {
  const employee = createMockEmployeeWithLevel(X);
  const request = createMockJsonRequest('POST', 'http://localhost/api-{name}', {});
  await assertRejects(
    async () => await handlerName(request, employee),
    Error,
    'กรุณาระบุ'
  );
});

// 4. Mocked Success (if service is class-based)
Deno.test('{handlerName} - success with mocking', async () => {
  const employee = createMockEmployeeWithLevel(X);
  const request = createMockJsonRequest('POST', 'http://localhost/api-{name}', { /* valid data */ });

  const module = await import('../../supabase/functions/api-{name}/services/{name}Service.ts');
  const original = module.{Name}Service.{method};
  module.{Name}Service.{method} = async () => ({ id: 'mock-id' });

  try {
    const response = await handlerName(request, employee);
    assertEquals(response.status, 200);
  } finally {
    module.{Name}Service.{method} = original;
  }
});
```

### Mock Utilities

```typescript
import {
  createMockRequest,           // GET requests
  createMockJsonRequest,       // POST/PUT with body
  createMockEmployeeWithLevel, // Employee with permission level (0-3)
  createMockEmployee,          // Employee with custom overrides
} from '../_shared/mocks.ts';

// Permission levels
const tech = createMockEmployeeWithLevel(0);      // Technician L1 (read-only)
const assigner = createMockEmployeeWithLevel(1);  // Assigner/PM/Sales (create/update)
const admin = createMockEmployeeWithLevel(2);     // Admin (user management)
const superadmin = createMockEmployeeWithLevel(3); // Superadmin (full access)
```

### Test Coverage Requirements

Before completing any feature:
- [ ] Handler existence tests
- [ ] Permission level tests (if handler uses `requireMinLevel`)
- [ ] Validation tests for required fields
- [ ] Mocked success tests (if service is mockable)
- [ ] All tests pass: `deno test tests/api-{name}/ --allow-all --no-lock --no-check`

---

## API Functions (32 total)

### Core Business APIs
| API | Purpose | Handlers |
|-----|---------|----------|
| `api-tickets` | Work orders, comments, attachments, ratings | 17 handlers |
| `api-appointments` | Scheduling and approval | 6 handlers |
| `api-employees` | Workforce management, auth linking | 15 handlers |
| `api-companies` | Company management, comments | 8 handlers |
| `api-sites` | Customer locations, comments | 8 handlers |
| `api-contacts` | Customer contacts | 7 handlers |
| `api-merchandise` | Equipment tracking | 12 handlers |
| `api-models` | Product models and packages | 14 handlers |

### Reference & Config APIs
| API | Purpose |
|-----|---------|
| `api-reference-data` | Work types, statuses, leave types, provinces |
| `api-roles` | Role management |
| `api-departments` | Department management |
| `api-features` | Feature flags and menu items |
| `api-initialize` | App initialization, current user |

### Specialized APIs
| API | Purpose |
|-----|---------|
| `api-search` | Global search across entities |
| `api-analytics` | Workload, utilization, trends |
| `api-reports` | Daily reports, Excel exports |
| `api-fleet` | Vehicle management |
| `api-fleet-sync` | Fleet GPS sync |
| `api-route-optimization` | Route planning |
| `api-stock` | Inventory management |
| `api-leave-requests` | Leave management |
| `api-notifications` | User notifications |
| `api-todos` | Task management |

### Integration APIs
| API | Purpose |
|-----|---------|
| `api-ai` | AI assistant sessions |
| `api-ai-summary` | AI ticket summaries |
| `api-line-webhook` | LINE messaging integration |
| `api-staging` | File staging, LINE accounts |
| `api-places` | Google Places integration |
| `api-package-services` | Service packages |
| `api-employee-site-trainings` | Training records |
| `api-ticket-work-estimates` | Work time estimates |
| `api-announcements` | System announcements |

---

## Database Conventions

### Table Naming
| Prefix | Purpose | Example |
|--------|---------|---------|
| `main_` | Core entities | `main_tickets`, `main_employees` |
| `ref_` | Reference/lookup tables | `ref_ticket_statuses`, `ref_provinces` |
| `child_` | Dependent tables (1:N) | `child_ticket_comments` |
| `jct_` | Junction tables (M:N) | `jct_ticket_employees` |
| `ext_` | Extension tables (1:1) | `ext_model_specifications` |
| `addon_` | Add-on features | `addon_employee_achievements` |

### Key Conventions
- All primary keys use UUID
- Timestamps use `timestamptz`
- Use hard delete (no soft delete)
- RLS enabled on all tables

---

## Shared Utilities (`_shared/`)

| Module | Exports | Purpose |
|--------|---------|---------|
| `auth.ts` | `authenticate()`, `requireMinLevel()`, `isSuperAdmin()` | JWT auth |
| `cors.ts` | `handleCORS()` | CORS preflight |
| `error.ts` | `NotFoundError`, `ValidationError`, `AuthorizationError`, `handleError()` | Error handling |
| `response.ts` | `success()`, `successWithPagination()`, `error()` | Response formatting |
| `validation.ts` | `parsePaginationParams()`, validation helpers | Input validation |
| `supabase.ts` | `createServiceClient()`, `createUserClient()` | Supabase clients |
| `idempotency.ts` | `withIdempotency()` | Idempotent requests |
| `sanitize.ts` | `sanitizeInput()` | Input sanitization |

---

## Authorization Levels

| Level | Role | Capabilities | Thai Error |
|-------|------|--------------|------------|
| 0 | Technician L1 | Read-only | (no restriction) |
| 1 | Assigner, PM, Sales | Create/Update | `ต้องมีสิทธิ์ระดับ 1 ขึ้นไป` |
| 2 | Admin | User management | `ต้องมีสิทธิ์ระดับ 2 ขึ้นไป` |
| 3 | Superadmin | Full access | `เฉพาะ Superadmin เท่านั้น` |

---

## Commands

### Development
```bash
supabase start              # Start local Supabase (requires Docker)
supabase functions serve    # Serve functions locally
supabase stop               # Stop local Supabase
```

### Testing
```bash
# Unit tests
deno test tests/ --allow-all --no-lock --no-check

# E2E tests with report
./scripts/run-e2e-tests.sh

# Coverage
deno test tests/ --allow-all --no-lock --no-check --coverage=coverage/
deno coverage coverage/ --html
```

### Deployment
```bash
# Deploy single function
npx supabase functions deploy api-tickets --no-verify-jwt --project-ref ogzyihacqbasolfxymgo

# Deploy all functions
npx supabase functions deploy --no-verify-jwt --project-ref ogzyihacqbasolfxymgo
```

### Database
```bash
npx supabase migration new <migration_name>  # Create migration
npx supabase db push --linked                # Push to remote
npx supabase db pull                         # Pull remote schema
npx supabase db reset --no-seed              # Reset local DB
```

---

## Common Tasks

### Adding a New API Endpoint

1. **Write tests first** in `tests/api-{resource}/handlers.test.ts`
2. Create handler in `supabase/functions/api-{resource}/handlers/`
3. Add route in `supabase/functions/api-{resource}/index.ts`
4. Create service in `/services/` if needed
5. Run tests: `deno test tests/api-{resource}/ --allow-all --no-lock --no-check`
6. Deploy: `npx supabase functions deploy api-{resource} --no-verify-jwt --project-ref ogzyihacqbasolfxymgo`

### Adding a Database Migration

**IMPORTANT: Use Supabase CLI, NOT MCP `apply_migration`**

```bash
npx supabase migration new <migration_name_in_snake_case>
# Edit /supabase/migrations/TIMESTAMP_migration_name.sql
npx supabase db push --linked
npx supabase migration list  # Verify
```

### Running E2E Tests from Fresh DB

```bash
# Automated (recommended)
./scripts/run-e2e-tests.sh

# Manual
supabase start
supabase db reset --no-seed
psql postgresql://postgres:postgres@localhost:54322/postgres -f supabase/seeds/20260118080000_seed_reference_data.sql
psql postgresql://postgres:postgres@localhost:54322/postgres -f supabase/seeds/20260118080001_seed_location_data.sql
psql postgresql://postgres:postgres@localhost:54322/postgres -f supabase/seeds/20260118080002_seed_test_data.sql
psql postgresql://postgres:postgres@localhost:54322/postgres -f supabase/seeds/20260118080003_seed_auth_users.sql
supabase functions serve --no-verify-jwt
# In another terminal:
deno test tests/e2e/ --allow-all --unstable-temporal
```

---

## Code Style

### TypeScript/Deno
- TypeScript strict mode
- Prefer `const` over `let`
- Explicit return types for functions
- Handle errors with try/catch
- **Thai language for user-facing error messages**

### API Response Format
```typescript
// Success
{ "data": { ... } }

// Success with pagination
{ "data": { "data": [...], "pagination": { "page": 1, "limit": 20, "total": 100 } } }

// Error
{ "error": "ข้อความภาษาไทย" }
```

---

## Test Data (E2E)

| Entity | ID Pattern | Count |
|--------|------------|-------|
| Employees | `00000000-0000-0000-0000-00000000000X` | 10 |
| Companies | `10000000-0000-0000-0000-00000000000X` | 5 |
| Sites | `20000000-0000-0000-0000-00000000000X` | 8 |
| Appointments | `50000000-0000-0000-0000-00000000000X` | 5 |
| Tickets | `60000000-0000-0000-0000-00000000000X` | 5 |

### Test Users
| Email | Role | Level | Password |
|-------|------|-------|----------|
| admin@pdeservice.com | Superadmin | 3 | test123456 |
| admin2@pdeservice.com | Admin | 2 | test123456 |
| assigner@pdeservice.com | Assigner | 1 | test123456 |
| tech1@pdeservice.com | Technician | 0 | test123456 |

---

## Claude Code Configuration (`.claude/`)

The `.claude/` folder contains Claude Code settings and custom slash commands.

### Directory Structure
```
.claude/
├── settings.json         # Plugin settings (shared)
├── settings.local.json   # Local settings (gitignored)
└── commands/             # Custom slash commands
    ├── deploy.md         # /deploy - Deploy Edge Functions
    ├── e2e.md            # /e2e - Run E2E tests with report
    ├── logs.md           # /logs - View service logs
    ├── migrate.md        # /migrate - Create DB migrations
    ├── seed.md           # /seed - Seed database
    ├── sql.md            # /sql - Execute SQL queries
    └── test.md           # /test - Run unit tests
```

### Enabled Plugins
```json
{
  "enabledPlugins": {
    "superpowers@superpowers-marketplace": true,
    "ralph-loop@claude-plugins-official": true,
    "ralph-wiggum@claude-code-plugins": true
  }
}
```

### Custom Slash Commands

| Command | Usage | Description |
|---------|-------|-------------|
| `/deploy` | `/deploy <function-name>` | Deploy Edge Function to production |
| `/e2e` | `/e2e [pattern]` | Run E2E tests with HTML report |
| `/logs` | `/logs <service>` | View Supabase service logs |
| `/migrate` | `/migrate <name>` | Create database migration |
| `/seed` | `/seed [type]` | Seed database with test data |
| `/sql` | `/sql <query>` | Execute SQL query via MCP |
| `/test` | `/test [api-name]` | Run unit tests |

**Examples:**
```bash
/deploy api-tickets          # Deploy single function
/deploy all                  # Deploy all functions
/e2e                         # Run all E2E tests with report
/e2e tickets                 # Run E2E tests matching pattern
/logs api                    # View Edge Function logs
/logs postgres               # View database logs
/migrate add_user_status     # Create new migration
/seed                        # Seed all test data
/seed reference              # Seed reference data only
/sql SELECT COUNT(*) FROM main_employees
/test                        # Run all unit tests
/test api-tickets            # Run specific API tests
```

---

## MCP Integration

```json
{
  "mcpServers": {
    "supabase": {
      "type": "http",
      "url": "https://mcp.supabase.com/mcp?project_ref=ogzyihacqbasolfxymgo"
    }
  }
}
```

**Available**: `execute_sql`, `list_tables`, `list_migrations`, `get_logs`, `search_docs`

**Do NOT use**: `apply_migration` (use CLI instead)

---

## Important Notes

1. **TDD**: Write tests before implementation
2. **Thai Localization**: Error messages in Thai
3. **Project Ref**: `ogzyihacqbasolfxymgo`
4. **32 APIs**: Check full list above before adding new ones
5. **Test Reports**: `coverage/e2e-report.html` after E2E tests
