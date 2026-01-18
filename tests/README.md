# Tests Documentation

This directory contains unit tests for the pdeservice-spb backend API.

## Overview

- **434 unit tests** covering handler existence, permission checks, validation, and mocked success scenarios
- Written for **Deno** runtime using the standard testing library
- Tests focus on **validation logic and permission checks** without requiring database connections

## Directory Structure

```
tests/
├── _shared/                    # Shared test utilities and _shared module tests
│   ├── mocks.ts               # Mock factories for requests and employees
│   ├── auth.test.ts           # Auth utility tests (pure functions)
│   ├── cors.test.ts           # CORS utility tests
│   ├── error.test.ts          # Error classes and handleError tests
│   ├── response.test.ts       # Response utility tests
│   ├── sanitize.test.ts       # Sanitize utility tests
│   └── validation.test.ts     # Validation utility tests
├── api-analytics/             # Analytics API tests
├── api-announcements/         # Announcements API tests
├── api-appointments/          # Appointments API tests
├── api-companies/             # Companies API tests
├── api-contacts/              # Contacts API tests
├── api-departments/           # Departments API tests
├── api-employee-site-trainings/
├── api-employees/             # Employees API tests
├── api-features/              # Features API tests
├── api-fleet/                 # Fleet management tests
├── api-initialize/            # Initialize API tests
├── api-leave-requests/        # Leave requests tests
├── api-merchandise/           # Merchandise API tests
├── api-models/                # Models API tests
├── api-notifications/         # Notifications API tests
├── api-package-services/      # Package services tests
├── api-reference-data/        # Reference data tests
├── api-reports/               # Reports API tests
├── api-roles/                 # Roles API tests
├── api-search/                # Search API tests
├── api-sites/                 # Sites API tests
├── api-stock/                 # Stock API tests
├── api-ticket-work-estimates/ # Work estimates tests
├── api-tickets/               # Tickets API tests
├── api-todos/                 # Todos API tests
├── integration/               # Integration tests (require database)
│   └── README.md             # Integration test setup instructions
└── README.md                  # This file
```

## Running Tests

### Run All Unit Tests

```bash
deno test tests/ --allow-all --no-lock --no-check
```

### Run Specific API Tests

```bash
# Test a specific API
deno test tests/api-tickets/ --allow-all --no-lock --no-check

# Test a specific file
deno test tests/api-tickets/handlers.test.ts --allow-all --no-lock --no-check
```

### Watch Mode

```bash
deno test tests/ --allow-all --no-lock --no-check --watch
```

### Run with Coverage

```bash
deno test tests/ --allow-all --no-lock --no-check --coverage=coverage/
deno coverage coverage/
```

## Test Patterns

### 1. Handler Existence Tests

Verify that handlers are exported and callable:

```typescript
Deno.test('create handler exists', () => {
  assertEquals(typeof create, 'function');
});
```

### 2. Permission Tests

Test that handlers enforce correct permission levels:

```typescript
Deno.test('create - requires level 1', async () => {
  const employee = createMockEmployeeWithLevel(0);  // Level below required
  const request = createMockJsonRequest('POST', 'http://localhost/api-xxx', {...});

  await assertRejects(
    async () => await create(request, employee),
    Error,
    'ต้องมีสิทธิ์ระดับ 1'  // Expected Thai error message
  );
});
```

### 3. Validation Tests

Test input validation without database:

```typescript
Deno.test('create - missing required field throws error', async () => {
  const employee = createMockEmployeeWithLevel(1);
  const request = createMockJsonRequest('POST', 'http://localhost/api-xxx', {
    // Missing required field
  });

  await assertRejects(
    async () => await create(request, employee),
    Error,
    'กรุณาระบุ'  // Expected validation error
  );
});
```

### 4. Mocked Success Tests

Test handlers with mocked services:

