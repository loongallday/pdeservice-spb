-- =============================================
-- Seed Data for Local Development
-- =============================================
--
-- IMPORTANT: Due to Supabase CLI limitations with large seed files,
-- use the reset script instead:
--
--   ./scripts/reset-local-db.sh
--
-- This will:
-- 1. Reset the database with schema migration
-- 2. Seed reference data (departments, roles, statuses)
-- 3. Seed location data (77 provinces, 929 districts, 7453 subdistricts)
-- 4. Seed test data (sample employees, companies, tickets)
--
-- Seed files are located in: supabase/seeds/
-- =============================================

-- Minimal seed for basic functionality
DO $$
BEGIN
  RAISE NOTICE 'Use ./scripts/reset-local-db.sh for full seed data';
END $$;
