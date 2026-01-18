-- Migration: Move pg_trgm extension from public to extensions schema
-- This addresses the database linter warning about extensions in public schema

-- Create extensions schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS extensions;

-- Grant usage on extensions schema to necessary roles
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;

-- Drop the GIN trigram indexes that depend on pg_trgm
DROP INDEX IF EXISTS public.idx_companies_name_th_trgm;
DROP INDEX IF EXISTS public.idx_companies_name_en_trgm;
DROP INDEX IF EXISTS public.idx_companies_tax_id_trgm;

-- Drop pg_trgm from public schema
DROP EXTENSION IF EXISTS pg_trgm;

-- Create pg_trgm in extensions schema
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

-- Recreate the GIN trigram indexes using the extensions schema
-- The operators are now in extensions schema, so we need to qualify them
CREATE INDEX idx_companies_name_th_trgm ON public.companies USING gin (name_th extensions.gin_trgm_ops);
CREATE INDEX idx_companies_name_en_trgm ON public.companies USING gin (name_en extensions.gin_trgm_ops);
CREATE INDEX idx_companies_tax_id_trgm ON public.companies USING gin (tax_id extensions.gin_trgm_ops);

