-- Add photo and file attachments to ticket comments
-- Following the same pattern as announcements (child_announcement_photos, child_announcement_files)

-- Create child_comment_photos table
CREATE TABLE IF NOT EXISTS child_comment_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid NOT NULL REFERENCES child_ticket_comments(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Add comment
COMMENT ON TABLE child_comment_photos IS 'Child of child_ticket_comments: Photo attachments for comments';
COMMENT ON COLUMN child_comment_photos.image_url IS 'URL to the photo in storage';
COMMENT ON COLUMN child_comment_photos.display_order IS 'Display order for photos';

-- Create child_comment_files table
CREATE TABLE IF NOT EXISTS child_comment_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid NOT NULL REFERENCES child_ticket_comments(id) ON DELETE CASCADE,
  file_url text NOT NULL,
  file_name text NOT NULL,
  file_size integer,
  mime_type text,
  created_at timestamptz DEFAULT now()
);

-- Add comment
COMMENT ON TABLE child_comment_files IS 'Child of child_ticket_comments: File attachments for comments';
COMMENT ON COLUMN child_comment_files.file_url IS 'URL to the file in storage';
COMMENT ON COLUMN child_comment_files.file_name IS 'Original filename';
COMMENT ON COLUMN child_comment_files.file_size IS 'File size in bytes';
COMMENT ON COLUMN child_comment_files.mime_type IS 'MIME type of the file';

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_comment_photos_comment_id ON child_comment_photos(comment_id);
CREATE INDEX IF NOT EXISTS idx_comment_files_comment_id ON child_comment_files(comment_id);

-- Enable RLS
ALTER TABLE child_comment_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE child_comment_files ENABLE ROW LEVEL SECURITY;

-- RLS policies for child_comment_photos
CREATE POLICY "Allow authenticated read for comment photos"
  ON child_comment_photos FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated insert for comment photos"
  ON child_comment_photos FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated delete for comment photos"
  ON child_comment_photos FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Allow service role full access to comment photos"
  ON child_comment_photos FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- RLS policies for child_comment_files
CREATE POLICY "Allow authenticated read for comment files"
  ON child_comment_files FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated insert for comment files"
  ON child_comment_files FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated delete for comment files"
  ON child_comment_files FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Allow service role full access to comment files"
  ON child_comment_files FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Grant permissions
GRANT SELECT, INSERT, DELETE ON child_comment_photos TO authenticated;
GRANT ALL ON child_comment_photos TO service_role;
GRANT SELECT, INSERT, DELETE ON child_comment_files TO authenticated;
GRANT ALL ON child_comment_files TO service_role;
