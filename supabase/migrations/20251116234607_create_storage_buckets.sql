-- =============================================
-- Create Storage Buckets
-- Creates profile-image and work-results storage buckets
-- =============================================

-- Create profile-image bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'profile-image',
  'profile-image',
  true,  -- Public bucket (anyone can read)
  5242880,  -- 5MB limit for profile images
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Create work-results bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'work-results',
  'work-results',
  false,  -- Private bucket (requires authentication)
  52428800,  -- 50MB limit for work result files
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- =============================================
-- Storage Policies for profile-image bucket
-- =============================================

-- Profile image INSERT policy (authenticated users can upload profile images)
-- Files should be organized as: profile-image/{employee_id}/{filename}
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'profile_image_insert_policy'
  ) THEN
    CREATE POLICY "profile_image_insert_policy"
      ON "storage"."objects"
      AS PERMISSIVE
      FOR INSERT
      TO authenticated
      WITH CHECK (bucket_id = 'profile-image'::text);
  END IF;
END $$;

-- Profile image UPDATE policy (authenticated users can update profile images)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'profile_image_update_policy'
  ) THEN
    CREATE POLICY "profile_image_update_policy"
      ON "storage"."objects"
      AS PERMISSIVE
      FOR UPDATE
      TO authenticated
      USING (bucket_id = 'profile-image'::text)
      WITH CHECK (bucket_id = 'profile-image'::text);
  END IF;
END $$;

-- Profile image DELETE policy (authenticated users can delete profile images)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'profile_image_delete_policy'
  ) THEN
    CREATE POLICY "profile_image_delete_policy"
      ON "storage"."objects"
      AS PERMISSIVE
      FOR DELETE
      TO authenticated
      USING (bucket_id = 'profile-image'::text);
  END IF;
END $$;

COMMENT ON TABLE storage.buckets IS 'Supabase Storage buckets for file storage';
COMMENT ON COLUMN storage.buckets.id IS 'Bucket identifier (must match name)';
COMMENT ON COLUMN storage.buckets.public IS 'Whether the bucket is publicly accessible (true) or requires authentication (false)';

