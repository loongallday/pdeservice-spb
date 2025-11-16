-- =============================================
-- Remove Cleanup Migration from History
-- This removes the cleanup migration so we start
-- fresh from complete_fresh_schema
-- =============================================

-- Remove the cleanup migration from migration history
DELETE FROM supabase_migrations.schema_migrations
WHERE version = '20251116210937';

-- Verify it's removed
SELECT * FROM supabase_migrations.schema_migrations
ORDER BY version;

-- Expected result: Only should see:
-- - 20251116211708 (complete_fresh_schema)
-- - 20251116153105 (remote_schema - if you keep it)

-- =============================================
-- ALTERNATIVE: Use Supabase CLI (recommended)
-- =============================================
-- Run this command instead:
-- supabase migration repair --status reverted 20251116210937
--
-- Then delete the file:
-- Remove-Item supabase\migrations\20251116210937_cleanup_reset.sql

