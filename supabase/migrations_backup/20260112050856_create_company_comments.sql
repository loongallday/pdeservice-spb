-- Migration: Create company comments tables
-- Child of main_companies: Comments on companies with @mention support

-- Create child_company_comments table
CREATE TABLE IF NOT EXISTS public.child_company_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  author_id UUID NOT NULL,
  content TEXT NOT NULL,
  mentioned_employee_ids UUID[] DEFAULT '{}',
  is_edited BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Foreign key constraints
  CONSTRAINT child_company_comments_company_id_fkey
    FOREIGN KEY (company_id) REFERENCES public.main_companies(id) ON DELETE CASCADE,
  CONSTRAINT child_company_comments_author_id_fkey
    FOREIGN KEY (author_id) REFERENCES public.main_employees(id) ON DELETE RESTRICT
);

-- Comments
COMMENT ON TABLE public.child_company_comments IS 'Child of main_companies: Comments on companies with @mention support';
COMMENT ON COLUMN public.child_company_comments.id IS 'Primary key';
COMMENT ON COLUMN public.child_company_comments.company_id IS 'FK to main_companies';
COMMENT ON COLUMN public.child_company_comments.author_id IS 'FK to main_employees - who wrote the comment';
COMMENT ON COLUMN public.child_company_comments.content IS 'Comment text content (may contain @mentions in format @[employee_id])';
COMMENT ON COLUMN public.child_company_comments.mentioned_employee_ids IS 'Array of employee IDs mentioned in this comment';
COMMENT ON COLUMN public.child_company_comments.is_edited IS 'Whether this comment has been edited';
COMMENT ON COLUMN public.child_company_comments.created_at IS 'Created timestamp';
COMMENT ON COLUMN public.child_company_comments.updated_at IS 'Updated timestamp';

-- Indexes
CREATE INDEX idx_child_company_comments_company_id ON public.child_company_comments(company_id);
CREATE INDEX idx_child_company_comments_author_id ON public.child_company_comments(author_id);
CREATE INDEX idx_child_company_comments_created_at ON public.child_company_comments(created_at DESC);
CREATE INDEX idx_child_company_comments_mentioned ON public.child_company_comments USING GIN (mentioned_employee_ids);

-- Enable Row Level Security
ALTER TABLE public.child_company_comments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Authenticated users can read all comments
CREATE POLICY "Authenticated users can read company comments"
  ON public.child_company_comments
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Service role can insert/update/delete (API handles authorization)
CREATE POLICY "Service role can modify company comments"
  ON public.child_company_comments
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- Grant permissions
GRANT SELECT ON public.child_company_comments TO authenticated;
GRANT ALL ON public.child_company_comments TO service_role;

-- Create child_company_comment_photos table
CREATE TABLE IF NOT EXISTS child_company_comment_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid NOT NULL REFERENCES child_company_comments(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Add comment
COMMENT ON TABLE child_company_comment_photos IS 'Child of child_company_comments: Photo attachments for comments';
COMMENT ON COLUMN child_company_comment_photos.image_url IS 'URL to the photo in storage';
COMMENT ON COLUMN child_company_comment_photos.display_order IS 'Display order for photos';

-- Create child_company_comment_files table
CREATE TABLE IF NOT EXISTS child_company_comment_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid NOT NULL REFERENCES child_company_comments(id) ON DELETE CASCADE,
  file_url text NOT NULL,
  file_name text NOT NULL,
  file_size integer,
  mime_type text,
  created_at timestamptz DEFAULT now()
);

-- Add comment
COMMENT ON TABLE child_company_comment_files IS 'Child of child_company_comments: File attachments for comments';
COMMENT ON COLUMN child_company_comment_files.file_url IS 'URL to the file in storage';
COMMENT ON COLUMN child_company_comment_files.file_name IS 'Original filename';
COMMENT ON COLUMN child_company_comment_files.file_size IS 'File size in bytes';
COMMENT ON COLUMN child_company_comment_files.mime_type IS 'MIME type of the file';

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_company_comment_photos_comment_id ON child_company_comment_photos(comment_id);
CREATE INDEX IF NOT EXISTS idx_company_comment_files_comment_id ON child_company_comment_files(comment_id);

-- Enable RLS
ALTER TABLE child_company_comment_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE child_company_comment_files ENABLE ROW LEVEL SECURITY;

-- RLS policies for child_company_comment_photos
CREATE POLICY "Allow authenticated read for company comment photos"
  ON child_company_comment_photos FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated insert for company comment photos"
  ON child_company_comment_photos FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated delete for company comment photos"
  ON child_company_comment_photos FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Allow service role full access to company comment photos"
  ON child_company_comment_photos FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- RLS policies for child_company_comment_files
CREATE POLICY "Allow authenticated read for company comment files"
  ON child_company_comment_files FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated insert for company comment files"
  ON child_company_comment_files FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated delete for company comment files"
  ON child_company_comment_files FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Allow service role full access to company comment files"
  ON child_company_comment_files FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Grant permissions
GRANT SELECT, INSERT, DELETE ON child_company_comment_photos TO authenticated;
GRANT ALL ON child_company_comment_photos TO service_role;
GRANT SELECT, INSERT, DELETE ON child_company_comment_files TO authenticated;
GRANT ALL ON child_company_comment_files TO service_role;
