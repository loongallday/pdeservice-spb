# Unit Tests

This directory contains unit tests for all PDE Service APIs.

## Test Structure

```
tests/
├── _shared/              # Shared test utilities and mocks
│   ├── mocks.ts          # Mock data and request builders
│   └── test-utils.ts     # Test assertion helpers
├── api-{resource}/       # Tests for each API
│   ├── handlers.test.ts  # Handler unit tests
│   └── services.test.ts  # Service unit tests
└── README.md             # This file
```

## Running Tests

### Run All Tests
```bash
deno test --allow-all
```

**Note**: If you encounter type checking errors, you can skip type checking:
```bash
deno test --allow-all --no-check
```

### Run Tests for Specific API
```bash
deno test tests/api-appointments/
```

### Run Tests with Coverage
```bash
deno test --coverage=coverage --allow-all
```

### Watch Mode (Auto-run on changes)
```bash
deno test --watch --allow-all
```

## Test Organization

Each API has tests for:
- **Handlers**: Test request/response handling, validation, authorization
- **Services**: Test business logic and database operations (mocked)

## Test Utilities

### Mock Data
- `createMockEmployee()` - Create test employee
- `createMockEmployeeWithLevel()` - Create employee with specific level
- `createMockRequest()` - Create test HTTP request
- `createMockJsonRequest()` - Create JSON request

### Assertions
- `assertSuccessResponse()` - Assert successful response
- `assertErrorResponse()` - Assert error response
- `assertPagination()` - Assert paginated response
- `testAuthorizationLevels()` - Test authorization requirements

## Writing Tests

### Example Handler Test

```typescript
import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { create } from '../../supabase/functions/api-appointments/handlers/create.ts';
import { createMockJsonRequest, createMockEmployeeWithLevel, assertSuccessResponse } from '../_shared/mocks.ts';

Deno.test('create appointment - success', async () => {
  const employee = createMockEmployeeWithLevel(1);
  const request = createMockJsonRequest('POST', 'http://localhost/api-appointments', {
    appointment_type: 'full_day',
    appointment_date: '2025-01-15',
  });

  const response = await create(request, employee);
  const data = await assertSuccessResponse(response, 201);
  
  assertEquals(data.appointment_type, 'full_day');
});
```

### Example Service Test

```typescript
import { assertEquals, assertRejects } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { AppointmentService } from '../../supabase/functions/api-appointments/services/appointmentService.ts';

Deno.test('AppointmentService.getAll - returns paginated results', async () => {
  // Mock Supabase client
  // Test service method
});
```

## Test Coverage Goals

- **Handlers**: 100% coverage of all endpoints
- **Services**: Critical business logic paths
- **Authorization**: All level requirements tested
- **Validation**: All input validation tested
- **Error Handling**: All error paths tested

## Best Practices

1. **Isolate Tests**: Each test should be independent
2. **Mock Dependencies**: Mock Supabase client and external services
3. **Test Edge Cases**: Invalid input, missing data, errors
4. **Test Authorization**: Verify level requirements
5. **Use Descriptive Names**: Test names should describe what they test

## CI/CD Integration

Tests can be integrated into CI/CD pipelines:

```yaml
- name: Run Tests
  run: deno test --allow-all
```

