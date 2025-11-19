-- Migration: Add safety_standard column to sites table
-- Created: 2025-11-18
-- Description: Adds safety_standard column as array of enumerated safety requirements

-- Create enum type for safety standards
CREATE TYPE safety_standard_type AS ENUM (
  'safety_shoes',
  'safety_vest',
  'safety_helmet',
  'training'
);

-- Add safety_standard column to sites table
ALTER TABLE public.sites
  ADD COLUMN safety_standard safety_standard_type[] DEFAULT NULL;

-- Add comment
COMMENT ON COLUMN public.sites.safety_standard IS 'Array of required safety standards for this site (safety_shoes, safety_vest, safety_helmet, training)';