```typescript
Deno.test('getById - success with mocking', async () => {
  const employee = createMockEmployeeWithLevel(0);
  const request = createMockRequest('GET', `http://localhost/api-xxx/${mockId}`);

  // Import and mock the service
  const module = await import('../../supabase/functions/api-xxx/services/xxxService.ts');
  const originalMethod = module.XxxService.methodName;
  module.XxxService.methodName = async () => mockData;

  try {
    const response = await handler(request, employee, mockId);
    assertEquals(response.status, 200);
  } finally {
    // Always restore original
    module.XxxService.methodName = originalMethod;
  }
});
```

## Mock Utilities

### `createMockRequest(method, url)`

Creates a mock HTTP request:

```typescript
const request = createMockRequest('GET', 'http://localhost/api-tickets?page=1');
```

### `createMockJsonRequest(method, url, body)`

Creates a mock HTTP request with JSON body:

```typescript
const request = createMockJsonRequest('POST', 'http://localhost/api-tickets', {
  ticket: { work_type_id: '...', assigner_id: '...' }
});
```

### `createMockEmployeeWithLevel(level)`

Creates a mock employee with specified permission level:

```typescript
const employee = createMockEmployeeWithLevel(0);  // Technician L1
const employee = createMockEmployeeWithLevel(1);  // Assigner/PM/Sales
const employee = createMockEmployeeWithLevel(2);  // Admin
const employee = createMockEmployeeWithLevel(3);  // Superadmin
```

## Permission Levels Reference

| Level | Role | Capabilities |
|-------|------|--------------|
| 0 | Technician L1 | Read-only access |
| 1 | Assigner, PM, Sales | Create/Update operations |
| 2 | Admin | User management, advanced operations |
| 3 | Superadmin | Full system access |

## Common Permission Error Messages

| Error Message | Meaning |
|---------------|---------|
| `ต้องมีสิทธิ์ระดับ 1` | Requires level 1 (Assigner+) |
| `ต้องมีสิทธิ์ระดับ 2` | Requires level 2 (Admin+) |
| `ต้องมีสิทธิ์ระดับ 3` | Requires level 3 (Superadmin) |
| `เฉพาะ Superadmin เท่านั้น` | Superadmin only (alternative) |

## Service Mocking Notes

### Class-based Services (Can Mock)

Services exported as classes with static methods can be mocked:

```typescript
// Service exports like this:
export class SiteService {
  static async getById(id: string) { ... }
}

// Can be mocked:
module.SiteService.getById = async () => mockData;
```

### Function-based Services (Cannot Mock)

Services that export functions directly cannot be mocked with this pattern:

```typescript
// Service exports like this:
export async function search(params) { ... }

// Cannot reassign - ES modules are read-only
```

For function-based services, tests focus on handler existence, permissions, and validation only.

## Integration Tests

Tests requiring database connections are in `tests/integration/`. See `tests/integration/README.md` for setup instructions.

## Writing New Tests

1. Create test file in appropriate `tests/api-xxx/` directory
2. Import handlers and mock utilities
3. Write tests in this order:
   - Handler existence tests
   - Permission tests
   - Validation tests
   - Mocked success tests (if service is mockable)

### Template

```typescript
/**
 * Unit tests for XXX API handlers
 * Tests validation logic and permission checks only
 */

import { assertEquals, assertRejects } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { handler } from '../../supabase/functions/api-xxx/handlers/handler.ts';
import { createMockRequest, createMockJsonRequest, createMockEmployeeWithLevel } from '../_shared/mocks.ts';

const mockData = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  // ... mock fields
};

// ============ Handler Existence Tests ============

Deno.test('handler exists', () => {
  assertEquals(typeof handler, 'function');
});

// ============ Permission Tests ============

Deno.test('handler - requires level X', async () => {
  // Test permission enforcement
});

// ============ Validation Tests ============

Deno.test('handler - missing field throws error', async () => {
  // Test input validation
});

// ============ Mocked Success Tests ============

