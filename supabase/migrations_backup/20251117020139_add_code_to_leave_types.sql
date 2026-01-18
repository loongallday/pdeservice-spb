-- Migration: Add code field to leave_types table
-- Adds a unique code field for leave types to match other reference data tables

ALTER TABLE public.leave_types
ADD COLUMN IF NOT EXISTS code VARCHAR UNIQUE;

-- Create index on code for faster lookups
CREATE INDEX IF NOT EXISTS idx_leave_types_code ON public.leave_types(code);

COMMENT ON COLUMN public.leave_types.code IS 'Unique code identifier for the leave type (e.g., sick_leave, personal_leave)';

