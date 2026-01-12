-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- Grant usage to postgres role
GRANT USAGE ON SCHEMA cron TO postgres;

-- Create function to delete expired notifications (older than 2 weeks)
CREATE OR REPLACE FUNCTION delete_expired_notifications()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM main_notifications
  WHERE created_at < NOW() - INTERVAL '2 weeks';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  RAISE NOTICE 'Deleted % expired notifications', deleted_count;

  RETURN deleted_count;
END;
$$;

-- Schedule cron job to run daily at 3:00 AM UTC
SELECT cron.schedule(
  'delete-expired-notifications',  -- job name
  '0 3 * * *',                     -- cron expression: daily at 3:00 AM UTC
  'SELECT delete_expired_notifications()'
);

-- Add comment for documentation
COMMENT ON FUNCTION delete_expired_notifications IS 'Deletes notifications older than 2 weeks. Scheduled to run daily at 3:00 AM UTC.';
