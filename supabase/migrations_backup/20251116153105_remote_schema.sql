-- =============================================
-- Remote Schema Sync Migration
-- This migration adds storage policies and other items
-- that exist in remote but not in complete_fresh_schema
-- =============================================

-- Storage policies for profile images
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'profile_image_select_policy'
  ) THEN
    CREATE POLICY "profile_image_select_policy"
      ON "storage"."objects"
      AS PERMISSIVE
      FOR SELECT
      TO public
      USING ((bucket_id = 'profile-image'::text));
  END IF;
END $$;

-- Storage policies for work results
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'work_results_delete'
  ) THEN
    CREATE POLICY "work_results_delete"
      ON "storage"."objects"
      AS PERMISSIVE
      FOR DELETE
      TO public
      USING ((bucket_id = 'work-results'::text));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'work_results_insert'
  ) THEN
    CREATE POLICY "work_results_insert"
      ON "storage"."objects"
      AS PERMISSIVE
      FOR INSERT
      TO public
      WITH CHECK ((bucket_id = 'work-results'::text));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'work_results_select'
  ) THEN
    CREATE POLICY "work_results_select"
      ON "storage"."objects"
      AS PERMISSIVE
      FOR SELECT
      TO public
      USING ((bucket_id = 'work-results'::text));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'work_results_update'
  ) THEN
    CREATE POLICY "work_results_update"
      ON "storage"."objects"
      AS PERMISSIVE
      FOR UPDATE
      TO public
      USING ((bucket_id = 'work-results'::text));
  END IF;
END $$;
