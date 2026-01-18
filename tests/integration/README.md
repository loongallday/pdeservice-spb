# Integration Tests

These tests require a database connection and should be run against a test database.

## Setup

1. Set environment variables:
   ```bash
   export SUPABASE_URL="your-test-supabase-url"
   export SUPABASE_SERVICE_ROLE_KEY="your-test-service-role-key"
   ```

2. Run integration tests:
   ```bash
   deno test tests/integration/ --allow-all --no-lock
   ```

## Test Structure

- `api-*.integration.test.ts` - Full end-to-end API tests
- Each test file tests complete request/response cycles

## Notes

- These tests modify database state
- Use a separate test database or clean up after tests
- Run with `--parallel=1` to avoid race conditions
