-- Migration: Create staged files table and storage bucket
-- For n8n integration: Technicians upload files via LINE, approvers review and approve

-- Create main_staged_files table
CREATE TABLE IF NOT EXISTS public.main_staged_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Ownership
  employee_id UUID NOT NULL REFERENCES main_employees(id) ON DELETE CASCADE,

  -- File info (stored in staging bucket)
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,

  -- Linking to ticket
  ticket_id UUID REFERENCES main_tickets(id) ON DELETE SET NULL,

  -- Status workflow: pending → linked → approved/rejected/expired
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'linked', 'approved', 'rejected', 'expired')),

  -- Approval tracking
  approved_by UUID REFERENCES main_employees(id),
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,

  -- The comment created on approval (links to ticket comment)
  result_comment_id UUID REFERENCES child_ticket_comments(id) ON DELETE SET NULL,

  -- Expiration tracking (30 days from creation)
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),

  -- Metadata
  source TEXT DEFAULT 'line',  -- 'line', 'web', etc.
  metadata JSONB DEFAULT '{}',  -- Additional context from n8n

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_staged_files_employee ON main_staged_files(employee_id);
CREATE INDEX idx_staged_files_ticket ON main_staged_files(ticket_id) WHERE ticket_id IS NOT NULL;
CREATE INDEX idx_staged_files_status ON main_staged_files(status);
CREATE INDEX idx_staged_files_expires ON main_staged_files(expires_at)
  WHERE status IN ('pending', 'linked');
CREATE INDEX idx_staged_files_pending_approval ON main_staged_files(status, created_at)
  WHERE status = 'linked';

-- Comments
COMMENT ON TABLE public.main_staged_files IS 'Staging area for files uploaded via LINE/n8n before approval';
COMMENT ON COLUMN public.main_staged_files.id IS 'Primary key';
COMMENT ON COLUMN public.main_staged_files.employee_id IS 'FK to main_employees - who uploaded the file';
COMMENT ON COLUMN public.main_staged_files.file_url IS 'URL to file in staging-files bucket';
COMMENT ON COLUMN public.main_staged_files.file_name IS 'Original filename';
COMMENT ON COLUMN public.main_staged_files.file_size IS 'File size in bytes';
COMMENT ON COLUMN public.main_staged_files.mime_type IS 'MIME type of the file';
COMMENT ON COLUMN public.main_staged_files.ticket_id IS 'FK to main_tickets - linked after technician selects';
COMMENT ON COLUMN public.main_staged_files.status IS 'Workflow status: pending, linked, approved, rejected, expired';
COMMENT ON COLUMN public.main_staged_files.approved_by IS 'FK to main_employees - who approved the file';
COMMENT ON COLUMN public.main_staged_files.approved_at IS 'When the file was approved';
COMMENT ON COLUMN public.main_staged_files.rejection_reason IS 'Reason for rejection if rejected';
COMMENT ON COLUMN public.main_staged_files.result_comment_id IS 'FK to child_ticket_comments - created on approval';
COMMENT ON COLUMN public.main_staged_files.expires_at IS 'When the file expires if not linked (30 days)';
COMMENT ON COLUMN public.main_staged_files.source IS 'Source of upload: line, web, etc.';
COMMENT ON COLUMN public.main_staged_files.metadata IS 'Additional metadata from n8n';

-- Enable Row Level Security
ALTER TABLE public.main_staged_files ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Authenticated users can read staged files
CREATE POLICY "Authenticated users can read staged files"
  ON public.main_staged_files
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Authenticated users can insert (authorization checked in API)
CREATE POLICY "Authenticated users can insert staged files"
  ON public.main_staged_files
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Authenticated users can update (authorization checked in API)
CREATE POLICY "Authenticated users can update staged files"
  ON public.main_staged_files
  FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- Authenticated users can delete (authorization checked in API)
CREATE POLICY "Authenticated users can delete staged files"
  ON public.main_staged_files
  FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- Service role full access
CREATE POLICY "Service role can manage staged files"
  ON public.main_staged_files
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.main_staged_files TO authenticated;
GRANT ALL ON public.main_staged_files TO service_role;

-- Create updated_at trigger
CREATE TRIGGER set_main_staged_files_updated_at
  BEFORE UPDATE ON public.main_staged_files
  FOR EACH ROW
  EXECUTE FUNCTION fn_trg_set_updated_at();

-- Create storage bucket for staging files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'staging-files',
  'staging-files',
  false,  -- Private bucket (requires auth)
  52428800,  -- 50MB limit
  ARRAY[
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/csv',
    'video/mp4',
    'video/quicktime'
  ]
) ON CONFLICT (id) DO NOTHING;

-- Storage policies for staging-files bucket
CREATE POLICY "staging_files_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'staging-files');

CREATE POLICY "staging_files_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'staging-files');

CREATE POLICY "staging_files_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'staging-files');

CREATE POLICY "staging_files_service" ON storage.objects
  FOR ALL TO service_role
  USING (bucket_id = 'staging-files')
  WITH CHECK (bucket_id = 'staging-files');
