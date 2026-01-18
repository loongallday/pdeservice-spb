# Execute SQL Query

Run SQL queries against the Supabase database using MCP.

## Usage
```
/sql <query>
```

## Examples
```
/sql SELECT * FROM main_tickets LIMIT 5
/sql SELECT COUNT(*) FROM main_employees WHERE is_active = true
/sql SELECT * FROM ref_work_types ORDER BY name_th
```

## Common Queries

### Tables & Schema

```sql
-- List all tables
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' ORDER BY table_name;

-- Table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'main_tickets'
ORDER BY ordinal_position;

-- Table row counts
SELECT relname, n_live_tup
FROM pg_stat_user_tables
ORDER BY n_live_tup DESC;
```

### Functions

```sql
-- List functions
SELECT proname, pg_get_function_arguments(oid)
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace;

-- Function definition
SELECT pg_get_functiondef(oid)
FROM pg_proc WHERE proname = 'search_tickets';
```

### RLS Policies

```sql
-- List policies for table
SELECT * FROM pg_policies WHERE tablename = 'main_tickets';

-- All policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies WHERE schemaname = 'public';
```

### Data Queries

```sql
-- Recent tickets
SELECT id, ticket_code, work_type_id, created_at
FROM main_tickets ORDER BY created_at DESC LIMIT 10;

-- Employee by role
SELECT e.name, r.name_th as role, r.level
FROM main_employees e
JOIN main_org_roles r ON e.role_id = r.id
ORDER BY r.level DESC;

-- Tickets by status
SELECT s.name_th, COUNT(*)
FROM main_tickets t
JOIN ref_ticket_statuses s ON t.status_id = s.id
GROUP BY s.name_th;
```

### Reference Data

```sql
-- Work types
SELECT id, code, name_th FROM ref_work_types;

-- Statuses
SELECT id, code, name_th FROM ref_ticket_statuses;

-- Leave types
SELECT id, code, name_th FROM ref_leave_types;

-- Provinces
SELECT id, name_th FROM ref_provinces ORDER BY name_th;
```

### Indexes & Performance

```sql
-- List indexes
SELECT indexname, indexdef
FROM pg_indexes WHERE schemaname = 'public';

-- Table sizes
SELECT relname, pg_size_pretty(pg_total_relation_size(relid))
FROM pg_catalog.pg_statio_user_tables
ORDER BY pg_total_relation_size(relid) DESC;
```

## MCP Tool
Uses `mcp__supabase__execute_sql`

## Notes
- Results returned as JSON
- Large results may be truncated
- Use LIMIT for large tables
- Read-only queries recommended (use migrations for DDL)
