-- Create ticket attachments tables and storage bucket
-- Similar pattern to comment attachments

-- ============================================================================
-- TABLES
-- ============================================================================

-- Ticket Photos table
CREATE TABLE IF NOT EXISTS child_ticket_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES main_tickets(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES main_employees(id),
  image_url TEXT NOT NULL,
  caption TEXT,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ticket Files table
CREATE TABLE IF NOT EXISTS child_ticket_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES main_tickets(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES main_employees(id),
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_ticket_photos_ticket_id ON child_ticket_photos(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_photos_uploaded_by ON child_ticket_photos(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_ticket_files_ticket_id ON child_ticket_files(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_files_uploaded_by ON child_ticket_files(uploaded_by);

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE child_ticket_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE child_ticket_files ENABLE ROW LEVEL SECURITY;

-- Photos policies
CREATE POLICY "ticket_photos_select" ON child_ticket_photos
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "ticket_photos_insert" ON child_ticket_photos
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "ticket_photos_delete" ON child_ticket_photos
  FOR DELETE TO authenticated
  USING (true);

-- Files policies
CREATE POLICY "ticket_files_select" ON child_ticket_files
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "ticket_files_insert" ON child_ticket_files
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "ticket_files_delete" ON child_ticket_files
  FOR DELETE TO authenticated
  USING (true);

-- Service role full access
CREATE POLICY "ticket_photos_service" ON child_ticket_photos
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "ticket_files_service" ON child_ticket_files
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- STORAGE BUCKET
-- ============================================================================

-- Create storage bucket for ticket attachments
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'ticket-attachments',
  'ticket-attachments',
  true,
  10485760, -- 10MB limit
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/csv'
  ]
) ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "ticket_attachments_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'ticket-attachments');

CREATE POLICY "ticket_attachments_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'ticket-attachments');

CREATE POLICY "ticket_attachments_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'ticket-attachments');

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE child_ticket_photos IS 'Photo attachments for tickets';
COMMENT ON TABLE child_ticket_files IS 'File attachments for tickets';
