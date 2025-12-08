-- Migration: Add indexes for company search performance optimization
-- Enables pg_trgm extension and creates B-tree and GIN trigram indexes
-- for efficient ILIKE pattern matching on name_th, name_en, and tax_id

-- Enable pg_trgm extension for trigram-based text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- B-tree indexes for exact matches and prefix searches
CREATE INDEX IF NOT EXISTS idx_companies_name_th ON public.companies(name_th);
CREATE INDEX IF NOT EXISTS idx_companies_name_en ON public.companies(name_en);
CREATE INDEX IF NOT EXISTS idx_companies_tax_id ON public.companies(tax_id);

-- GIN trigram indexes for efficient ILIKE pattern matching (with leading wildcards)
-- These indexes significantly improve performance for queries like: name_th ILIKE '%query%'
CREATE INDEX IF NOT EXISTS idx_companies_name_th_trgm ON public.companies USING gin(name_th gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_companies_name_en_trgm ON public.companies USING gin(name_en gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_companies_tax_id_trgm ON public.companies USING gin(tax_id gin_trgm_ops);

COMMENT ON INDEX idx_companies_name_th IS 'B-tree index for exact and prefix searches on Thai company name';
COMMENT ON INDEX idx_companies_name_en IS 'B-tree index for exact and prefix searches on English company name';
COMMENT ON INDEX idx_companies_tax_id IS 'B-tree index for exact and prefix searches on tax ID';
COMMENT ON INDEX idx_companies_name_th_trgm IS 'GIN trigram index for efficient ILIKE pattern matching on Thai company name';
COMMENT ON INDEX idx_companies_name_en_trgm IS 'GIN trigram index for efficient ILIKE pattern matching on English company name';
COMMENT ON INDEX idx_companies_tax_id_trgm IS 'GIN trigram index for efficient ILIKE pattern matching on tax ID';

