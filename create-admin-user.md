# Create Super Admin User

This guide shows how to create a super admin user with full system access.

## Quick Start (Recommended)

**Use Postman Collection** - See "🔧 Setup - Create Admin User" folder in Postman collection.

**Or use SQL seed file** - Run `supabase/seed.sql` then link auth user.

## Option 1: Using Postman Collection (Easiest)

### Prerequisites

Set these environment variables in Postman:
- `{{baseUrl}}` - Your Supabase URL
- `{{apikey}}` - Supabase anon key
- `{{serviceRoleKey}}` - Supabase service role key (for admin operations)
- `{{adminEmail}}` - Admin email (e.g., `admin@pdeservice.com`)
- `{{adminPassword}}` - Admin password

### Steps

1. **Run seed.sql first** (creates role + employee without auth):
   ```bash
   supabase db reset  # Runs seed.sql automatically
   ```

2. **Get Super Admin Role ID**:
   ```sql
   SELECT id FROM roles WHERE code = 'SUPER_ADMIN';
   ```
   Set `{{superAdminRoleId}}` in Postman environment.

3. **In Postman, run "🔧 Setup - Create Admin User" folder**:
   - **Step 3**: Create Auth User (uses service role key)
   - **Step 4**: Link Auth to Employee

### Alternative: Full API Flow

If you don't want to use seed.sql:

1. **Step 1**: Create Super Admin Role (uses REST API with service role key)
2. **Step 2**: Create Admin Employee (requires level 2+ auth - use temporary admin or service role)
3. **Step 3**: Create Auth User
4. **Step 4**: Link Auth to Employee

## Option 2: Using SQL Seed File

### Step 1: Run the seed file

```bash
# For local development
supabase db reset  # This will run seed.sql automatically

# Or run seed manually
psql -h localhost -U postgres -d postgres -f supabase/seed.sql
```

### Step 2: Create Auth User and Link

After running the seed file, you need to:

1. **Create the auth user** via Supabase Dashboard or API:
   - Go to Authentication > Users > Add User
   - Email: `admin@pdeservice.com` (or the email you set in seed.sql)
   - Password: Set a secure password
   - Copy the User ID (UUID)

2. **Link the auth user to employee**:

```sql
-- Replace 'AUTH_USER_ID_HERE' with the actual auth user ID from step 1
UPDATE public.employees
SET auth_user_id = 'AUTH_USER_ID_HERE'
WHERE code = 'ADMIN001';
```

## Option 2: Using Supabase CLI (Local Only)

For local development, you can create the auth user via CLI:

```bash
# Create auth user
supabase auth users create admin@pdeservice.com --password "YourSecurePassword"

# Get the user ID from the output, then link it:
# UPDATE public.employees SET auth_user_id = '<user-id>' WHERE code = 'ADMIN001';
```

## Option 3: Complete SQL Script (Manual)

If you prefer to do everything manually:

```sql
-- 1. Create Super Admin Role
INSERT INTO public.roles (
  code, name_th, name_en, description, level, is_active, requires_auth
) VALUES (
  'SUPER_ADMIN',
  'ผู้ดูแลระบบสูงสุด',
  'Super Administrator',
  'Super administrator with full system access (level 10)',
  10,
  true,
  true
) ON CONFLICT (code) DO NOTHING;

-- 2. Create Admin Employee
INSERT INTO public.employees (
  code, name, nickname, email, role_id, is_active
)
SELECT 
  'ADMIN001',
  'System Administrator',
  'Admin',
  'admin@pdeservice.com',
  r.id,
  true
FROM public.roles r
WHERE r.code = 'SUPER_ADMIN'
ON CONFLICT (code) DO NOTHING;

-- 3. After creating auth user, link it:
-- UPDATE public.employees 
-- SET auth_user_id = '<auth-user-id-from-supabase>'
-- WHERE code = 'ADMIN001';
```

## Verification

After linking the auth user, verify the admin user:

```sql
SELECT 
  e.code,
  e.name,
  e.email,
  e.auth_user_id,
  r.code as role_code,
  r.level,
  CASE 
    WHEN e.auth_user_id IS NOT NULL THEN 'Linked'
    ELSE 'Not Linked'
  END as auth_status
FROM public.employees e
JOIN public.roles r ON e.role_id = r.id
WHERE e.code = 'ADMIN001';
```

## Default Credentials

- **Employee Code**: `ADMIN001`
- **Email**: `admin@pdeservice.com` (change in seed.sql)
- **Role Level**: `10` (Super Admin - highest level)
- **Password**: Set when creating auth user

## Security Notes

1. **Change the default email** in `seed.sql` before running
2. **Use a strong password** when creating the auth user
3. **Enable 2FA** for the admin account in production
4. **Don't commit** the actual auth user password to git

## Troubleshooting

### Auth user not linking?
- Verify the auth user ID is correct (UUID format)
- Check that the employee record exists: `SELECT * FROM employees WHERE code = 'ADMIN001';`
- Ensure RLS policies allow the update (may need to run as service role)

### Can't login?
- Verify `auth_user_id` is set: `SELECT auth_user_id FROM employees WHERE code = 'ADMIN001';`
- Check employee is active: `SELECT is_active FROM employees WHERE code = 'ADMIN001';`
- Verify role level: `SELECT level FROM roles WHERE code = 'SUPER_ADMIN';`

