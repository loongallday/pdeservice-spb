-- Keep Edge Functions warm by pinging them every 5 minutes
-- This prevents cold starts which can take 3-5 seconds

-- Schedule keep-warm job to run every 5 minutes
SELECT cron.schedule(
  'keep-edge-functions-warm',
  '*/5 * * * *',
  $$
  -- Ping most frequently used Edge Functions
  -- Even without auth, the request warms up the Deno runtime
  SELECT net.http_get(
    url := 'https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-initialize/features',
    timeout_milliseconds := 5000
  );

  SELECT net.http_get(
    url := 'https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-reference-data/constants',
    timeout_milliseconds := 5000
  );

  SELECT net.http_get(
    url := 'https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-notifications',
    timeout_milliseconds := 5000
  );

  SELECT net.http_get(
    url := 'https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-fleet',
    timeout_milliseconds := 5000
  );

  SELECT net.http_get(
    url := 'https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-tickets',
    timeout_milliseconds := 5000
  );
  $$
);
