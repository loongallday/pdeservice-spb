-- Phase 6: Remove sync triggers (no longer needed with views)
-- Keep validation trigger (fn_trg_validate_ticket_merch)

-- ============================================
-- Drop sync triggers
-- ============================================

-- Drop trigger on main_appointments (was syncing to tickets)
DROP TRIGGER IF EXISTS trg_main_appointments_sync ON main_appointments;

-- Drop trigger on main_companies (was syncing company name to sites/tickets)
DROP TRIGGER IF EXISTS trg_main_companies_sync_name ON main_companies;

-- Drop trigger on main_employees (was syncing department_id from roles)
DROP TRIGGER IF EXISTS trg_main_employees_sync_dept ON main_employees;

-- Drop triggers on main_sites (was syncing company name and updating tickets)
DROP TRIGGER IF EXISTS trg_main_sites_sync_company ON main_sites;
DROP TRIGGER IF EXISTS trg_main_sites_cascade ON main_sites;

-- Drop trigger on main_tickets (was syncing denormalized data on insert/update)
DROP TRIGGER IF EXISTS trg_main_tickets_sync_denorm ON main_tickets;

-- ============================================
-- Drop sync trigger functions (no longer needed)
-- ============================================
DROP FUNCTION IF EXISTS fn_trg_sync_ticket_appointment();
DROP FUNCTION IF EXISTS fn_trg_sync_company_name();
DROP FUNCTION IF EXISTS fn_trg_sync_employee_dept();
DROP FUNCTION IF EXISTS fn_trg_sync_site_company();
DROP FUNCTION IF EXISTS fn_trg_sync_ticket_site();
DROP FUNCTION IF EXISTS fn_trg_sync_ticket_denorm();

-- ============================================
-- Keep validation trigger (important for data integrity)
-- ============================================
-- trg_jct_ticket_merchandise_validate on jct_ticket_merchandise
-- Uses fn_trg_validate_ticket_merch - this stays!

COMMENT ON TRIGGER trg_jct_ticket_merchandise_validate ON jct_ticket_merchandise 
  IS 'Validates that merchandise belongs to the same site as the ticket';

