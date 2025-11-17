# Supabase Database Commands Guide

Complete guide to Supabase CLI database commands: `db push`, `db pull`, and `db reset`.

---

## Overview

Supabase CLI provides three main database commands for managing migrations and schema:

| Command | Purpose | When to Use | Erases Local Data? |
|---------|---------|-------------|-------------------|
| `supabase db push` | Apply local migrations to remote | Deploying changes to production/staging | ❌ **No** |
| `supabase db pull` | Pull remote schema to local | Syncing local with remote changes | ❌ **No** |
| `supabase db reset` | Reset local database | Starting fresh locally, testing migrations | ⚠️ **YES - ERASES ALL LOCAL DATA** |

---

## `supabase db push`

**Applies local migrations to the remote Supabase database.**

### What It Does

- Reads all migration files from `supabase/migrations/`
- Compares with remote migration history
- Applies only new migrations that haven't been run on remote
- Updates remote migration history

### Usage

```bash
# Push all pending migrations to remote
supabase db push

# Push with confirmation prompt
supabase db push --include-all

# Push with debug output
supabase db push --debug
```

### When to Use

✅ **Use when:**
- Deploying new migrations to production/staging
- You've created new migration files locally
- You want to apply schema changes to remote database
- After testing migrations locally

❌ **Don't use when:**
- Remote has migrations you don't have locally (use `db pull` first)
- You're unsure about migration conflicts
- You haven't tested migrations locally

### Example Workflow

```bash
# 1. Create migration locally
supabase migration new add_user_table

# 2. Edit the migration file
# supabase/migrations/20251116_add_user_table.sql

# 3. Test locally
supabase db reset  # Applies all migrations locally

# 4. Push to remote
supabase db push
```

### Common Issues

**Issue: Migration history mismatch**
```
Error: The remote database's migration history does not match local files
```

**Solution:**
```bash
# Pull remote schema first
supabase db pull

# Then push again
supabase db push
```

**Issue: Permission errors**
```
ERROR: must be owner of table...
```

**Solution:**
- Remove statements that modify system tables (e.g., `COMMENT ON TABLE storage.buckets`)
- System tables are managed by Supabase and can't be modified via migrations

---

## `supabase db pull`

**Pulls the current remote database schema and creates a migration file.**

### What It Does

- Connects to remote Supabase database
- Inspects current schema (tables, columns, indexes, policies, etc.)
- Creates a new migration file that represents the current remote state
- Does NOT modify the remote database

### Usage

```bash
# Pull remote schema and create migration
supabase db pull

# Pull with specific schema
supabase db pull --schema public

# Pull with debug output
supabase db pull --debug
```

### When to Use

✅ **Use when:**
- Remote database has changes you don't have locally
- You need to sync local migrations with remote
- Someone else deployed migrations directly to remote
- Starting a new project and want to capture existing schema
- Migration history is out of sync

❌ **Don't use when:**
- You have uncommitted local migrations
- You want to modify the remote database (use `db push` instead)

### Example Workflow

```bash
# Remote has changes you don't have locally
supabase db pull

# This creates: supabase/migrations/YYYYMMDDHHMMSS_remote_schema.sql

# Review the generated migration
# Then you can push your local migrations
supabase db push
```

### Generated Migration File

The generated migration file will contain:
- All tables and their columns
- Indexes
- Foreign key constraints
- RLS policies
- Functions and triggers
- Enums and custom types

**Note:** The generated file may be large. Review it before committing.

### ⚠️ Important: Review Generated Migrations

**Always review migrations created by `db pull` before committing!**

Generated migrations may contain DROP statements that reference tables created in other migrations. This can cause errors when migrations run in order.

**Check for:**
- `DROP POLICY` statements on tables
- References to tables that might not exist yet
- Statements that depend on migration execution order

**Fix before committing:**
- Make DROP statements conditional (see "Preventing Migration Order Issues" section below)

---

## `supabase db reset`

⚠️ **WARNING: This command ERASES ALL LOCAL DATA!**

**Resets the local Supabase database and reapplies all migrations.**

### What It Does

- **⚠️ DROPS** the local database (ALL DATA IS DELETED)
- **Recreates** a fresh empty database
- **Applies** all migrations from `supabase/migrations/` in order
- **Runs** seed file (`supabase/seed.sql`) if it exists
- **Does NOT** affect remote database

