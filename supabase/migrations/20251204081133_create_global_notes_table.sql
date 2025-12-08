-- Migration: Create announcements table
-- Created: 2025-12-04
-- Description: Stores global announcements with message, supports file and photo attachments

-- Create announcements table
CREATE TABLE IF NOT EXISTS public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Announcement message
  message TEXT NOT NULL,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create announcement_photos table for photo attachments
CREATE TABLE IF NOT EXISTS public.announcement_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id UUID NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create announcement_files table for file attachments
CREATE TABLE IF NOT EXISTS public.announcement_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id UUID NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_announcements_created_at 
  ON public.announcements(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_announcement_photos_announcement_id 
  ON public.announcement_photos(announcement_id);

CREATE INDEX IF NOT EXISTS idx_announcement_files_announcement_id 
  ON public.announcement_files(announcement_id);

-- Enable RLS
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcement_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcement_files ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for announcements
-- Level 0+ can read (view all announcements)
CREATE POLICY "Users can read announcements"
  ON public.announcements
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM employees e
      LEFT JOIN roles r ON e.role_id = r.id
      WHERE e.auth_user_id = auth.uid()
      AND e.is_active = true
      AND COALESCE(r.level, 0) >= 0
    )
  );

-- Level 1+ can insert (create announcements)
CREATE POLICY "Level 1+ can insert announcements"
  ON public.announcements
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM employees e
      LEFT JOIN roles r ON e.role_id = r.id
      WHERE e.auth_user_id = auth.uid()
      AND e.is_active = true
      AND COALESCE(r.level, 0) >= 1
    )
  );

-- Level 2+ can update (update any announcements)
CREATE POLICY "Level 2+ can update announcements"
  ON public.announcements
  FOR UPDATE
  USING (
    auth.uid() IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM employees e
      LEFT JOIN roles r ON e.role_id = r.id
      WHERE e.auth_user_id = auth.uid()
      AND e.is_active = true
      AND COALESCE(r.level, 0) >= 2
    )
  )
  WITH CHECK (
    auth.uid() IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM employees e
      LEFT JOIN roles r ON e.role_id = r.id
      WHERE e.auth_user_id = auth.uid()
      AND e.is_active = true
      AND COALESCE(r.level, 0) >= 2
    )
  );

-- Level 2+ can delete (delete any announcements)
CREATE POLICY "Level 2+ can delete announcements"
  ON public.announcements
  FOR DELETE
  USING (
    auth.uid() IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM employees e
      LEFT JOIN roles r ON e.role_id = r.id
      WHERE e.auth_user_id = auth.uid()
      AND e.is_active = true
      AND COALESCE(r.level, 0) >= 2
    )
  );

-- Create RLS policies for announcement_photos
-- Level 0+ can read
CREATE POLICY "Users can read announcement photos"
  ON public.announcement_photos
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM employees e
      LEFT JOIN roles r ON e.role_id = r.id
      WHERE e.auth_user_id = auth.uid()
      AND e.is_active = true
      AND COALESCE(r.level, 0) >= 0
    )
  );

-- Level 1+ can insert
CREATE POLICY "Level 1+ can insert announcement photos"
  ON public.announcement_photos
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM employees e
      LEFT JOIN roles r ON e.role_id = r.id
      WHERE e.auth_user_id = auth.uid()
      AND e.is_active = true
      AND COALESCE(r.level, 0) >= 1
    )
  );

-- Level 2+ can update/delete
CREATE POLICY "Level 2+ can update announcement photos"
  ON public.announcement_photos
  FOR UPDATE
  USING (
    auth.uid() IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM employees e
      LEFT JOIN roles r ON e.role_id = r.id
      WHERE e.auth_user_id = auth.uid()
      AND e.is_active = true
      AND COALESCE(r.level, 0) >= 2
    )
  )
  WITH CHECK (
    auth.uid() IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM employees e
      LEFT JOIN roles r ON e.role_id = r.id
      WHERE e.auth_user_id = auth.uid()
      AND e.is_active = true
      AND COALESCE(r.level, 0) >= 2
    )
  );

CREATE POLICY "Level 2+ can delete announcement photos"
  ON public.announcement_photos
  FOR DELETE
  USING (
    auth.uid() IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM employees e
      LEFT JOIN roles r ON e.role_id = r.id
      WHERE e.auth_user_id = auth.uid()
      AND e.is_active = true
      AND COALESCE(r.level, 0) >= 2
    )
  );

-- Create RLS policies for announcement_files
-- Level 0+ can read
CREATE POLICY "Users can read announcement files"
  ON public.announcement_files
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM employees e
      LEFT JOIN roles r ON e.role_id = r.id
      WHERE e.auth_user_id = auth.uid()
      AND e.is_active = true
      AND COALESCE(r.level, 0) >= 0
    )
  );

-- Level 1+ can insert
CREATE POLICY "Level 1+ can insert announcement files"
  ON public.announcement_files
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM employees e
      LEFT JOIN roles r ON e.role_id = r.id
      WHERE e.auth_user_id = auth.uid()
      AND e.is_active = true
      AND COALESCE(r.level, 0) >= 1
    )
  );

-- Level 2+ can update/delete
CREATE POLICY "Level 2+ can update announcement files"
  ON public.announcement_files
  FOR UPDATE
  USING (
    auth.uid() IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM employees e
      LEFT JOIN roles r ON e.role_id = r.id
      WHERE e.auth_user_id = auth.uid()
      AND e.is_active = true
      AND COALESCE(r.level, 0) >= 2
    )
  )
  WITH CHECK (
    auth.uid() IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM employees e
      LEFT JOIN roles r ON e.role_id = r.id
      WHERE e.auth_user_id = auth.uid()
      AND e.is_active = true
      AND COALESCE(r.level, 0) >= 2
    )
  );

CREATE POLICY "Level 2+ can delete announcement files"
  ON public.announcement_files
  FOR DELETE
  USING (
    auth.uid() IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM employees e
      LEFT JOIN roles r ON e.role_id = r.id
      WHERE e.auth_user_id = auth.uid()
      AND e.is_active = true
      AND COALESCE(r.level, 0) >= 2
    )
  );

-- Add comments
COMMENT ON TABLE public.announcements IS 'Stores global announcements with message, supports file and photo attachments';
COMMENT ON COLUMN public.announcements.message IS 'Announcement message content';
COMMENT ON TABLE public.announcement_photos IS 'Photo attachments for announcements';
COMMENT ON COLUMN public.announcement_photos.image_url IS 'URL to the photo in storage';
COMMENT ON COLUMN public.announcement_photos.display_order IS 'Display order for photos';
COMMENT ON TABLE public.announcement_files IS 'File attachments for announcements';
COMMENT ON COLUMN public.announcement_files.file_url IS 'URL to the file in storage';
COMMENT ON COLUMN public.announcement_files.file_name IS 'Original filename';
COMMENT ON COLUMN public.announcement_files.file_size IS 'File size in bytes';
COMMENT ON COLUMN public.announcement_files.mime_type IS 'MIME type of the file';

