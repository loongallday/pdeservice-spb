# Setup Admin User - Quick Guide

## 🚀 Quick Setup (Postman)

### Prerequisites

1. **Get Service Role Key**:
   ```bash
   supabase status
   # Copy the "service_role key" value
   ```

2. **Set Postman Environment Variables**:
   - `{{baseUrl}}` - Your Supabase URL (e.g., `http://127.0.0.1:54321` for local)
   - `{{apikey}}` - Supabase anon key
   - `{{serviceRoleKey}}` - Service role key (from step 1)
   - `{{adminEmail}}` - Admin email (e.g., `admin@pdeservice.com`)
   - `{{adminPassword}}` - Secure password

### Method 1: Using Seed SQL + Postman (Recommended)

1. **Run seed.sql**:
   ```bash
   supabase db reset  # Automatically runs seed.sql
   ```

2. **In Postman, open "🔧 Setup - Create Admin User" folder**:
   - **Step 3**: Create Auth User
   - **Step 4**: Link Auth to Employee

   The test scripts will automatically set `{{adminAuthUserId}}` and `{{adminEmployeeId}}`.

3. **Verify**: Run "Verify Admin User" request

### Method 2: Full API Flow (No SQL)

1. **Step 1**: Create Super Admin Role
   - Uses REST API with service role key
   - Auto-sets `{{superAdminRoleId}}`

2. **Step 2**: Create Admin Employee
   - Requires level 2+ auth (use temporary admin or skip if using seed.sql)
   - Auto-sets `{{adminEmployeeId}}`

3. **Step 3**: Create Auth User
   - Uses Supabase Auth Admin API
   - Auto-sets `{{adminAuthUserId}}`

4. **Step 4**: Link Auth to Employee
   - Links the auth user to employee record

5. **Verify**: Run "Verify Admin User" request

## 📋 What Gets Created

- **Role**: `SUPER_ADMIN` (level 10)
  - Code: `SUPER_ADMIN`
  - Name: `ผู้ดูแลระบบสูงสุด` / `Super Administrator`
  - Level: `10` (highest - passes `isSuperAdmin` check which requires >= 3)

- **Employee**: `ADMIN001`
  - Code: `ADMIN001`
  - Name: `System Administrator`
  - Email: Your `{{adminEmail}}`
  - Role: Linked to `SUPER_ADMIN`
  - Auth: Linked to Supabase Auth user

## ✅ Verification

After setup, verify with:

```sql
SELECT 
  e.code,
  e.name,
  e.email,
  e.auth_user_id,
  r.code as role_code,
  r.level,
  CASE 
    WHEN e.auth_user_id IS NOT NULL THEN '✅ Linked'
    ELSE '❌ Not Linked'
  END as auth_status
FROM employees e
JOIN roles r ON e.role_id = r.id
WHERE e.code = 'ADMIN001';
```

Expected result:
- `auth_user_id` should NOT be null
- `role_code` should be `SUPER_ADMIN`
- `level` should be `10`

## 🔐 Login

After setup, you can login with:
- **Email**: `{{adminEmail}}`
- **Password**: `{{adminPassword}}`

Use the "Sign In" request in Postman's "Authentication" folder to get an access token.

## 🛠 Troubleshooting

### "Role already exists" (409)
- The test script automatically fetches the existing role ID
- Check Postman console for the role ID

### "Employee already exists"
- Use "Get Employee by Code" to get the employee ID
- Set `{{adminEmployeeId}}` manually
- Proceed to Step 3

### "Auth user already exists"
- Use "Alternative: Link Existing Auth User" instead of Step 4
- Get auth user ID from Supabase Dashboard > Authentication > Users
- Set `{{adminAuthUserId}}` manually

### Can't create role (403)
- Ensure you're using `{{serviceRoleKey}}` (not anon key)
- Check that service role key is correct

### Can't create employee (403)
- Requires level 2+ auth
- If no admin exists yet, use seed.sql first
- Or use REST API with service role key to bypass

## 📝 Notes

- **Level 10** is used for super admin (code checks for >= 3, so 10 works)
- **Service Role Key** bypasses RLS - use carefully
- **Seed.sql** is idempotent - safe to run multiple times
- **Postman test scripts** auto-set environment variables for you

