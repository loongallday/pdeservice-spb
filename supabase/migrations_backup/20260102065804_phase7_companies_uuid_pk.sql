-- Phase 7: Change main_companies PK from tax_id (varchar) to id (UUID)
-- This is a complex migration that requires careful ordering

-- ============================================
-- Step 0: Drop views that depend on company_id
-- ============================================
DROP VIEW IF EXISTS v_tickets CASCADE;
DROP VIEW IF EXISTS v_sites CASCADE;
DROP VIEW IF EXISTS v_merchandise CASCADE;

-- ============================================
-- Step 1: Add UUID id column to main_companies
-- ============================================
ALTER TABLE main_companies ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();

-- Generate UUIDs for existing rows
UPDATE main_companies SET id = gen_random_uuid() WHERE id IS NULL;

-- Make id NOT NULL
ALTER TABLE main_companies ALTER COLUMN id SET NOT NULL;

-- ============================================
-- Step 2: Add new UUID FK columns to referencing tables
-- ============================================
-- main_sites: company_id (varchar) -> company_id_new (UUID)
ALTER TABLE main_sites ADD COLUMN IF NOT EXISTS company_id_new UUID;

-- main_merchandise: distributor_id and dealer_id (varchar) -> UUID
ALTER TABLE main_merchandise ADD COLUMN IF NOT EXISTS distributor_id_new UUID;
ALTER TABLE main_merchandise ADD COLUMN IF NOT EXISTS dealer_id_new UUID;

-- ============================================
-- Step 3: Populate new UUID columns from existing varchar references
-- ============================================
UPDATE main_sites s
SET company_id_new = c.id
FROM main_companies c
WHERE s.company_id = c.tax_id;

UPDATE main_merchandise m
SET distributor_id_new = c.id
FROM main_companies c
WHERE m.distributor_id = c.tax_id;

UPDATE main_merchandise m
SET dealer_id_new = c.id
FROM main_companies c
WHERE m.dealer_id = c.tax_id;

-- ============================================
-- Step 4: Drop old FK constraints
-- ============================================
ALTER TABLE main_sites DROP CONSTRAINT IF EXISTS main_sites_company_id_fkey;
ALTER TABLE main_merchandise DROP CONSTRAINT IF EXISTS main_merchandise_distributor_id_fkey;
ALTER TABLE main_merchandise DROP CONSTRAINT IF EXISTS main_merchandise_dealer_id_fkey;

-- ============================================
-- Step 5: Drop old varchar FK columns
-- ============================================
ALTER TABLE main_sites DROP COLUMN IF EXISTS company_id;
ALTER TABLE main_merchandise DROP COLUMN IF EXISTS distributor_id;
ALTER TABLE main_merchandise DROP COLUMN IF EXISTS dealer_id;

-- ============================================
-- Step 6: Rename new columns to original names
-- ============================================
ALTER TABLE main_sites RENAME COLUMN company_id_new TO company_id;
ALTER TABLE main_merchandise RENAME COLUMN distributor_id_new TO distributor_id;
ALTER TABLE main_merchandise RENAME COLUMN dealer_id_new TO dealer_id;

-- ============================================
-- Step 7: Change primary key from tax_id to id
-- ============================================
-- First drop the old primary key
ALTER TABLE main_companies DROP CONSTRAINT IF EXISTS companies_pkey;

-- Create new primary key on id
ALTER TABLE main_companies ADD PRIMARY KEY (id);

-- Create unique index on tax_id (still needed for DBD API lookups)
CREATE UNIQUE INDEX IF NOT EXISTS idx_main_companies_tax_id ON main_companies(tax_id);

-- ============================================
-- Step 8: Add new FK constraints
-- ============================================
ALTER TABLE main_sites 
  ADD CONSTRAINT main_sites_company_id_fkey 
  FOREIGN KEY (company_id) REFERENCES main_companies(id);

ALTER TABLE main_merchandise 
  ADD CONSTRAINT main_merchandise_distributor_id_fkey 
  FOREIGN KEY (distributor_id) REFERENCES main_companies(id);

ALTER TABLE main_merchandise 
  ADD CONSTRAINT main_merchandise_dealer_id_fkey 
  FOREIGN KEY (dealer_id) REFERENCES main_companies(id);

-- ============================================
-- Step 9: Add indexes on new FK columns
-- ============================================
CREATE INDEX IF NOT EXISTS idx_main_sites_company_id ON main_sites(company_id);
CREATE INDEX IF NOT EXISTS idx_main_merchandise_distributor_id ON main_merchandise(distributor_id);
CREATE INDEX IF NOT EXISTS idx_main_merchandise_dealer_id ON main_merchandise(dealer_id);

