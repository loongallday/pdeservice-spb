-- =============================================
-- Keep api-initialize edge function warm
-- Pings /warmup endpoint every 4 minutes to prevent cold starts
-- =============================================

-- Create function to ping the warmup endpoint
CREATE OR REPLACE FUNCTION warm_api_initialize()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Use pg_net to make async HTTP request to warmup endpoint
  PERFORM net.http_get(
    url := 'https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-initialize/warmup',
    headers := '{"Content-Type": "application/json"}'::jsonb
  );
END;
$$;

-- Schedule cron job to run every 4 minutes
SELECT cron.schedule(
  'warm-api-initialize',
  '*/4 * * * *',
  $$SELECT warm_api_initialize()$$
);

COMMENT ON FUNCTION warm_api_initialize IS 'Keeps api-initialize edge function warm by pinging warmup endpoint';
