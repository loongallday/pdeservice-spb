# Core API Documentation & Testing Design

**Date:** 2026-01-18
**Scope:** api-tickets, api-employees, api-appointments
**Goal:** Comprehensive documentation, code smell fixes, and thorough testing without major restructuring

---

## Overview

This design covers improving the three core APIs in pdeservice-spb:

| API | Size | Current State | Main Issues |
|-----|------|---------------|-------------|
| **api-tickets** | 6.7k lines, 17 handlers | Needs work | 1,635-line monolith, mixed concerns, sparse docs |
| **api-employees** | 1.3k lines, 14 handlers | Decent | In-memory cache issue, type safety gaps |
| **api-appointments** | 321 lines, 8 handlers | Clean | Minimal issues, good reference |

### Approach

- **Document and test as-is** - No major refactoring of monoliths
- **Comprehensive test coverage** - All endpoints, edge cases, permission levels
- **MCP verification** - Validate all changes with Supabase MCP tools

---

## Phase Order

1. **api-appointments** - Already clean, establish reference patterns
2. **api-employees** - Medium complexity, fix caching issue
3. **api-tickets** - Largest effort, document thoroughly

---

## Documentation Standards

### JSDoc for Handlers

Every handler file will have a header block:

```typescript
/**
 * @fileoverview List appointments with pagination and filtering
 * @endpoint GET /api-appointments
 * @auth Required - Level 0+ (all authenticated users)
 *
 * @queryParam {number} [page=1] - Page number
 * @queryParam {number} [limit=20] - Items per page
 * @queryParam {string} [status] - Filter by status
 *
 * @returns {PaginatedResponse<Appointment>} List of appointments
 * @throws {AuthenticationError} If not authenticated
 */
```

### JSDoc for Service Methods

Every public service method:

```typescript
/**
 * Creates a new appointment and links it to a ticket
 *
 * @param ticketId - The ticket to attach appointment to
 * @param data - Appointment details (date, time, site)
 * @param employeeId - Creator's employee ID
 * @returns Created appointment with generated ID
 * @throws {NotFoundError} If ticket doesn't exist
 * @throws {ValidationError} If date is in the past
 */
async function createAppointment(
  ticketId: string,
  data: CreateAppointmentInput,
  employeeId: string
): Promise<Appointment>
```

### Inline Comments

For complex logic only - explain "why", not "what":

```typescript
// Skip notification if ticket was created by system (automated imports)
// to avoid spamming assignees with bulk-created tickets
if (ticket.created_by_system) return;
```

### TypeScript Interfaces

Create `/types.ts` in each API folder with request/response types instead of `Record<string, unknown>`.

---

## Code Smell Fixes

### 1. Type Safety

Replace `Record<string, unknown>` with typed interfaces:

```typescript
// Before
async function updateTicket(id: string, data: Record<string, unknown>)

// After
interface UpdateTicketInput {
  status_id?: string;
  assigned_to?: string;
  priority?: 'low' | 'medium' | 'high';
  notes?: string;
}
async function updateTicket(id: string, data: UpdateTicketInput)
```

### 2. Remove Duplicate Queries

Extract repeated lookups into shared helpers:

```typescript
// In _shared/lookups.ts
export async function getEmployeeWithRole(employeeId: string): Promise<EmployeeWithRole>
export async function getTicketWithStatus(ticketId: string): Promise<TicketWithStatus>
```

### 3. Fix Employees Cache (Serverless Issue)

Replace in-memory static cache with request-scoped approach or remove caching entirely.

### 4. Consistent Error Messages

All Thai error messages follow the same pattern:
- `ไม่พบ{resource}` for not found
- `ไม่มีสิทธิ์{action}` for permission denied
- `{field}ไม่ถูกต้อง` for validation errors

### 5. Separate Logging from Business Logic

Move audit logging calls to handler level, not buried in services.

---

## Testing Strategy

### Test File Structure

