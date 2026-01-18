-- Migration: Change appointment approval from role-based to user-based
-- Created: 2025-12-24
-- Description: Creates appointment_approval_users table, migrates existing data from roles to users, and drops old table

-- Step 1: Create appointment_approval_users table
CREATE TABLE IF NOT EXISTS public.appointment_approval_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add foreign key constraint
ALTER TABLE public.appointment_approval_users
  ADD CONSTRAINT appointment_approval_users_employee_id_fkey 
  FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;

-- Add unique constraint to prevent duplicate employee entries
CREATE UNIQUE INDEX IF NOT EXISTS idx_appointment_approval_users_employee_id_unique 
  ON public.appointment_approval_users(employee_id);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_appointment_approval_users_employee_id 
  ON public.appointment_approval_users(employee_id);

-- Step 2: Migrate existing data from roles to users
-- For each role in appointment_approval_roles, find all active employees with that role_id
-- and insert them into appointment_approval_users
INSERT INTO public.appointment_approval_users (employee_id)
SELECT DISTINCT e.id
FROM public.employees e
INNER JOIN public.appointment_approval_roles aar ON e.role_id = aar.role_id
WHERE e.is_active = true
ON CONFLICT (employee_id) DO NOTHING;

-- Step 3: Enable RLS
ALTER TABLE public.appointment_approval_users ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Level 0+ can read (view which users can approve appointments)
CREATE POLICY "Users can read appointment approval users"
  ON public.appointment_approval_users
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM employees e
      LEFT JOIN roles r ON e.role_id = r.id
      WHERE e.auth_user_id = auth.uid()
      AND e.is_active = true
      AND COALESCE(r.level, 0) >= 0
    )
  );

-- Level 2+ can insert (add users that can approve)
CREATE POLICY "Level 2+ can insert appointment approval users"
  ON public.appointment_approval_users
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM employees e
      LEFT JOIN roles r ON e.role_id = r.id
      WHERE e.auth_user_id = auth.uid()
      AND e.is_active = true
      AND COALESCE(r.level, 0) >= 2
    )
  );

-- Level 2+ can update
CREATE POLICY "Level 2+ can update appointment approval users"
  ON public.appointment_approval_users
  FOR UPDATE
  USING (
    auth.uid() IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM employees e
      LEFT JOIN roles r ON e.role_id = r.id
      WHERE e.auth_user_id = auth.uid()
      AND e.is_active = true
      AND COALESCE(r.level, 0) >= 2
    )
  )
  WITH CHECK (
    auth.uid() IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM employees e
      LEFT JOIN roles r ON e.role_id = r.id
      WHERE e.auth_user_id = auth.uid()
      AND e.is_active = true
      AND COALESCE(r.level, 0) >= 2
    )
  );

-- Level 2+ can delete (remove users from approval list)
CREATE POLICY "Level 2+ can delete appointment approval users"
  ON public.appointment_approval_users
  FOR DELETE
  USING (
    auth.uid() IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM employees e
      LEFT JOIN roles r ON e.role_id = r.id
      WHERE e.auth_user_id = auth.uid()
      AND e.is_active = true
      AND COALESCE(r.level, 0) >= 2
    )
  );

-- Add comments
COMMENT ON TABLE public.appointment_approval_users IS 'Table defining which users/employees have permission to approve appointments';
COMMENT ON COLUMN public.appointment_approval_users.employee_id IS 'Reference to the employee that can approve appointments';
COMMENT ON COLUMN public.appointment_approval_users.created_at IS 'Timestamp when this user was granted approval permission';
COMMENT ON COLUMN public.appointment_approval_users.updated_at IS 'Timestamp when this record was last updated';

-- Step 4: Drop old table (CASCADE will handle constraints and policies)
DROP TABLE IF EXISTS public.appointment_approval_roles CASCADE;

