-- Fix cascade delete for site-related tables
-- When a site is deleted, related records should be handled appropriately

-- ============================================
-- child_site_contacts: Add ON DELETE CASCADE
-- Contacts belong to site, delete when site deleted
-- ============================================
ALTER TABLE child_site_contacts
DROP CONSTRAINT IF EXISTS child_site_contacts_site_id_fkey;

ALTER TABLE child_site_contacts
ADD CONSTRAINT child_site_contacts_site_id_fkey
FOREIGN KEY (site_id) REFERENCES main_sites(id) ON DELETE CASCADE;

-- ============================================
-- main_tickets: Add ON DELETE SET NULL
-- Tickets should be preserved, just clear site reference
-- ============================================
ALTER TABLE main_tickets
DROP CONSTRAINT IF EXISTS main_tickets_site_id_fkey;

ALTER TABLE main_tickets
ADD CONSTRAINT main_tickets_site_id_fkey
FOREIGN KEY (site_id) REFERENCES main_sites(id) ON DELETE SET NULL;

-- ============================================
-- main_merchandise: Add ON DELETE SET NULL
-- Equipment should be preserved, just clear site reference
-- ============================================
ALTER TABLE main_merchandise
DROP CONSTRAINT IF EXISTS main_merchandise_site_id_fkey;

ALTER TABLE main_merchandise
ADD CONSTRAINT main_merchandise_site_id_fkey
FOREIGN KEY (site_id) REFERENCES main_sites(id) ON DELETE SET NULL;

-- ============================================
-- jct_site_employee_trainings: Already has ON DELETE CASCADE
-- Just verify it exists
-- ============================================
-- No change needed - already has CASCADE

-- ============================================
-- Summary of cascade delete behavior for sites:
-- ============================================
-- Tables with ON DELETE CASCADE (auto-delete when site deleted):
--   - child_site_contacts (site contacts deleted)
--   - jct_site_employee_trainings (training records deleted)
--
-- Tables with ON DELETE SET NULL (keep record, clear site_id):
--   - main_tickets (preserve ticket history)
--   - main_merchandise (preserve equipment records)
