-- Migration: Add is_approved field to appointments table
-- Created: 2025-12-04

-- Add is_approved column with default value of false (for new appointments)
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS is_approved BOOLEAN NOT NULL DEFAULT false;

-- Update all existing records to is_approved = true
-- (All previous data should be approved by default)
UPDATE public.appointments
SET is_approved = true;

-- Add comment for documentation
COMMENT ON COLUMN public.appointments.is_approved IS 'Indicates whether the appointment has been approved. Defaults to false for new appointments.';

