-- Make tax_id optional in main_companies table
-- Only name_th remains required

ALTER TABLE main_companies
ALTER COLUMN tax_id DROP NOT NULL;

COMMENT ON COLUMN main_companies.tax_id IS 'Tax ID (optional)';
