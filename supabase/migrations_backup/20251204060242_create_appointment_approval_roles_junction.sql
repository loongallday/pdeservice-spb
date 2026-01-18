-- Migration: Create appointment_approval_roles junction table
-- Created: 2025-12-04
-- Description: Creates junction table to define which roles can approve appointments (many-to-many relationship)

-- Create appointment_approval_roles junction table
CREATE TABLE IF NOT EXISTS public.appointment_approval_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add foreign key constraint
ALTER TABLE public.appointment_approval_roles
  ADD CONSTRAINT appointment_approval_roles_role_id_fkey 
  FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;

-- Add unique constraint to prevent duplicate role entries
CREATE UNIQUE INDEX IF NOT EXISTS idx_appointment_approval_roles_role_id_unique 
  ON public.appointment_approval_roles(role_id);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_appointment_approval_roles_role_id 
  ON public.appointment_approval_roles(role_id);

-- Enable RLS
ALTER TABLE public.appointment_approval_roles ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Level 0+ can read (view which roles can approve appointments)
CREATE POLICY "Users can read appointment approval roles"
  ON public.appointment_approval_roles
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

-- Level 2+ can insert (add roles that can approve)
CREATE POLICY "Level 2+ can insert appointment approval roles"
  ON public.appointment_approval_roles
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
CREATE POLICY "Level 2+ can update appointment approval roles"
  ON public.appointment_approval_roles
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

-- Level 2+ can delete (remove roles from approval list)
CREATE POLICY "Level 2+ can delete appointment approval roles"
  ON public.appointment_approval_roles
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
COMMENT ON TABLE public.appointment_approval_roles IS 'Junction table defining which roles have permission to approve appointments';
COMMENT ON COLUMN public.appointment_approval_roles.role_id IS 'Reference to the role that can approve appointments';
COMMENT ON COLUMN public.appointment_approval_roles.created_at IS 'Timestamp when this role was granted approval permission';
COMMENT ON COLUMN public.appointment_approval_roles.updated_at IS 'Timestamp when this record was last updated';

