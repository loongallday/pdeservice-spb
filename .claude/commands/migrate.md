# Create Database Migration

Create and apply a new database migration.

## Usage
```
/migrate <migration-name> <sql-content>
```

## Examples
```
/migrate add_user_status "ALTER TABLE main_employees ADD COLUMN status VARCHAR(20)"
/migrate create_audit_table
```

## Steps
1. Create migration file: `npx supabase migration new <name>`
2. Write SQL to the migration file
3. Apply via MCP: `mcp__supabase__apply_migration`
4. Verify with: `mcp__supabase__list_migrations`

## Naming Convention
- Use `snake_case`
- Be descriptive: `add_`, `create_`, `update_`, `fix_`, `remove_`
- Examples:
  - `add_appointment_is_approved_filter`
  - `create_employee_audit_table`
  - `fix_search_tickets_join`
