-- =============================================
-- Update warmup cron to use proper /warmup endpoints
-- All functions now have dedicated warmup endpoints (no auth required)
-- =============================================

SELECT cron.unschedule('keep-edge-functions-warm');

SELECT cron.schedule(
  'keep-edge-functions-warm',
  '*/5 * * * *',
  $$
  SELECT net.http_get(
    url := 'https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-initialize/warmup',
    timeout_milliseconds := 5000
  );
  SELECT net.http_get(
    url := 'https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-tickets/warmup',
    timeout_milliseconds := 5000
  );
  SELECT net.http_get(
    url := 'https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-notifications/warmup',
    timeout_milliseconds := 5000
  );
  SELECT net.http_get(
    url := 'https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-fleet/warmup',
    timeout_milliseconds := 5000
  );
  $$
);
