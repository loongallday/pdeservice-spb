-- Phase 2: Rename functions to follow fn_* or fn_trg_* convention
-- Using ALTER FUNCTION RENAME for speed (no recreation needed)

-- ============================================
-- Utility functions → fn_*
-- ============================================
ALTER FUNCTION public.user_has_min_level(integer) RENAME TO fn_user_has_min_level;
ALTER FUNCTION public.current_user_is_role_level_gt0() RENAME TO fn_user_is_level_gt0;
ALTER FUNCTION public.cleanup_expired_idempotency_keys() RENAME TO fn_cleanup_idempotency_keys;
ALTER FUNCTION public.delete_tickets_cascade(uuid[]) RENAME TO fn_delete_tickets_cascade;

-- ============================================
-- Overloaded merge_ticket_duplicates functions
-- ============================================
ALTER FUNCTION public.merge_ticket_duplicates(uuid) RENAME TO fn_merge_ticket_duplicates;
ALTER FUNCTION public.merge_ticket_duplicates(uuid, uuid[]) RENAME TO fn_merge_ticket_duplicates_batch;

-- ============================================
-- Policy helper functions (overloaded) → fn_*
-- ============================================
-- Version with (policy_name, table_name, policy_definition)
ALTER FUNCTION public.create_policy_if_table_exists(text, text, text) RENAME TO fn_create_policy_if_exists;

-- Version with (table_name, policy_name, policy_command, policy_using, policy_with_check)
ALTER FUNCTION public.create_policy_if_table_exists(text, text, text, text, text) RENAME TO fn_create_policy_if_exists_v2;

-- Drop policies helpers (overloaded)
ALTER FUNCTION public.drop_policies_if_table_exists(text) RENAME TO fn_drop_policies_if_exists;
ALTER FUNCTION public.drop_policies_if_table_exists(text, text[]) RENAME TO fn_drop_policies_if_exists_v2;

-- ============================================
-- Trigger functions → fn_trg_*
-- ============================================
ALTER FUNCTION public.sync_ticket_appointment() RENAME TO fn_trg_sync_ticket_appointment;
ALTER FUNCTION public.sync_company_name() RENAME TO fn_trg_sync_company_name;
ALTER FUNCTION public.sync_employee_department() RENAME TO fn_trg_sync_employee_dept;
ALTER FUNCTION public.sync_site_company_on_change() RENAME TO fn_trg_sync_site_company;
ALTER FUNCTION public.sync_ticket_denorm_on_change() RENAME TO fn_trg_sync_ticket_denorm;
ALTER FUNCTION public.sync_ticket_site() RENAME TO fn_trg_sync_ticket_site;
ALTER FUNCTION public.validate_ticket_merchandise_site() RENAME TO fn_trg_validate_ticket_merch;

-- ============================================
-- Update triggers to use renamed functions
-- ============================================

-- trg_sync_ticket_appointment on appointments
DROP TRIGGER IF EXISTS trg_sync_ticket_appointment ON appointments;
CREATE TRIGGER trg_main_appointments_sync
  AFTER INSERT OR UPDATE ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION fn_trg_sync_ticket_appointment();

-- trg_sync_company_name on companies
DROP TRIGGER IF EXISTS trg_sync_company_name ON companies;
CREATE TRIGGER trg_main_companies_sync_name
  AFTER UPDATE ON companies
  FOR EACH ROW
  EXECUTE FUNCTION fn_trg_sync_company_name();

-- trg_sync_employee_department on employees
DROP TRIGGER IF EXISTS trg_sync_employee_department ON employees;
CREATE TRIGGER trg_main_employees_sync_dept
  BEFORE INSERT OR UPDATE ON employees
  FOR EACH ROW
  EXECUTE FUNCTION fn_trg_sync_employee_dept();

-- trg_sync_site_company and trg_sync_ticket_site on sites
DROP TRIGGER IF EXISTS trg_sync_site_company ON sites;
CREATE TRIGGER trg_main_sites_sync_company
  BEFORE INSERT OR UPDATE ON sites
  FOR EACH ROW
  EXECUTE FUNCTION fn_trg_sync_site_company();

DROP TRIGGER IF EXISTS trg_sync_ticket_site ON sites;
CREATE TRIGGER trg_main_sites_cascade
  AFTER UPDATE ON sites
  FOR EACH ROW
  EXECUTE FUNCTION fn_trg_sync_ticket_site();

-- trg_sync_ticket_denorm on tickets
DROP TRIGGER IF EXISTS trg_sync_ticket_denorm ON tickets;
CREATE TRIGGER trg_main_tickets_sync_denorm
  BEFORE INSERT OR UPDATE ON tickets
  FOR EACH ROW
  EXECUTE FUNCTION fn_trg_sync_ticket_denorm();

-- trigger_validate_ticket_merchandise_site on ticket_merchandise
DROP TRIGGER IF EXISTS trigger_validate_ticket_merchandise_site ON ticket_merchandise;
CREATE TRIGGER trg_jct_ticket_merchandise_validate
  BEFORE INSERT OR UPDATE ON ticket_merchandise
  FOR EACH ROW
  EXECUTE FUNCTION fn_trg_validate_ticket_merch();