-- ============================================
-- Step 10: Update views to use new company_id (UUID)
-- ============================================
-- v_sites needs update
DROP VIEW IF EXISTS v_sites CASCADE;
CREATE OR REPLACE VIEW v_sites AS
SELECT 
  s.id,
  s.name,
  s.address_detail,
  s.subdistrict_code,
  s.postal_code,
  s.contact_ids,
  s.map_url,
  s.company_id,
  s.district_code,
  s.province_code,
  s.is_main_branch,
  s.safety_standard,
  -- Company data
  c.tax_id as company_tax_id,
  c.name_th as company_name_th,
  c.name_en as company_name_en
FROM main_sites s
LEFT JOIN main_companies c ON s.company_id = c.id;

-- v_merchandise needs update
DROP VIEW IF EXISTS v_merchandise CASCADE;
CREATE OR REPLACE VIEW v_merchandise AS
SELECT 
  m.id,
  m.serial_no,
  m.model_id,
  m.site_id,
  m.pm_count,
  m.distributor_id,
  m.dealer_id,
  m.replaced_by_id,
  m.created_at,
  m.updated_at,
  -- Model data
  mo.model as model_name,
  mo.name as model_display_name,
  mo.website_url as model_website_url,
  -- Site data
  s.name as site_name,
  -- Company data (via site)
  c.name_th as company_name,
  c.name_en as company_name_en,
  c.tax_id as company_tax_id,
  -- Distributor company
  dist.name_th as distributor_name,
  dist.tax_id as distributor_tax_id,
  -- Dealer company
  deal.name_th as dealer_name,
  deal.tax_id as dealer_tax_id
FROM main_merchandise m
LEFT JOIN main_models mo ON m.model_id = mo.id
LEFT JOIN main_sites s ON m.site_id = s.id
LEFT JOIN main_companies c ON s.company_id = c.id
LEFT JOIN main_companies dist ON m.distributor_id = dist.id
LEFT JOIN main_companies deal ON m.dealer_id = deal.id;

-- v_tickets needs update for company join
DROP VIEW IF EXISTS v_tickets CASCADE;
CREATE OR REPLACE VIEW v_tickets AS
SELECT 
  t.id,
  t.details,
  t.work_type_id,
  t.assigner_id,
  t.status_id,
  t.additional,
  t.created_at,
  t.updated_at,
  t.site_id,
  t.contact_id,
  t.appointment_id,
  t.created_by,
  -- Appointment data
  a.appointment_date,
  a.appointment_time_start,
  a.appointment_time_end,
  a.is_approved as appointment_is_approved,
  a.appointment_type,
  -- Site data
  s.name as site_name,
  s.company_id,
  -- Company data
  c.tax_id as company_tax_id,
  c.name_th as company_name,
  c.name_en as company_name_en,
  -- Work type
  wt.name as work_type_name,
  wt.code as work_type_code,
  -- Status
  ts.name as status_name,
  ts.code as status_code,
  -- Assigner
  assigner.name as assigner_name,
  assigner.code as assigner_code,
  -- Creator
  creator.name as creator_name,
  creator.code as creator_code,
  -- Contact
  con.person_name as contact_name
FROM main_tickets t
LEFT JOIN main_appointments a ON t.appointment_id = a.id
LEFT JOIN main_sites s ON t.site_id = s.id
LEFT JOIN main_companies c ON s.company_id = c.id
LEFT JOIN ref_ticket_work_types wt ON t.work_type_id = wt.id
LEFT JOIN ref_ticket_statuses ts ON t.status_id = ts.id
LEFT JOIN main_employees assigner ON t.assigner_id = assigner.id
LEFT JOIN main_employees creator ON t.created_by = creator.id
LEFT JOIN child_site_contacts con ON t.contact_id = con.id;

-- Add security barrier back
ALTER VIEW v_sites SET (security_barrier = true);
ALTER VIEW v_merchandise SET (security_barrier = true);
ALTER VIEW v_tickets SET (security_barrier = true);

-- ============================================
-- Step 11: Update comments
-- ============================================
COMMENT ON COLUMN main_companies.id IS 'Primary key (UUID)';
COMMENT ON COLUMN main_companies.tax_id IS 'Tax ID from DBD API (unique, used for lookups)';
COMMENT ON COLUMN main_sites.company_id IS 'FK to main_companies.id (UUID)';
COMMENT ON COLUMN main_merchandise.distributor_id IS 'FK to main_companies.id (UUID)';
COMMENT ON COLUMN main_merchandise.dealer_id IS 'FK to main_companies.id (UUID)';

