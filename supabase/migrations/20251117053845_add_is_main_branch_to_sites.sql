-- Migration: Add is_main_branch column to sites table
-- This column indicates if a site is the main branch/head office for a company

ALTER TABLE public.sites
ADD COLUMN IF NOT EXISTS is_main_branch BOOLEAN DEFAULT false;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_sites_is_main_branch ON public.sites(is_main_branch);
CREATE INDEX IF NOT EXISTS idx_sites_company_main_branch ON public.sites(company_id, is_main_branch) WHERE is_main_branch = true;

COMMENT ON COLUMN public.sites.is_main_branch IS 'Indicates if this site is the main branch/head office for the company';