Deno.test('handler - success with mocking', async () => {
  // Test successful execution with mocked service
});
```

## Troubleshooting

### Module Not Found Errors

Check that the handler file path and export name match exactly:

```typescript
// If handler is exported as 'get' from 'get.ts':
import { get } from '../../supabase/functions/api-xxx/handlers/get.ts';

// NOT:
import { getById } from '../../supabase/functions/api-xxx/handlers/getById.ts';
```

### Permission Test Failures

Verify the exact error message in the handler:

```typescript
// Handler uses:
await requireMinLevel(employee, 1);  // Throws 'ต้องมีสิทธิ์ระดับ 1'

// Or:
if (!isSuperAdmin(employee)) {
  throw new AuthorizationError('เฉพาะ Superadmin เท่านั้น');
}
```

### Mocking Failures

If mocking doesn't work, the service likely exports functions directly instead of class methods. Simplify the test to skip the mocked success tests.

## CI/CD Integration

Tests can be integrated into CI/CD pipelines:

```yaml
- name: Run Tests
  run: deno test tests/ --allow-all --no-lock --no-check
```

## Test Coverage Summary

| API | Tests | Coverage |
|-----|-------|----------|
| _shared | 173 | Validation, Error, Response, CORS, Sanitize, Auth |
| api-analytics | 36 | Handler, Validation, Mocked |
| api-announcements | 12 | Handler, Permission, Mocked |
| api-appointments | 16 | Handler, Permission, Validation, Mocked |
| api-companies | 14 | Handler, Permission, Validation, Mocked |
| api-contacts | 21 | Handler, Permission, Validation, Mocked |
| api-departments | 9 | Handler, Permission, Mocked |
| api-employee-site-trainings | 5 | Handler, Permission, Mocked |
| api-employees | 9 | Handler, Permission, Validation, Mocked |
| api-features | 6 | Handler, Mocked |
| api-fleet | 8 | Handler, Permission, Mocked |
| api-initialize | 10 | Handler, Mocked |
| api-leave-requests | 6 | Handler, Permission, Mocked |
| api-merchandise | 12 | Handler, Permission, Mocked |
| api-models | 9 | Handler, Permission, Mocked |
| api-notifications | 5 | Handler, Mocked |
| api-package-services | 10 | Handler, Permission, Mocked |
| api-reference-data | 15 | Handler, Mocked |
| api-reports | 10 | Handler, Validation |
| api-roles | 6 | Handler, Permission, Mocked |
| api-search | 4 | Handler, Validation |
| api-sites | 10 | Handler, Permission, Validation, Mocked |
| api-stock | 3 | Handler, Validation |
| api-ticket-work-estimates | 2 | Handler, Validation |
| api-tickets | 14 | Handler, Permission, Validation, Mocked |
| api-todos | 9 | Handler, Permission, Validation, Mocked |

**Total: 434 tests**

## Detailed Handler Coverage

This section documents all API handlers and their expected test cases.

### Test Case Types

For each handler, the following test types should be implemented:

| Test Type | When to Use | Example |
|-----------|-------------|---------|
| **Existence** | Always | `assertEquals(typeof handler, 'function')` |
| **Permission** | Handlers with `requireMinLevel()` | Test with lower level employee |
| **Validation** | Handlers with required fields | Test missing/invalid fields |
| **Mocked Success** | Class-based services | Mock service method, verify response |

### API Handler Matrix

#### api-ai
| Handler | File | Permission | Tests |
|---------|------|------------|-------|
| assistant | `handlers/assistant.ts` | Level 0 | Existence, Validation |
| assistantStream | `handlers/assistantStream.ts` | Level 0 | Existence, Validation |
| sessions | `handlers/sessions.ts` | Level 0 | Existence |

#### api-ai-summary
| Handler | File | Permission | Tests |
|---------|------|------------|-------|
| generate | `index.ts` | Level 0 | Existence, Validation |

#### api-analytics
| Handler | File | Permission | Tests |
|---------|------|------------|-------|
| utilization | `handlers/utilization.ts` | Level 0 | Existence, Validation, Mocked |
| workload | `handlers/workload.ts` | Level 0 | Existence, Validation, Mocked |
| trends | `handlers/trends.ts` | Level 0 | Existence, Validation, Mocked |
| technicianDetail | `handlers/technicianDetail.ts` | Level 0 | Existence, Validation, Mocked |

#### api-announcements
| Handler | File | Permission | Tests |
|---------|------|------------|-------|
| list | `handlers/list.ts` | Level 0 | Existence, Mocked |
| create | `handlers/create.ts` | Level 1 | Existence, Permission, Validation, Mocked |
| getById | `handlers/getById.ts` | Level 0 | Existence, Mocked |
| update | `handlers/update.ts` | Level 1 | Existence, Permission, Validation, Mocked |
| delete | `handlers/delete.ts` | Level 1 | Existence, Permission, Mocked |

#### api-appointments
| Handler | File | Permission | Tests |
|---------|------|------------|-------|
| list | `index.ts` | Level 0 | Existence, Mocked |
| create | `index.ts` | Level 1 | Existence, Permission, Validation, Mocked |
| getById | `index.ts` | Level 0 | Existence, Mocked |
| update | `index.ts` | Level 1 | Existence, Permission, Validation, Mocked |
| delete | `index.ts` | Level 1 | Existence, Permission, Mocked |
| approve | `index.ts` | Level 1 | Existence, Permission, Mocked |

#### api-companies
| Handler | File | Permission | Tests |
|---------|------|------------|-------|
| create | `handlers/create.ts` | Level 1 | Existence, Permission, Validation, Mocked |
| createOrUpdate | `handlers/createOrUpdate.ts` | Level 1 | Existence, Permission, Validation, Mocked |
| getById | `handlers/getById.ts` | Level 0 | Existence, Mocked |
| update | `handlers/update.ts` | Level 1 | Existence, Permission, Validation, Mocked |
| delete | `handlers/delete.ts` | Level 2 | Existence, Permission, Mocked |
| globalSearch | `handlers/globalSearch.ts` | Level 0 | Existence, Validation, Mocked |
| hint | `handlers/hint.ts` | Level 0 | Existence, Mocked |
| comments | `handlers/comments.ts` | Level 0 | Existence, Permission (write), Mocked |

#### api-contacts
| Handler | File | Permission | Tests |
|---------|------|------------|-------|
| list | `handlers/list.ts` | Level 0 | Existence, Mocked |
| create | `handlers/create.ts` | Level 1 | Existence, Permission, Validation, Mocked |
| get | `handlers/get.ts` | Level 0 | Existence, Mocked |
| getBySite | `handlers/getBySite.ts` | Level 0 | Existence, Mocked |
| update | `handlers/update.ts` | Level 1 | Existence, Permission, Validation, Mocked |
| delete | `handlers/delete.ts` | Level 1 | Existence, Permission, Mocked |
| search | `handlers/search.ts` | Level 0 | Existence, Validation, Mocked |

#### api-departments
| Handler | File | Permission | Tests |
|---------|------|------------|-------|
| create | `handlers/create.ts` | Level 2 | Existence, Permission, Validation, Mocked |
| getById | `handlers/getById.ts` | Level 0 | Existence, Mocked |
| update | `handlers/update.ts` | Level 2 | Existence, Permission, Validation, Mocked |
| delete | `handlers/delete.ts` | Level 2 | Existence, Permission, Mocked |
| search | `handlers/search.ts` | Level 0 | Existence, Validation, Mocked |
| departmentSummary | `handlers/departmentSummary.ts` | Level 0 | Existence, Mocked |

#### api-employee-site-trainings
| Handler | File | Permission | Tests |
|---------|------|------------|-------|
| list | `handlers/list.ts` | Level 0 | Existence, Mocked |
| create | `handlers/create.ts` | Level 1 | Existence, Permission, Validation, Mocked |
| get | `handlers/get.ts` | Level 0 | Existence, Mocked |
| update | `handlers/update.ts` | Level 1 | Existence, Permission, Validation, Mocked |

#### api-employees
| Handler | File | Permission | Tests |
|---------|------|------------|-------|
| list | `index.ts` | Level 0 | Existence, Mocked |
| create | `handlers/create.ts` | Level 2 | Existence, Permission, Validation, Mocked |
| getById | `handlers/getById.ts` | Level 0 | Existence, Mocked |
| update | `handlers/update.ts` | Level 1 | Existence, Permission, Validation, Mocked |
| delete | `handlers/delete.ts` | Level 2 | Existence, Permission, Mocked |
| search | `handlers/search.ts` | Level 0 | Existence, Validation, Mocked |
| networkSearch | `handlers/networkSearch.ts` | Level 0 | Existence, Validation, Mocked |
| linkAuth | `handlers/linkAuth.ts` | Level 2 | Existence, Permission, Validation, Mocked |
| unlinkAuth | `handlers/unlinkAuth.ts` | Level 2 | Existence, Permission, Mocked |
| linkExistingAuth | `handlers/linkExistingAuth.ts` | Level 2 | Existence, Permission, Validation, Mocked |
| technicianAvailability | `handlers/technicianAvailability.ts` | Level 0 | Existence, Validation, Mocked |
| employeeSummary | `handlers/employeeSummary.ts` | Level 0 | Existence, Mocked |
| achievementTrack | `handlers/achievementTrack.ts` | Level 0 | Existence, Mocked |
| achievementProgress | `handlers/achievementProgress.ts` | Level 0 | Existence, Mocked |
| achievementCoupons | `handlers/achievementCoupons.ts` | Level 0 | Existence, Mocked |

#### api-features
| Handler | File | Permission | Tests |
|---------|------|------------|-------|
| getEnabled | `handlers/getEnabled.ts` | Level 0 | Existence, Mocked |
| getMenuItems | `handlers/getMenuItems.ts` | Level 0 | Existence, Mocked |

#### api-fleet
| Handler | File | Permission | Tests |
|---------|------|------------|-------|
| list | `handlers/fleet.ts` | Level 0 | Existence, Mocked |
| getById | `handlers/fleet.ts` | Level 0 | Existence, Mocked |
| create | `handlers/fleet.ts` | Level 1 | Existence, Permission, Validation, Mocked |
| update | `handlers/fleet.ts` | Level 1 | Existence, Permission, Validation, Mocked |
| delete | `handlers/fleet.ts` | Level 2 | Existence, Permission, Mocked |

#### api-fleet-sync
| Handler | File | Permission | Tests |
|---------|------|------------|-------|
| sync | `index.ts` | Level 0 | Existence, Validation |

#### api-initialize
| Handler | File | Permission | Tests |
|---------|------|------------|-------|
| initialize | `handlers/initialize.ts` | Level 0 | Existence, Mocked |
| me | `handlers/me.ts` | Level 0 | Existence, Mocked |
| features | `handlers/features.ts` | Level 0 | Existence, Mocked |

#### api-leave-requests
| Handler | File | Permission | Tests |
|---------|------|------------|-------|
| list | `handlers/list.ts` | Level 0 | Existence, Mocked |
| create | `handlers/create.ts` | Level 0 | Existence, Validation, Mocked |
| get | `handlers/get.ts` | Level 0 | Existence, Mocked |
| update | `handlers/update.ts` | Level 0 | Existence, Validation, Mocked |
| delete | `handlers/delete.ts` | Level 0 | Existence, Mocked |
| approve | `handlers/approve.ts` | Level 1 | Existence, Permission, Mocked |
| reject | `handlers/reject.ts` | Level 1 | Existence, Permission, Mocked |
| cancel | `handlers/cancel.ts` | Level 0 | Existence, Mocked |
| search | `handlers/search.ts` | Level 0 | Existence, Validation, Mocked |

#### api-line-webhook
| Handler | File | Permission | Tests |
|---------|------|------------|-------|
| followHandler | `handlers/followHandler.ts` | None | Existence, Validation |
| messageHandler | `handlers/messageHandler.ts` | None | Existence, Validation |
| postbackHandler | `handlers/postbackHandler.ts` | None | Existence, Validation |

#### api-merchandise
| Handler | File | Permission | Tests |
|---------|------|------------|-------|
| list | `handlers/list.ts` | Level 0 | Existence, Mocked |
| create | `handlers/create.ts` | Level 1 | Existence, Permission, Validation, Mocked |
| get | `handlers/get.ts` | Level 0 | Existence, Mocked |
| getByModel | `handlers/getByModel.ts` | Level 0 | Existence, Mocked |
| getBySite | `handlers/getBySite.ts` | Level 0 | Existence, Mocked |
| update | `handlers/update.ts` | Level 1 | Existence, Permission, Validation, Mocked |
| delete | `handlers/delete.ts` | Level 1 | Existence, Permission, Mocked |
| search | `handlers/search.ts` | Level 0 | Existence, Validation, Mocked |
| hint | `handlers/hint.ts` | Level 0 | Existence, Mocked |
| checkDuplicate | `handlers/checkDuplicate.ts` | Level 0 | Existence, Validation, Mocked |
| location | `handlers/location.ts` | Level 0 | Existence, Mocked |
| replacementChain | `handlers/replacementChain.ts` | Level 0 | Existence, Mocked |

#### api-models
| Handler | File | Permission | Tests |
|---------|------|------------|-------|
| list | `handlers/list.ts` | Level 0 | Existence, Mocked |
| create | `handlers/create.ts` | Level 1 | Existence, Permission, Validation, Mocked |
| get | `handlers/get.ts` | Level 0 | Existence, Mocked |
| getById | `handlers/getById.ts` | Level 0 | Existence, Mocked |
| getByModel | `handlers/getByModel.ts` | Level 0 | Existence, Mocked |
| update | `handlers/update.ts` | Level 1 | Existence, Permission, Validation, Mocked |
| delete | `handlers/delete.ts` | Level 1 | Existence, Permission, Mocked |
| search | `handlers/search.ts` | Level 0 | Existence, Validation, Mocked |
| checkCode | `handlers/checkCode.ts` | Level 0 | Existence, Validation, Mocked |
| getPackage | `handlers/getPackage.ts` | Level 0 | Existence, Mocked |
| addPackageItem | `handlers/addPackageItem.ts` | Level 1 | Existence, Permission, Validation, Mocked |
| removePackageItem | `handlers/removePackageItem.ts` | Level 1 | Existence, Permission, Mocked |
| addPackageService | `handlers/addPackageService.ts` | Level 1 | Existence, Permission, Validation, Mocked |
| removePackageService | `handlers/removePackageService.ts` | Level 1 | Existence, Permission, Mocked |

#### api-notifications
| Handler | File | Permission | Tests |
|---------|------|------------|-------|
| get | `handlers/get.ts` | Level 0 | Existence, Mocked |
| markAsRead | `handlers/markAsRead.ts` | Level 0 | Existence, Mocked |

#### api-package-services
| Handler | File | Permission | Tests |
|---------|------|------------|-------|
| list | `handlers/list.ts` | Level 0 | Existence, Mocked |
| create | `handlers/create.ts` | Level 1 | Existence, Permission, Validation, Mocked |
| getById | `handlers/getById.ts` | Level 0 | Existence, Mocked |
| update | `handlers/update.ts` | Level 1 | Existence, Permission, Validation, Mocked |
| delete | `handlers/delete.ts` | Level 1 | Existence, Permission, Mocked |

#### api-places
| Handler | File | Permission | Tests |
|---------|------|------------|-------|
| autocomplete | `handlers/autocomplete.ts` | Level 0 | Existence, Validation |
| details | `handlers/details.ts` | Level 0 | Existence, Validation |

#### api-reference-data
| Handler | File | Permission | Tests |
|---------|------|------------|-------|
| workTypes | `handlers/workTypes.ts` | Level 0 | Existence, Mocked |
| statuses | `handlers/statuses.ts` | Level 0 | Existence, Mocked |
| leaveTypes | `handlers/leaveTypes.ts` | Level 0 | Existence, Mocked |
| provinces | `handlers/provinces.ts` | Level 0 | Existence, Mocked |
| workGivers | `handlers/workGivers.ts` | Level 0 | Existence, Mocked |

#### api-reports
| Handler | File | Permission | Tests |
|---------|------|------------|-------|
| daily | `handlers/daily.ts` | Level 0 | Existence, Validation |
| rmaExcel | `handlers/rmaExcel.ts` | Level 0 | Existence, Validation |
| workTypeExcel | `handlers/workTypeExcel.ts` | Level 0 | Existence, Validation |

#### api-roles
| Handler | File | Permission | Tests |
|---------|------|------------|-------|
| list | `index.ts` | Level 0 | Existence, Mocked |
| create | `handlers/create.ts` | Level 2 | Existence, Permission, Validation, Mocked |
| getById | `handlers/getById.ts` | Level 0 | Existence, Mocked |
| update | `handlers/update.ts` | Level 2 | Existence, Permission, Validation, Mocked |
| delete | `handlers/delete.ts` | Level 2 | Existence, Permission, Mocked |
| search | `handlers/search.ts` | Level 0 | Existence, Validation, Mocked |
| roleSummary | `handlers/roleSummary.ts` | Level 0 | Existence, Mocked |

#### api-route-optimization
| Handler | File | Permission | Tests |
|---------|------|------------|-------|
| optimize | `index.ts` | Level 0 | Existence, Validation |

#### api-search
| Handler | File | Permission | Tests |
|---------|------|------------|-------|
| search | `handlers/search.ts` | Level 0 | Existence, Validation |

#### api-sites
| Handler | File | Permission | Tests |
|---------|------|------------|-------|
| create | `handlers/create.ts` | Level 1 | Existence, Permission, Validation, Mocked |
| createOrReplace | `handlers/createOrReplace.ts` | Level 1 | Existence, Permission, Validation, Mocked |
| getById | `handlers/getById.ts` | Level 0 | Existence, Mocked |
| update | `handlers/update.ts` | Level 1 | Existence, Permission, Validation, Mocked |
| delete | `handlers/delete.ts` | Level 2 | Existence, Permission, Mocked |
| globalSearch | `handlers/globalSearch.ts` | Level 0 | Existence, Validation, Mocked |
| hint | `handlers/hint.ts` | Level 0 | Existence, Mocked |
| comments | `handlers/comments.ts` | Level 0 | Existence, Permission (write), Mocked |

#### api-staging
| Handler | File | Permission | Tests |
|---------|------|------------|-------|
| files | `handlers/files.ts` | Level 0 | Existence, Validation |
| carousel | `handlers/carousel.ts` | Level 0 | Existence, Validation |
| approval | `handlers/approval.ts` | Level 1 | Existence, Permission, Validation |
| lineAccounts | `handlers/lineAccounts.ts` | Level 0 | Existence |

#### api-stock
| Handler | File | Permission | Tests |
|---------|------|------------|-------|
| check | `index.ts` | Level 0 | Existence, Validation |
| transfer | `index.ts` | Level 1 | Existence, Permission, Validation |

#### api-ticket-work-estimates
| Handler | File | Permission | Tests |
|---------|------|------------|-------|
| estimate | `index.ts` | Level 0 | Existence, Validation |

#### api-tickets
| Handler | File | Permission | Tests |
|---------|------|------------|-------|
| create | `handlers/create.ts` | Level 1 | Existence, Permission, Validation, Mocked |
| get | `handlers/get.ts` | Level 0 | Existence, Mocked |
| update | `handlers/update.ts` | Level 1 | Existence, Permission, Validation, Mocked |
| delete | `handlers/delete.ts` | Level 2 | Existence, Permission, Mocked |
| search | `handlers/search.ts` | Level 0 | Existence, Validation, Mocked |
| searchDuration | `handlers/searchDuration.ts` | Level 0 | Existence, Validation, Mocked |
| comments | `handlers/comments.ts` | Level 0 | Existence, Permission (write), Mocked |
| attachments | `handlers/attachments.ts` | Level 0 | Existence, Permission (write), Mocked |
| watchers | `handlers/watchers.ts` | Level 0 | Existence, Permission (write), Mocked |
| ratings | `handlers/ratings.ts` | Level 0 | Existence, Permission (write), Validation, Mocked |
| confirmTechnicians | `handlers/confirmTechnicians.ts` | Level 0 | Existence, Validation, Mocked |
| getConfirmedTechnicians | `handlers/getConfirmedTechnicians.ts` | Level 0 | Existence, Mocked |
| removeTicketEmployee | `handlers/removeTicketEmployee.ts` | Level 1 | Existence, Permission, Mocked |
| getAuditLogs | `handlers/getAuditLogs.ts` | Level 0 | Existence, Mocked |
| getSummaries | `handlers/getSummaries.ts` | Level 0 | Existence, Mocked |
| backfillSummaries | `handlers/backfillSummaries.ts` | Level 2 | Existence, Permission, Mocked |
| extraFields | `handlers/extraFields.ts` | Level 0 | Existence, Mocked |

#### api-todos
| Handler | File | Permission | Tests |
|---------|------|------------|-------|
| list | `handlers/todos.ts` | Level 0 | Existence, Mocked |
| create | `handlers/todos.ts` | Level 0 | Existence, Validation, Mocked |
| update | `handlers/todos.ts` | Level 0 | Existence, Validation, Mocked |
| delete | `handlers/todos.ts` | Level 0 | Existence, Mocked |

## Running Coverage Reports

To see which handlers have tests and which are missing:

```bash
# Run tests with verbose output
deno test tests/ --allow-all --no-lock --no-check 2>&1 | grep -E "^(ok|FAILED|test)"

