-- Phase 5: Remove denormalized columns
-- Data is now accessed via views (v_tickets, v_sites, v_employees)

-- ============================================
-- Drop denormalized columns from main_tickets
-- ============================================
-- These columns were duplicating data from appointments, sites, and companies
ALTER TABLE main_tickets DROP COLUMN IF EXISTS appointment_date;
ALTER TABLE main_tickets DROP COLUMN IF EXISTS appointment_time_start;
ALTER TABLE main_tickets DROP COLUMN IF EXISTS appointment_time_end;
ALTER TABLE main_tickets DROP COLUMN IF EXISTS appointment_is_approved;
ALTER TABLE main_tickets DROP COLUMN IF EXISTS appointment_type;
ALTER TABLE main_tickets DROP COLUMN IF EXISTS site_name;
ALTER TABLE main_tickets DROP COLUMN IF EXISTS company_name;

-- ============================================
-- Drop denormalized columns from main_sites
-- ============================================
-- These columns were duplicating data from companies
ALTER TABLE main_sites DROP COLUMN IF EXISTS company_name_th;
ALTER TABLE main_sites DROP COLUMN IF EXISTS company_name_en;

-- ============================================
-- Drop denormalized column from main_employees
-- ============================================
-- This column was duplicating data from roles
ALTER TABLE main_employees DROP COLUMN IF EXISTS department_id;

-- ============================================
-- Drop related indexes (if they exist)
-- ============================================
DROP INDEX IF EXISTS idx_tickets_appt_date_status;
DROP INDEX IF EXISTS idx_tickets_site_name_trgm;
DROP INDEX IF EXISTS idx_tickets_company_name_trgm;

