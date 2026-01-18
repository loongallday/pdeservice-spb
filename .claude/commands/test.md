# Run Tests

Run unit tests and E2E tests for the project.

## Usage
```
/test [api-name]
/test e2e [pattern]
```

## Examples
```
/test                    # Run all unit tests
/test api-tickets        # Run ticket API tests
/test api-employees      # Run employee API tests
/test e2e                # Run all E2E tests
/test e2e tickets        # Run E2E tests matching "tickets"
```

## Unit Tests (No Database Required)

### Run All
```bash
deno test tests/ --allow-all --no-lock --no-check
```

### Run Specific API
```bash
deno test tests/api-tickets/ --allow-all --no-lock --no-check
deno test tests/api-employees/ --allow-all --no-lock --no-check
```

### Run Shared Module Tests
```bash
deno test tests/_shared/ --allow-all --no-lock --no-check
```

### Watch Mode
```bash
deno test tests/ --allow-all --no-lock --no-check --watch
```

### With Coverage
```bash
deno test tests/ --allow-all --no-lock --no-check --coverage=coverage/
deno coverage coverage/ --html
open coverage/html/index.html
```

### Filter by Pattern
```bash
deno test tests/ --allow-all --no-lock --no-check --filter "permission"
deno test tests/ --allow-all --no-lock --no-check --filter "validation"
```

## E2E Tests (Requires Local Supabase)

### Automated (Recommended)
```bash
./scripts/run-e2e-tests.sh              # All E2E tests
./scripts/run-e2e-tests.sh tickets      # Pattern match
./scripts/run-e2e-tests.sh employees    # Pattern match
```

The script:
1. Starts Supabase (if not running)
2. Resets and seeds database
3. Creates test auth users
4. Starts functions server
5. Runs E2E tests
6. Generates HTML report: `coverage/e2e-report.html`
7. Opens report in browser (macOS)

### Manual E2E
```bash
# 1. Start Supabase
supabase start

# 2. Reset and seed
supabase db reset --no-seed
psql postgresql://postgres:postgres@localhost:54322/postgres -f supabase/seeds/20260118080000_seed_reference_data.sql
psql postgresql://postgres:postgres@localhost:54322/postgres -f supabase/seeds/20260118080001_seed_location_data.sql
psql postgresql://postgres:postgres@localhost:54322/postgres -f supabase/seeds/20260118080002_seed_test_data.sql
psql postgresql://postgres:postgres@localhost:54322/postgres -f supabase/seeds/20260118080003_seed_auth_users.sql

# 3. Start functions (in separate terminal)
supabase functions serve --no-verify-jwt

# 4. Run E2E tests
deno test tests/e2e/ --allow-all --unstable-temporal
```

## Test Data

### Test Users (E2E)
| Email | Role | Level | Password |
|-------|------|-------|----------|
| admin@pdeservice.com | Superadmin | 3 | test123456 |
| admin2@pdeservice.com | Admin | 2 | test123456 |
| assigner@pdeservice.com | Assigner | 1 | test123456 |
| tech1@pdeservice.com | Technician | 0 | test123456 |

### Test Entity IDs
| Entity | Pattern |
|--------|---------|
| Employees | `00000000-0000-0000-0000-00000000000X` |
| Companies | `10000000-0000-0000-0000-00000000000X` |
| Sites | `20000000-0000-0000-0000-00000000000X` |
| Appointments | `50000000-0000-0000-0000-00000000000X` |
| Tickets | `60000000-0000-0000-0000-00000000000X` |

## Test Reports

| Report | Location | Command |
|--------|----------|---------|
| E2E Results | `coverage/e2e-report.html` | `./scripts/run-e2e-tests.sh` |
| Unit Coverage | `coverage/html/index.html` | `deno coverage --html` |

## TDD Workflow
1. Write failing test
2. Implement code
3. Run test: `/test api-{name}`
4. Refactor
5. Repeat