```
/tests
  /api-appointments
    /handlers
      list.test.ts
      create.test.ts
      update.test.ts
      delete.test.ts
      approve.test.ts
    /services
      appointmentService.test.ts
  /api-employees
    /handlers
      ...
    /services
      employeeService.test.ts
      achievementService.test.ts
  /api-tickets
    /handlers
      ...
    /services
      ticketCrudService.test.ts
      ticketSearchService.test.ts
      commentService.test.ts
      ...
```

### Test Coverage

**Handler Tests** (HTTP layer):
- Correct HTTP status codes (200, 201, 400, 401, 403, 404)
- Response shape matches expected format
- Permission levels enforced (Level 0, 1, 2, 3)
- Pagination works correctly
- Query params parsed correctly

**Service Tests** (business logic):
- Happy path returns expected data
- Validation rejects bad input
- Edge cases (empty arrays, null values, missing relations)
- Error conditions throw correct error types

### Test Patterns

```typescript
Deno.test("createAppointment - rejects past dates", async () => {
  const pastDate = "2020-01-01";
  await assertRejects(
    () => appointmentService.create({ date: pastDate, ... }),
    ValidationError,
    "วันที่ไม่ถูกต้อง"
  );
});

Deno.test("GET /appointments - requires authentication", async () => {
  const res = await fetch(url, { headers: {} }); // no auth
  assertEquals(res.status, 401);
});
```

### Coverage Targets

| Layer | Target | Rationale |
|-------|--------|-----------|
| Handlers | 90%+ | Entry points, must be solid |
| Services | 80%+ | Core logic, some edge cases hard to hit |
| Shared utils | 95%+ | Used everywhere, high leverage |

---

## Execution Plan

### Phase 1: api-appointments (Reference Implementation)

1. Add TypeScript interfaces (`types.ts`)
2. Add JSDoc to all 8 handlers
3. Add JSDoc to `appointmentService.ts` (321 lines)
4. Write handler tests (all endpoints, all permission levels)
5. Write service tests (all methods, edge cases)
6. Verify with MCP - run queries, check logs
7. Update `/doc/api-appointments.md`

### Phase 2: api-employees

1. Add TypeScript interfaces (`types.ts`)
2. Add JSDoc to all 14 handlers
3. Add JSDoc to both services (879 + 416 lines)
4. **Fix static cache issue** - remove or replace with request-scoped
5. Extract duplicate role/department lookups to shared helper
6. Write handler tests (13 endpoints, permission levels, auth linking)
7. Write service tests (employee CRUD, achievements)
8. Verify with MCP
9. Update `/doc/api-employees.md`

### Phase 3: api-tickets

1. Add TypeScript interfaces (`types.ts`) - largest set
2. Add JSDoc to all 17 handlers
3. Add JSDoc to all 15 services (6,759 lines total)
4. Add inline comments to complex sections in `ticketCrudService.ts`
5. Extract shared lookups (employee, ticket, status)
6. Standardize error messages (Thai)
7. Move audit logging to handler level
8. Write handler tests (30+ endpoints)
9. Write service tests (all services, focus on search and CRUD)
10. Verify with MCP - especially search queries
11. Update `/doc/api-tickets.md`

---

## MCP Verification

After each significant change:

- `mcp__supabase__execute_sql` - Test that queries still return expected results
- `mcp__supabase__list_tables` - Verify schema assumptions are correct
- `mcp__supabase__get_logs` - Check for errors after deploying/testing
- `mcp__supabase__get_advisors` - Run security/performance checks

### Verification Checkpoints

After each phase:
- Run `deno test --allow-all` - all tests pass
- `mcp__supabase__get_advisors` - no new security issues
- `mcp__supabase__get_logs` - no errors in API logs

---

## What We Won't Do

- Major refactoring of `ticketCrudService.ts` (document instead)
- New features or behavior changes
- Database schema changes

---

## Deliverables Per API

- Updated source files with JSDoc and comments
- TypeScript interfaces for request/response types
- Test files with >80% coverage target
- Brief API documentation in `/doc/api-{name}.md`