# Count tests per API
for dir in tests/api-*/; do
  count=$(deno test "$dir" --allow-all --no-lock --no-check 2>&1 | grep -c "^ok" || echo 0)
  echo "$dir: $count tests"
done
```

## Adding Missing Tests

If a handler is missing tests, follow this template:

```typescript
// tests/api-{name}/handlers.test.ts

import { assertEquals, assertRejects } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { handlerName } from '../../supabase/functions/api-{name}/handlers/{handler}.ts';
import { createMockRequest, createMockJsonRequest, createMockEmployeeWithLevel } from '../_shared/mocks.ts';

// ============ Handler Existence ============
Deno.test('{handlerName} handler exists', () => {
  assertEquals(typeof handlerName, 'function');
});

// ============ Permission Tests ============
Deno.test('{handlerName} - requires level X', async () => {
  const employee = createMockEmployeeWithLevel(X - 1); // One below required
  const request = createMockJsonRequest('POST', 'http://localhost/api-{name}', {});

  await assertRejects(
    async () => await handlerName(request, employee),
    Error,
    'ต้องมีสิทธิ์ระดับ X'
  );
});

// ============ Validation Tests ============
Deno.test('{handlerName} - missing required field', async () => {
  const employee = createMockEmployeeWithLevel(X);
  const request = createMockJsonRequest('POST', 'http://localhost/api-{name}', {
    // Missing required field
  });

  await assertRejects(
    async () => await handlerName(request, employee),
    Error,
    'กรุณาระบุ' // Thai validation error
  );
});

// ============ Mocked Success Tests ============
Deno.test('{handlerName} - success with mocking', async () => {
  const employee = createMockEmployeeWithLevel(X);
  const request = createMockJsonRequest('POST', 'http://localhost/api-{name}', {
    // Valid data
  });

  // Mock the service
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
