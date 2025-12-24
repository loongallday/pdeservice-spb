-- Migration: Add is_key_employee field to ticket_employees
-- Created: 2024-12-24

-- Add is_key_employee column to ticket_employees table
ALTER TABLE public.ticket_employees
  ADD COLUMN IF NOT EXISTS is_key_employee BOOLEAN NOT NULL DEFAULT false;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_ticket_employees_is_key_employee 
  ON public.ticket_employees(is_key_employee);

-- Add comment
COMMENT ON COLUMN public.ticket_employees.is_key_employee IS 'Whether this employee is a key employee for this ticket assignment';

