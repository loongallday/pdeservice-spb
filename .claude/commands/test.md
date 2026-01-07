# Run Tests

Run Deno tests for the project.

## Usage
```
/test [api-name]
```

## Examples
```
/test                    # Run all tests
/test api-tickets        # Run ticket API tests
/test api-employees      # Run employee API tests
```

## Commands
```bash
# All tests
deno test --allow-all

# Specific API
deno test tests/api-tickets/ --allow-all

# Watch mode
deno test --watch --allow-all

# With coverage
deno test --coverage=coverage --allow-all
```
