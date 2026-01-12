-- Enable pg_net extension for HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Create a function to call the fleet sync edge function
CREATE OR REPLACE FUNCTION public.trigger_fleet_sync()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  project_url TEXT := 'https://ogzyihacqbasolfxymgo.supabase.co';
  cron_secret TEXT;
BEGIN
  -- Get the cron secret from vault (or use service role key)
  SELECT decrypted_secret INTO cron_secret
  FROM vault.decrypted_secrets
  WHERE name = 'CRON_SECRET'
  LIMIT 1;

  -- If no cron secret, use service role key
  IF cron_secret IS NULL THEN
    SELECT decrypted_secret INTO cron_secret
    FROM vault.decrypted_secrets
    WHERE name = 'service_role_key'
    LIMIT 1;
  END IF;

  -- Call the fleet sync edge function
  PERFORM extensions.http_post(
    url := project_url || '/functions/v1/api-fleet-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(cron_secret, '')
    ),
    body := '{}'::jsonb
  );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.trigger_fleet_sync() TO service_role;

-- Schedule the cron job to run every 5 minutes
SELECT cron.schedule(
  'fleet-sync-every-5-min',
  '*/5 * * * *',
  $$SELECT public.trigger_fleet_sync()$$
);

COMMENT ON FUNCTION public.trigger_fleet_sync() IS 'Triggers fleet sync edge function to pull data from external GPS system';
