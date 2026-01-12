-- Create background jobs table for tracking async operations
CREATE TABLE IF NOT EXISTS main_background_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),

  -- Progress tracking
  total INTEGER NOT NULL DEFAULT 0,
  processed INTEGER NOT NULL DEFAULT 0,
  succeeded INTEGER NOT NULL DEFAULT 0,
  failed INTEGER NOT NULL DEFAULT 0,
  skipped INTEGER NOT NULL DEFAULT 0,

  -- Job data
  input_data JSONB,
  errors JSONB DEFAULT '[]'::jsonb,

  -- Metadata
  created_by UUID REFERENCES main_employees(id),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for querying by type and status
CREATE INDEX idx_background_jobs_type_status ON main_background_jobs(job_type, status);

-- Index for querying by creator
CREATE INDEX idx_background_jobs_created_by ON main_background_jobs(created_by);

-- RLS policies
ALTER TABLE main_background_jobs ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (used by edge functions)
CREATE POLICY "Service role has full access to jobs"
  ON main_background_jobs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Allow authenticated users to read jobs (admin check done in edge function)
CREATE POLICY "Authenticated users can view jobs"
  ON main_background_jobs
  FOR SELECT
  TO authenticated
  USING (true);

-- Grant permissions
GRANT SELECT ON main_background_jobs TO authenticated;
GRANT ALL ON main_background_jobs TO service_role;

COMMENT ON TABLE main_background_jobs IS 'Tracks background job status for async operations like backfill summaries';
