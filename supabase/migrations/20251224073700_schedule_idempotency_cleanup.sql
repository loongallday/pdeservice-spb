-- Migration: Schedule daily cleanup of expired idempotency keys
-- Created: 2024-12-24
-- 
-- This migration sets up automatic daily cleanup of expired idempotency keys
-- Keys expire after 24 hours, and this job runs daily to remove them

-- Enable pg_cron extension (if not already enabled)
-- Note: pg_cron may require superuser privileges or may not be available on all Supabase plans
-- If pg_cron is not available, use Supabase Edge Functions with scheduled invocations instead
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule daily cleanup at 2 AM UTC (adjust timezone as needed)
-- This runs every day and removes all expired idempotency keys
SELECT cron.schedule(
  'cleanup-expired-idempotency-keys',
  '0 2 * * *', -- Daily at 2 AM UTC (cron format: minute hour day month weekday)
  $$SELECT cleanup_expired_idempotency_keys()$$
);

COMMENT ON EXTENSION pg_cron IS 'Enables scheduled jobs for automatic cleanup tasks';

-- Alternative: If pg_cron is not available, you can:
-- 1. Use Supabase Edge Functions with scheduled invocations
-- 2. Set up an external cron job (cron job service, GitHub Actions, etc.)
-- 3. Call the cleanup function manually via SQL: SELECT cleanup_expired_idempotency_keys();

-- To manually run cleanup (for testing):
-- SELECT cleanup_expired_idempotency_keys();

-- To view scheduled jobs:
-- SELECT * FROM cron.job;

-- To unschedule (if needed):
-- SELECT cron.unschedule('cleanup-expired-idempotency-keys');

