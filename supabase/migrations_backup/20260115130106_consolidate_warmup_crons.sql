-- =============================================
-- Consolidate warmup cron jobs
-- - Remove redundant warm-api-initialize job
-- - Update keep-edge-functions-warm to remove deleted /constants
-- - Use proper /warmup endpoint for api-initialize
-- =============================================

-- Remove redundant job I just created
SELECT cron.unschedule('warm-api-initialize');

-- Drop the function too
DROP FUNCTION IF EXISTS warm_api_initialize();

-- Remove old warmup job (has deleted /constants endpoint)
SELECT cron.unschedule('keep-edge-functions-warm');

-- Create updated warmup job
-- Note: Only api-initialize has /warmup endpoint, others still ping root (will 401 but still warms runtime)
SELECT cron.schedule(
  'keep-edge-functions-warm',
  '*/5 * * * *',
  $$
  SELECT net.http_get(
    url := 'https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-initialize/warmup',
    timeout_milliseconds := 5000
  );
  SELECT net.http_get(
    url := 'https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-tickets',
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
  $$
);
