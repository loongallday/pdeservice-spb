-- Setup test data for admin@test.com
-- Run this in Supabase Studio SQL Editor: http://127.0.0.1:54323

-- 1. Create test department
INSERT INTO departments (code, name_th, name_en, description)
VALUES ('IT', 'ไอที', 'IT Department', 'Information Technology')
ON CONFLICT (code) DO NOTHING;

-- 2. Create admin role
INSERT INTO roles (code, name_th, name_en, name, level, description, requires_auth)
VALUES ('ADMIN', 'ผู้ดูแลระบบ', 'Administrator', 'Administrator', 99, 'System Administrator', true)
ON CONFLICT (code) DO NOTHING;

-- 3. Create employee record for admin@test.com
INSERT INTO employees (
  auth_user_id,
  code,
  name,
  nickname,
  email,
  role_id,
  is_active
)
SELECT 
  '34782700-368a-448f-bc2c-352d95601780'::uuid,  -- admin@test.com user ID
  'ADMIN001',
  'Admin User',
  'Admin',
  'admin@test.com',
  (SELECT id FROM roles WHERE code = 'ADMIN'),
  true
WHERE NOT EXISTS (
  SELECT 1 FROM employees WHERE auth_user_id = '34782700-368a-448f-bc2c-352d95601780'::uuid
);

-- Verify setup
SELECT 
  e.id,
  e.code,
  e.name,
  e.email,
  r.code as role_code,
  r.level as role_level,
  e.is_active
FROM employees e
LEFT JOIN roles r ON e.role_id = r.id
WHERE e.auth_user_id = '34782700-368a-448f-bc2c-352d95601780'::uuid;

