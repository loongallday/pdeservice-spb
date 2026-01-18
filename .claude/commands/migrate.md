# Create Database Migration

Create and apply database migrations using Supabase CLI.

## Usage
```
/migrate <migration-name>
```

## Examples
```
/migrate add_user_status
/migrate create_audit_table
/migrate fix_search_tickets_join
```

## Steps

### 1. Create Migration File
```bash
npx supabase migration new <migration_name_in_snake_case>
```
Creates: `supabase/migrations/YYYYMMDDHHMMSS_<migration_name>.sql`

### 2. Edit the SQL File
Write your DDL statements in the created file.

### 3. Test Locally (Recommended)
```bash
supabase db reset --no-seed
# Then seed test data
psql postgresql://postgres:postgres@localhost:54322/postgres -f supabase/seeds/20260118080000_seed_reference_data.sql
```

### 4. Push to Remote
```bash
npx supabase db push --linked
```

### 5. Verify
```bash
npx supabase migration list
```

## Naming Conventions
- Use `snake_case`
- Be descriptive with prefixes:
  - `add_` - Adding columns/constraints
  - `create_` - Creating tables/functions
  - `update_` - Modifying existing structures
  - `fix_` - Bug fixes
  - `remove_` - Dropping objects
  - `seed_` - Data seeding

## Examples
```
add_appointment_is_approved_filter
create_employee_audit_table
fix_search_tickets_department_join
remove_deprecated_columns
update_ticket_status_constraint
```

## Table Naming Conventions
| Prefix | Purpose | Example |
|--------|---------|---------|
| `main_` | Core entities | `main_tickets` |
| `ref_` | Reference/lookup | `ref_statuses` |
| `child_` | Dependent (1:N) | `child_comments` |
| `jct_` | Junction (M:N) | `jct_ticket_employees` |
| `ext_` | Extension (1:1) | `ext_specifications` |
| `addon_` | Add-on features | `addon_achievements` |

## Important Notes
- **Use CLI, NOT MCP `apply_migration`** - CLI creates local files that sync with git
- Always use `timestamptz` for datetime fields
- All PKs should be UUID
- Enable RLS on new tables
- Grant permissions to `authenticated` and `service_role`