### ⚠️ Data Loss Warning

**This command will DELETE:**
- ✅ All tables and their data
- ✅ All records in the database
- ✅ All local-only data (not synced to remote)

**This command will NOT delete:**
- ❌ Migration files (they stay in `supabase/migrations/`)
- ❌ Remote database
- ❌ Edge functions
- ❌ Storage buckets (if created via migrations, they'll be recreated)

### Usage

```bash
# Reset local database
supabase db reset

# Reset without seed file
supabase db reset --no-seed

# Reset with debug output
supabase db reset --debug
```

### When to Use

✅ **Use when:**
- Starting fresh local development
- Testing migrations from scratch
- You've modified migration files and want to test them
- Local database is in a bad state
- You want to ensure migrations work correctly in order
- **You don't need any of your local data**

❌ **⚠️ DON'T use when:**
- **You have important local data you want to keep** (IT WILL BE DELETED)
- You're working on the remote database (this only affects local)
- You have test data you haven't backed up
- You're unsure if you need the local data

### Example Workflow

```bash
# 1. Create a new migration
supabase migration new add_feature_table

# 2. Edit the migration file
# supabase/migrations/20251116_add_feature_table.sql

# 3. Test the migration locally
supabase db reset

# 4. Verify everything works
# 5. Push to remote
supabase db push
```

### What Gets Reset (DELETED)

⚠️ **ALL OF THESE ARE PERMANENTLY DELETED:**
- ✅ All tables and **ALL their data**
- ✅ All records in every table
- ✅ All local-only data (not synced to remote)
- ✅ All test data you've created locally
- ✅ All seed data (will be recreated from `seed.sql` if it exists)

### What Doesn't Get Reset

- ❌ Migration files (they stay in `supabase/migrations/`)
- ❌ Remote database (completely unaffected)
- ❌ Edge functions
- ❌ Storage buckets (if created via migrations, they'll be recreated, but files in them may be lost)

---

## Migration File Naming

Supabase migrations are named with timestamps:

```
YYYYMMDDHHMMSS_description.sql
```

**Example:**
```
20251116234607_create_storage_buckets.sql
```

**Important:**
- Migration files are applied in chronological order
- Never rename migration files after they've been pushed to remote
- Never modify existing migration files that have been applied to remote

---

## Preventing Migration Order Issues

### The Problem

When `db pull` generates a migration, it captures the current state of the remote database. If that state includes policies on tables that are created in a different migration file, you can get errors like:

```
ERROR: relation "public.app_configuration" does not exist
At statement: 1
drop policy "delete_policy" on "public"."app_configuration"
```

### Why It Happens

1. **Migration Order**: Migrations run in chronological order (by timestamp)
2. **Policy Dependencies**: Policies depend on tables existing
3. **Generated Migrations**: `db pull` generates migrations that may reference tables created in other migrations

### How to Prevent

#### 1. Review Generated Migrations

**Always review migrations created by `db pull` before committing:**

```bash
# After running db pull
git diff supabase/migrations/YYYYMMDD_remote_schema.sql

# Check for:
# - DROP POLICY statements on tables
# - References to tables that might not exist yet
```

#### 2. Make DROP Statements Conditional

**If a migration drops policies, make it conditional:**

```sql
-- ❌ BAD: Will fail if table doesn't exist
DROP POLICY "delete_policy" ON "public"."app_configuration";

-- ✅ GOOD: Safe - checks if table exists first
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables 
             WHERE table_schema = 'public' 
             AND table_name = 'app_configuration') THEN
    DROP POLICY IF EXISTS "delete_policy" ON "public"."app_configuration";
  END IF;
END $$;
```

#### 3. Use Permanent Helper Functions

**⚠️ IMPORTANT: We have permanent helper functions in the database!**

Starting from migration `20251116172457_add_policy_helper_functions.sql`, we have permanent helper functions available:

- `drop_policies_if_table_exists(table_name, policy_names[])` - Safely drops policies
- `create_policy_if_table_exists(policy_name, table_name, policy_definition)` - Safely creates policies

**These functions are always available in the database**, so you don't need to create them in each migration.

**For dropping multiple policies:**

```sql
-- ✅ GOOD: Use the permanent helper function
SELECT drop_policies_if_table_exists('app_configuration', 
  ARRAY['delete_policy', 'insert_policy', 'select_policy', 'update_policy']);
```

**For creating policies:**

```sql
-- ✅ GOOD: Use the permanent helper function
SELECT create_policy_if_table_exists(
  'delete_app_config',
  'app_configuration',
  'AS PERMISSIVE FOR DELETE TO authenticated USING (public.user_has_min_level(2))'
);
```

**⚠️ Limitation: `db pull` Still Generates Raw SQL**

Unfortunately, `supabase db pull` generates raw SQL based on the current database state, not the migration history. This means:

- ✅ **Your own migrations**: Use the helper functions - they're safe!
- ❌ **Generated migrations from `db pull`**: Will still contain raw `CREATE POLICY` and `DROP POLICY` statements that need manual fixing

**Why We Can't Make It Automatic:**

1. **`supabase db pull` is a Supabase CLI tool** - We can't modify it
2. **It generates SQL from database state** - Not from migration history
3. **It doesn't know migration order** - So it can't add safety checks
4. **It's a one-way sync** - Database → SQL file, not the other way

**Solution: Automated Fix Script**

We have a script that automatically fixes generated migrations:

```powershell
# After running db pull
.\scripts\fix-db-pull-migration.ps1 -MigrationFile "supabase/migrations/YYYYMMDD_remote_schema.sql"
```

The script automatically:
- Adds the helper function if needed
- Converts `DROP POLICY` statements to use the helper function
- Wraps `CREATE POLICY` statements in conditional blocks

**Manual Workflow (if script doesn't work):**

1. Run `supabase db pull`
2. Run the fix script: `.\scripts\fix-db-pull-migration.ps1 -MigrationFile "supabase/migrations/YYYYMMDD_remote_schema.sql"`
3. Review the changes
4. Test with `supabase db reset`

#### 4. Check Migration Order

**Before pushing, verify migration order:**

```bash
# List migrations in order
ls -1 supabase/migrations/ | sort

# Check which migration creates which tables
grep -r "CREATE TABLE" supabase/migrations/
```

#### 5. Test Migrations Locally

**Always test migrations locally before pushing:**

```bash
# Reset local database (applies all migrations in order)
supabase db reset

# If it works locally, it should work on remote
# If it fails, fix the migration before pushing
```

#### 6. Structure Migrations Properly

**Best practice migration structure:**

```
20251116_001_create_tables.sql      # Creates tables
20251116_002_create_indexes.sql     # Creates indexes
20251116_003_create_policies.sql    # Creates policies (tables must exist)
20251116_004_update_policies.sql     # Updates policies (safe to drop/create)
```

**Avoid:**
- Dropping policies before tables exist
- Creating policies before tables exist
- Mixing table creation and policy management in ways that create dependencies

### Quick Fix Template

**When you see this error, use this template:**

```sql
-- Replace direct DROP POLICY with conditional version
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables 
             WHERE table_schema = 'public' 
             AND table_name = 'YOUR_TABLE_NAME') THEN
    DROP POLICY IF EXISTS "policy_name" ON "public"."YOUR_TABLE_NAME";
  END IF;
END $$;
```

### Checklist Before Pushing Migrations

- [ ] Reviewed generated migration files from `db pull`
- [ ] All DROP statements are conditional (check if table exists)
- [ ] Tested migrations locally with `db reset`
- [ ] Migration order makes sense (tables before policies)
- [ ] No hard dependencies on migration execution order

---

## Best Practices

### 1. Always Test Locally First

```bash
# Test migration locally
supabase db reset

# Verify it works
# Then push to remote
supabase db push
```

### 2. Keep Migrations Small and Focused

✅ **Good:**
```
20251116_add_user_table.sql
20251116_add_user_indexes.sql
20251116_add_user_policies.sql
```

❌ **Bad:**
```
20251116_add_everything.sql  # Too large, hard to review
```

### 3. Never Modify Applied Migrations

Once a migration is pushed to remote, **never modify it**. Instead:
- Create a new migration to fix issues
- Or use `supabase migration repair` if needed

### 4. Sync Before Pushing

```bash
# Check if remote has changes
supabase migration list

# If out of sync, pull first
supabase db pull

# Then push
supabase db push
```

### 5. Use Version Control

- ✅ Commit migration files to Git
- ✅ Review migrations in PRs
- ✅ Never skip migrations in production

---

## Common Workflows

### Workflow 1: Creating a New Feature

```bash
# 1. Create migration
supabase migration new add_tickets_table

# 2. Edit migration file
# supabase/migrations/YYYYMMDD_add_tickets_table.sql

# 3. Test locally
supabase db reset

# 4. Verify it works
# 5. Commit to Git
git add supabase/migrations/
git commit -m "feat: add tickets table"

# 6. Push to remote
supabase db push
```

### Workflow 2: Syncing with Remote

```bash
# Remote has changes you don't have
supabase db pull

# Review generated migration
# Commit it
git add supabase/migrations/
git commit -m "chore: sync with remote schema"

# Now you can push your local changes
supabase db push
```

### Workflow 3: Starting Fresh

```bash
# Reset local database
supabase db reset

# This applies all migrations from scratch
# Good for testing the full migration history
```

---

## Troubleshooting

### Issue: Migration Already Applied

```
Error: migration 20251116_xxx already applied
```

**Solution:**
```bash
# Check migration status
supabase migration list

# If migration is already on remote, don't push it again
# Or repair if needed
supabase migration repair --status reverted <timestamp>
```

### Issue: Migration Conflicts

```
Error: Migration history mismatch
```

**Solution:**
```bash
# Pull remote schema
supabase db pull

# Review conflicts
# Resolve manually if needed
# Then push
supabase db push
```

### Issue: Permission Errors

```
ERROR: must be owner of table storage.buckets
```

**Solution:**
- Remove statements that modify system tables
- System tables (like `storage.buckets`) are managed by Supabase
- You can INSERT into them, but can't ALTER or COMMENT

### Issue: Command Hangs

If `supabase db push` or `supabase migration list` hangs:

1. **Check network connection**
2. **Verify you're logged in:**
   ```bash
   supabase login
   ```
3. **Check project link:**
   ```bash
   supabase projects list
   ```
4. **Try with debug:**
   ```bash
   supabase db push --debug
   ```

---

## Command Comparison

| Aspect | `db push` | `db pull` | `db reset` |
|--------|-----------|-----------|------------|
| **Target** | Remote | Local | Local |
| **Direction** | Local → Remote | Remote → Local | N/A (recreates) |
| **Modifies Remote** | ✅ Yes | ❌ No | ❌ No |
| **Modifies Local** | ❌ No | ✅ Yes | ✅ Yes |
| **Erases Local Data** | ❌ No | ❌ No | ⚠️ **YES - ALL DATA** |
| **Creates Files** | ❌ No | ✅ Yes | ❌ No |
| **Applies Migrations** | ✅ Yes | ❌ No | ✅ Yes |
| **Safe for Production** | ✅ Yes (with care) | ✅ Yes | ❌ No (local only) |
| **Data Loss Risk** | ❌ None | ❌ None | ⚠️ **HIGH - All local data** |

---

## Additional Commands

### Check Migration Status

```bash
# List all migrations and their status
supabase migration list
```

### Repair Migration History

```bash
# Mark a migration as reverted
supabase migration repair --status reverted <timestamp>

# Mark a migration as applied
supabase migration repair --status applied <timestamp>
```

### Link to Remote Project

```bash
# Link to remote project
supabase link --project-ref <your-project-ref>

# Find project ref in Supabase Dashboard
# Project Settings → General → Reference ID
```

---

## Summary

- **`db push`**: Deploy local migrations to remote (production)
  - ❌ Does NOT erase local data
- **`db pull`**: Sync remote schema to local (development)
  - ❌ Does NOT erase local data
- **`db reset`**: Reset local database (testing)
  - ⚠️ **ERASES ALL LOCAL DATA** - Use with caution!

**Golden Rule:** Always test migrations locally with `db reset` before pushing to remote with `db push`.

**⚠️ Important:** `db reset` will permanently delete all your local database data. Make sure you don't need it before running this command!

