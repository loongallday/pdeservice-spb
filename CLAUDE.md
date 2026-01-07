# CLAUDE.md - Project Instructions for Claude Code

## Project Overview

**pdeservice-spb** is a Field Service Management & Workforce Scheduling backend system for managing UPS service operations including tickets, appointments, employees, and equipment.

### Tech Stack
- **Runtime**: Deno (TypeScript)
- **Database**: PostgreSQL via Supabase
- **API**: Supabase Edge Functions (REST)
- **Auth**: JWT + Supabase Auth

---

## Project Structure

```
/supabase
  /functions
    /api-*                 # 18 Edge Functions (main APIs)
    /_shared               # Shared utilities (auth, cors, validation, response, error)
  /migrations              # Database migrations (SQL)
  /seed.sql               # Database seed data

/tests                     # Deno test files
/doc                       # API and database documentation
/postman                   # Postman collection
/scripts                   # Utility scripts
/resource                  # Reference data (Thai provinces, districts)
```

---

## Database Conventions

### Table Naming
| Prefix | Purpose | Example |
|--------|---------|---------|
| `main_` | Core entities | `main_tickets`, `main_employees` |
| `ref_` | Reference/lookup tables | `ref_ticket_statuses`, `ref_provinces` |
| `child_` | Dependent tables (1:N) | `child_site_contacts` |
| `jct_` | Junction tables (M:N) | `jct_ticket_employees` |
| `ext_` | Extension tables (1:1) | `ext_model_specifications` |
| `addon_` | Add-on features | `addon_employee_achievements` |

### Key Tables
- `main_tickets` - Work orders
- `main_employees` - Workforce (linked to auth.users)
- `main_appointments` - Scheduling
- `main_sites` - Customer locations
- `main_companies` - Company data
- `main_org_roles` - Roles with permission levels (0-3)
- `main_org_departments` - Organizational units

---

## API Patterns

### Edge Function Structure
```typescript
// /supabase/functions/api-{resource}/index.ts
Deno.serve(async (req) => {
  // 1. CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  // 2. Authentication
  const { employee } = await authenticate(req);

  // 3. Route by method + path
  const url = new URL(req.url);
  const method = req.method;
  const pathSegments = parsePathSegments(url);

  // 4. Dispatch to handlers
  switch (method) {
    case "GET": return handleGet(req, employee, pathSegments);
    case "POST": return handlePost(req, employee, pathSegments);
    // ...
  }
});
```

### Shared Utilities (`_shared/`)
| Module | Purpose |
|--------|---------|
| `auth.ts` | JWT auth, `authenticate()`, `requireMinLevel()` |
| `cors.ts` | `handleCors()` for preflight |
| `error.ts` | `NotFoundError`, `ValidationError`, `DatabaseError` |
| `response.ts` | `success()`, `successWithPagination()`, `error()` |
| `validation.ts` | `parsePaginationParams()`, input validation |
| `supabase.ts` | `createServiceClient()`, `createUserClient()` |

### Authorization Levels
| Level | Role | Capabilities |
|-------|------|--------------|
| 0 | Technician L1 | Read-only |
| 1 | Assigner, PM, Sales | Create/Update |
| 2 | Admin | User management |
| 3 | Superadmin | Full access |

---

## Commands

### Development
```bash
# Start local Supabase (requires Docker)
supabase start

# Serve functions locally
supabase functions serve

# Stop local Supabase
supabase stop
```

### Testing
```bash
# Run all tests
deno test --allow-all

# Run specific API tests
deno test tests/api-tickets/

# Watch mode
deno test --watch --allow-all
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
# Create new migration
npx supabase migration new <migration_name>

# Push migrations to remote
npx supabase db push

# Pull remote schema
npx supabase db pull
```

---

## Code Style Guidelines

### TypeScript/Deno
- Use TypeScript strict mode
- Prefer `const` over `let`
- Use explicit return types for functions
- Handle all errors with try/catch
- Use Thai language for user-facing error messages

### Database Functions
- Use `SECURITY DEFINER` for RPC functions
- Always grant permissions to `authenticated` and `service_role`
- Add comments to functions with `COMMENT ON FUNCTION`
- Use `snake_case` for all SQL identifiers

### API Responses
```typescript
// Success
{ "data": { ... } }

// Success with pagination
{
  "data": {
    "data": [...],
    "pagination": { "page": 1, "limit": 20, "total": 100, ... }
  }
}

// Error
{ "error": "ข้อความภาษาไทย" }
```

---

## MCP Integration

This project uses Supabase MCP for database operations:

```json
// .mcp.json
{
  "mcpServers": {
    "supabase": {
      "type": "http",
      "url": "https://mcp.supabase.com/mcp?project_ref=ogzyihacqbasolfxymgo"
    }
  }
}
```

### Available MCP Tools
- `mcp__supabase__execute_sql` - Run SQL queries (read-only recommended)
- `mcp__supabase__list_tables` - List database tables
- `mcp__supabase__list_migrations` - List applied migrations
- `mcp__supabase__get_logs` - Get service logs
- `mcp__supabase__search_docs` - Search Supabase documentation

**Note**: Do NOT use `mcp__supabase__apply_migration` - use CLI instead (see "Adding a Database Migration")

---

## Common Tasks

### Adding a New API Endpoint
1. Create handler in `/supabase/functions/api-{resource}/handlers/`
2. Add route in `/supabase/functions/api-{resource}/index.ts`
3. Create service in `/services/` if needed
4. Add tests in `/tests/api-{resource}/`
5. Deploy: `npx supabase functions deploy api-{resource} --no-verify-jwt --project-ref ogzyihacqbasolfxymgo`

### Adding a Database Migration
**IMPORTANT: Always use Supabase CLI for migrations, NOT MCP `apply_migration`**

1. Create migration file:
   ```bash
   npx supabase migration new <migration_name_in_snake_case>
   ```

2. Edit the SQL file in `/supabase/migrations/`

3. Push to remote database:
   ```bash
   npx supabase db push --linked
   ```

4. Verify migration was applied:
   ```bash
   npx supabase migration list
   ```

**Why CLI over MCP?**
- CLI creates local migration files that sync with git
- MCP `apply_migration` creates migrations only in remote, causing sync issues
- `supabase db pull` won't work properly if local files are missing

### Modifying Search Functions
The main search function is `search_tickets` in the database. To modify:
1. Create migration with `DROP FUNCTION IF EXISTS` + `CREATE OR REPLACE FUNCTION`
2. Update service layer if parameters change
3. Deploy the edge function

---

## Work Types Reference

| Code | Name | Thai |
|------|------|------|
| `account` | Account | บัญชี/วางบิล |
| `pm` | PM | บำรุงรักษา |
| `rma` | RMA | เคลม/ซ่อม |
| `sales` | Sales | ขาย/ติดตั้ง |
| `start_up` | Start UP | เริ่มระบบ |
| `survey` | Survey | สำรวจ |
| `pickup` | Package | รับ-ส่งเครื่อง |
| `ags_battery` | AGS | แบตเตอรี่ AGS |

---

## Important Notes

1. **Thai Localization**: Error messages should be in Thai
2. **UUIDs**: All primary keys use UUID type
3. **Timestamps**: Use `timestamptz` for all datetime fields
4. **Soft Delete**: Not implemented - use hard delete
5. **RLS**: Row Level Security is enabled on all tables
6. **Project Ref**: `ogzyihacqbasolfxymgo`
