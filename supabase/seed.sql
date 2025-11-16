-- =============================================
-- Seed Data: Create Super Admin User
-- Run this after migrations to create initial admin
-- =============================================

-- Create Super Admin Role (if it doesn't exist)
DO $$
DECLARE
  v_super_admin_role_id UUID;
BEGIN
  -- Check if super admin role exists
  SELECT id INTO v_super_admin_role_id
  FROM public.roles
  WHERE code = 'SUPER_ADMIN'
  LIMIT 1;

  -- Create super admin role if it doesn't exist
  IF v_super_admin_role_id IS NULL THEN
    INSERT INTO public.roles (
      code,
      name_th,
      name_en,
      description,
      level,
      is_active,
      requires_auth
    ) VALUES (
      'SUPER_ADMIN',
      'ผู้ดูแลระบบสูงสุด',
      'Super Administrator',
      'Super administrator with full system access (level 10)',
      10,
      true,
      true
    )
    RETURNING id INTO v_super_admin_role_id;
    
    RAISE NOTICE 'Created super admin role with ID: %', v_super_admin_role_id;
  ELSE
    RAISE NOTICE 'Super admin role already exists with ID: %', v_super_admin_role_id;
  END IF;

  -- Create Super Admin Employee (if it doesn't exist)
  IF NOT EXISTS (
    SELECT 1 FROM public.employees WHERE code = 'ADMIN001'
  ) THEN
    INSERT INTO public.employees (
      code,
      name,
      nickname,
      email,
      role_id,
      is_active
    ) VALUES (
      'ADMIN001',
      'System Administrator',
      'Admin',
      'admin@pdeservice.com',  -- Change this email
      v_super_admin_role_id,
      true
    );
    
    RAISE NOTICE 'Created super admin employee with code: ADMIN001';
  ELSE
    RAISE NOTICE 'Super admin employee already exists with code: ADMIN001';
  END IF;
END $$;

-- Display created admin info
SELECT 
  e.id as employee_id,
  e.code as employee_code,
  e.name,
  e.email,
  e.auth_user_id,
  r.code as role_code,
  r.name_th as role_name,
  r.level
FROM public.employees e
JOIN public.roles r ON e.role_id = r.id
WHERE e.code = 'ADMIN001';

