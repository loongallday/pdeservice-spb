-- =============================================
-- Create Announcements Storage Bucket
-- Creates storage bucket for announcement photos and files
-- =============================================

-- Create announcements bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'announcements',
  'announcements',
  true,  -- Public bucket (anyone can read)
  52428800,  -- 50MB limit for announcement files
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
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/csv'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- =============================================
-- Storage Policies for announcements bucket
-- =============================================

-- Announcements SELECT policy (public read access - Level 0+)
-- Anyone authenticated can read announcement files
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'announcements_select_policy'
  ) THEN
    CREATE POLICY "announcements_select_policy"
      ON "storage"."objects"
      AS PERMISSIVE
      FOR SELECT
      TO authenticated
      USING (
        bucket_id = 'announcements'::text AND
        auth.uid() IS NOT NULL AND
        EXISTS (
          SELECT 1 FROM employees e
          LEFT JOIN roles r ON e.role_id = r.id
          WHERE e.auth_user_id = auth.uid()
          AND e.is_active = true
          AND COALESCE(r.level, 0) >= 0
        )
      );
  END IF;
END $$;

-- Announcements INSERT policy (Level 1+ can upload)
-- Files should be organized as: announcements/{announcement_id}/{filename}
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'announcements_insert_policy'
  ) THEN
    CREATE POLICY "announcements_insert_policy"
      ON "storage"."objects"
      AS PERMISSIVE
      FOR INSERT
      TO authenticated
      WITH CHECK (
        bucket_id = 'announcements'::text AND
        auth.uid() IS NOT NULL AND
        EXISTS (
          SELECT 1 FROM employees e
          LEFT JOIN roles r ON e.role_id = r.id
          WHERE e.auth_user_id = auth.uid()
          AND e.is_active = true
          AND COALESCE(r.level, 0) >= 1
        )
      );
  END IF;
END $$;

-- Announcements UPDATE policy (Level 2+ can update)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'announcements_update_policy'
  ) THEN
    CREATE POLICY "announcements_update_policy"
      ON "storage"."objects"
      AS PERMISSIVE
      FOR UPDATE
      TO authenticated
      USING (
        bucket_id = 'announcements'::text AND
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
        bucket_id = 'announcements'::text AND
        auth.uid() IS NOT NULL AND
        EXISTS (
          SELECT 1 FROM employees e
          LEFT JOIN roles r ON e.role_id = r.id
          WHERE e.auth_user_id = auth.uid()
          AND e.is_active = true
          AND COALESCE(r.level, 0) >= 2
        )
      );
  END IF;
END $$;

-- Announcements DELETE policy (Level 2+ can delete)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'announcements_delete_policy'
  ) THEN
    CREATE POLICY "announcements_delete_policy"
      ON "storage"."objects"
      AS PERMISSIVE
      FOR DELETE
      TO authenticated
      USING (
        bucket_id = 'announcements'::text AND
        auth.uid() IS NOT NULL AND
        EXISTS (
          SELECT 1 FROM employees e
          LEFT JOIN roles r ON e.role_id = r.id
          WHERE e.auth_user_id = auth.uid()
          AND e.is_active = true
          AND COALESCE(r.level, 0) >= 2
        )
      );
  END IF;
END $$;

