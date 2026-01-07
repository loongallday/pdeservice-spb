# Execute SQL Query

Run SQL queries against the Supabase database.

## Usage
```
/sql <query>
```

## Examples
```
/sql SELECT * FROM main_tickets LIMIT 5
/sql SELECT COUNT(*) FROM main_employees
/sql DESCRIBE main_tickets
```

## Common Queries

### List tables
```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' ORDER BY table_name;
```

### Check table structure
```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'main_tickets';
```

### Check function signature
```sql
SELECT pg_get_function_arguments(oid)
FROM pg_proc WHERE proname = 'search_tickets';
```

### Check RLS policies
```sql
SELECT * FROM pg_policies WHERE tablename = 'main_tickets';
```

## Notes
- Use `mcp__supabase__execute_sql` tool
- Results are returned as JSON
- Large results may be truncated
