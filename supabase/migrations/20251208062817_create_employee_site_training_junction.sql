-- Migration: Create employee_site_trainings junction table
-- Created: 2025-12-08
-- Description: Links employees to sites to track training completion

-- Create employee_site_trainings junction table
CREATE TABLE IF NOT EXISTS public.employee_site_trainings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL,
  site_id UUID NOT NULL,
  trained_at DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add foreign key constraints
ALTER TABLE public.employee_site_trainings
  ADD CONSTRAINT employee_site_trainings_employee_id_fkey
  FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;

ALTER TABLE public.employee_site_trainings
  ADD CONSTRAINT employee_site_trainings_site_id_fkey
  FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;

-- Prevent duplicate training records for the same employee-site pair
CREATE UNIQUE INDEX IF NOT EXISTS idx_employee_site_trainings_unique
  ON public.employee_site_trainings(employee_id, site_id);

-- Add indexes for common lookups
CREATE INDEX IF NOT EXISTS idx_employee_site_trainings_employee_id
  ON public.employee_site_trainings(employee_id);

CREATE INDEX IF NOT EXISTS idx_employee_site_trainings_site_id
  ON public.employee_site_trainings(site_id);

-- Enable RLS
ALTER TABLE public.employee_site_trainings ENABLE ROW LEVEL SECURITY;

-- Add comments
COMMENT ON TABLE public.employee_site_trainings IS 'Junction table indicating employees trained for specific sites';
COMMENT ON COLUMN public.employee_site_trainings.employee_id IS 'Reference to the trained employee';
COMMENT ON COLUMN public.employee_site_trainings.site_id IS 'Reference to the site where the employee is trained';
COMMENT ON COLUMN public.employee_site_trainings.trained_at IS 'Date the employee completed training for the site';
COMMENT ON COLUMN public.employee_site_trainings.created_at IS 'Timestamp when the training record was created';

