-- Create ref_work_givers reference table
-- This table stores work giver options for tickets (e.g., PDE, PDE - SIS, APC, etc.)

CREATE TABLE IF NOT EXISTS public.ref_work_givers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR NOT NULL UNIQUE,
  name VARCHAR NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add comments
COMMENT ON TABLE public.ref_work_givers IS 'Reference: Work giver options for tickets';
COMMENT ON COLUMN public.ref_work_givers.id IS 'Primary key';
COMMENT ON COLUMN public.ref_work_givers.code IS 'Unique work giver code';
COMMENT ON COLUMN public.ref_work_givers.name IS 'Display name';
COMMENT ON COLUMN public.ref_work_givers.is_active IS 'Whether this work giver is active';
COMMENT ON COLUMN public.ref_work_givers.created_at IS 'Created timestamp';
COMMENT ON COLUMN public.ref_work_givers.updated_at IS 'Updated timestamp';

-- Add indexes
CREATE INDEX idx_ref_work_givers_code ON public.ref_work_givers(code);
CREATE INDEX idx_ref_work_givers_is_active ON public.ref_work_givers(is_active);

-- Insert predefined work giver options
INSERT INTO public.ref_work_givers (code, name) VALUES
  ('PDE', 'PDE'),
  ('PDE_SIS', 'PDE - SIS'),
  ('PDE_SYNNEX', 'PDE - SYNNEX'),
  ('PDE_INGRAM', 'PDE - INGRAM'),
  ('PDE_S_DISTRIBUTION', 'PDE - S Distribution'),
  ('APC', 'APC');

-- Enable Row Level Security
ALTER TABLE public.ref_work_givers ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Allow all authenticated users to read work givers
CREATE POLICY "Authenticated users can read work givers"
  ON public.ref_work_givers
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Only service role can modify (via backend API)
CREATE POLICY "Service role can modify work givers"
  ON public.ref_work_givers
  FOR ALL
  USING (false)
  WITH CHECK (false);

