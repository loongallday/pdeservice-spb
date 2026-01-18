-- Migration: Add unique constraint to ensure only one main branch per company
-- This prevents multiple sites from having is_main_branch = true for the same company

-- First, handle any existing duplicates by keeping only the first one per company (by ID)
DO $$
DECLARE
  site_record RECORD;
BEGIN
  -- For each company that has multiple main branches, keep only the first one (by ID)
  FOR site_record IN
    SELECT company_id, array_agg(id ORDER BY id) as site_ids
    FROM public.sites
    WHERE is_main_branch = true
      AND company_id IS NOT NULL
    GROUP BY company_id
    HAVING COUNT(*) > 1
  LOOP
    -- Set is_main_branch = false for all except the first (lowest ID) site
    UPDATE public.sites
    SET is_main_branch = false
    WHERE company_id = site_record.company_id
      AND is_main_branch = true
      AND id != (SELECT id FROM public.sites 
                 WHERE company_id = site_record.company_id 
                   AND is_main_branch = true 
                 ORDER BY id ASC 
                 LIMIT 1);
  END LOOP;
END $$;

-- Create unique partial index to enforce one main branch per company
-- This index only applies when is_main_branch = true
CREATE UNIQUE INDEX IF NOT EXISTS idx_sites_unique_main_branch_per_company 
ON public.sites(company_id) 
WHERE is_main_branch = true AND company_id IS NOT NULL;

COMMENT ON INDEX idx_sites_unique_main_branch_per_company IS 'Ensures only one main branch (is_main_branch = true) per company';

