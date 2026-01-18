-- Make name_en required in main_companies table
-- Both name_th and name_en are now required

-- First, update any null/empty name_en to use name_th as fallback
UPDATE main_companies
SET name_en = name_th
WHERE name_en IS NULL OR name_en = '';

-- Now make name_en NOT NULL
ALTER TABLE main_companies
ALTER COLUMN name_en SET NOT NULL;

COMMENT ON COLUMN main_companies.name_en IS 'Company English name (required)';
COMMENT ON COLUMN main_companies.name_th IS 'Company Thai name (required)';
