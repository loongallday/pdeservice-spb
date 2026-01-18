-- Migration: Add staging files cleanup cron job
-- Marks expired files and deletes old expired records

-- Create function to cleanup expired staged files
CREATE OR REPLACE FUNCTION cleanup_expired_staged_files()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  marked_count INTEGER;
  deleted_count INTEGER;
BEGIN
  -- Step 1: Mark files as expired if expires_at has passed and still pending/linked
  UPDATE main_staged_files
  SET status = 'expired', updated_at = NOW()
  WHERE expires_at < NOW()
    AND status IN ('pending', 'linked');

  GET DIAGNOSTICS marked_count = ROW_COUNT;

  -- Step 2: Delete expired files that have been expired for more than 7 days
  -- (gives users time to see what expired before permanent deletion)
  DELETE FROM main_staged_files
  WHERE status = 'expired'
    AND updated_at < NOW() - INTERVAL '7 days';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  RAISE NOTICE 'Staged files cleanup: marked % as expired, deleted % old expired records', marked_count, deleted_count;

  RETURN jsonb_build_object(
    'marked_expired', marked_count,
    'deleted', deleted_count
  );
END;
$$;

-- Schedule cron job to run daily at 4:00 AM UTC
SELECT cron.schedule(
  'cleanup-expired-staged-files',  -- job name
  '0 4 * * *',                     -- cron expression: daily at 4:00 AM UTC
  'SELECT cleanup_expired_staged_files()'
);

-- Add comment for documentation
COMMENT ON FUNCTION cleanup_expired_staged_files IS 'Marks staged files as expired if expires_at has passed (30 days from upload), and deletes records that have been expired for more than 7 days. Scheduled to run daily at 4:00 AM UTC.';
