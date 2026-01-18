-- Migration: Add is_active column to feature table
-- This allows features to be disabled without deleting them
-- Only active features will be returned by the API

ALTER TABLE public.feature 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Update existing features to be active by default
UPDATE public.feature SET is_active = true WHERE is_active IS NULL;

-- Add index for performance when filtering by is_active
CREATE INDEX IF NOT EXISTS idx_feature_is_active ON public.feature(is_active);

COMMENT ON COLUMN public.feature.is_active IS 'Whether this feature is currently active and usable. Only active features are returned by the API.';

