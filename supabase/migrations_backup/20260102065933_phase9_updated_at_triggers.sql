-- Phase 9: Create updated_at triggers for all tables with updated_at column
-- Single reusable trigger function

-- ============================================
-- Create universal updated_at trigger function
-- ============================================
CREATE OR REPLACE FUNCTION fn_trg_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = '';

COMMENT ON FUNCTION fn_trg_set_updated_at() IS 'Universal trigger function to set updated_at on UPDATE';

-- ============================================
-- Main Tables
-- ============================================

-- main_org_departments
DROP TRIGGER IF EXISTS trg_main_org_departments_updated_at ON main_org_departments;
CREATE TRIGGER trg_main_org_departments_updated_at
  BEFORE UPDATE ON main_org_departments
  FOR EACH ROW
  EXECUTE FUNCTION fn_trg_set_updated_at();

-- main_org_roles
DROP TRIGGER IF EXISTS trg_main_org_roles_updated_at ON main_org_roles;
CREATE TRIGGER trg_main_org_roles_updated_at
  BEFORE UPDATE ON main_org_roles
  FOR EACH ROW
  EXECUTE FUNCTION fn_trg_set_updated_at();

-- main_employees
DROP TRIGGER IF EXISTS trg_main_employees_updated_at ON main_employees;
CREATE TRIGGER trg_main_employees_updated_at
  BEFORE UPDATE ON main_employees
  FOR EACH ROW
  EXECUTE FUNCTION fn_trg_set_updated_at();

-- main_companies
DROP TRIGGER IF EXISTS trg_main_companies_updated_at ON main_companies;
CREATE TRIGGER trg_main_companies_updated_at
  BEFORE UPDATE ON main_companies
  FOR EACH ROW
  EXECUTE FUNCTION fn_trg_set_updated_at();

-- main_sites (no updated_at currently, skip or add column first)
-- main_sites doesn't have updated_at, we'll skip it

-- main_models
DROP TRIGGER IF EXISTS trg_main_models_updated_at ON main_models;
CREATE TRIGGER trg_main_models_updated_at
  BEFORE UPDATE ON main_models
  FOR EACH ROW
  EXECUTE FUNCTION fn_trg_set_updated_at();

-- main_merchandise
DROP TRIGGER IF EXISTS trg_main_merchandise_updated_at ON main_merchandise;
CREATE TRIGGER trg_main_merchandise_updated_at
  BEFORE UPDATE ON main_merchandise
  FOR EACH ROW
  EXECUTE FUNCTION fn_trg_set_updated_at();

-- main_appointments
DROP TRIGGER IF EXISTS trg_main_appointments_updated_at ON main_appointments;
CREATE TRIGGER trg_main_appointments_updated_at
  BEFORE UPDATE ON main_appointments
  FOR EACH ROW
  EXECUTE FUNCTION fn_trg_set_updated_at();

-- main_tickets
DROP TRIGGER IF EXISTS trg_main_tickets_updated_at ON main_tickets;
CREATE TRIGGER trg_main_tickets_updated_at
  BEFORE UPDATE ON main_tickets
  FOR EACH ROW
  EXECUTE FUNCTION fn_trg_set_updated_at();

-- main_announcements
DROP TRIGGER IF EXISTS trg_main_announcements_updated_at ON main_announcements;
CREATE TRIGGER trg_main_announcements_updated_at
  BEFORE UPDATE ON main_announcements
  FOR EACH ROW
  EXECUTE FUNCTION fn_trg_set_updated_at();

-- main_features
DROP TRIGGER IF EXISTS trg_main_features_updated_at ON main_features;
CREATE TRIGGER trg_main_features_updated_at
  BEFORE UPDATE ON main_features
  FOR EACH ROW
  EXECUTE FUNCTION fn_trg_set_updated_at();

-- ============================================
-- Child Tables (with updated_at)
-- ============================================

-- child_site_contacts
DROP TRIGGER IF EXISTS trg_child_site_contacts_updated_at ON child_site_contacts;
CREATE TRIGGER trg_child_site_contacts_updated_at
  BEFORE UPDATE ON child_site_contacts
  FOR EACH ROW
  EXECUTE FUNCTION fn_trg_set_updated_at();

-- child_employee_leave_balances
DROP TRIGGER IF EXISTS trg_child_employee_leave_balances_updated_at ON child_employee_leave_balances;
CREATE TRIGGER trg_child_employee_leave_balances_updated_at
  BEFORE UPDATE ON child_employee_leave_balances
  FOR EACH ROW
  EXECUTE FUNCTION fn_trg_set_updated_at();

-- child_employee_leave_requests
DROP TRIGGER IF EXISTS trg_child_employee_leave_requests_updated_at ON child_employee_leave_requests;
CREATE TRIGGER trg_child_employee_leave_requests_updated_at
  BEFORE UPDATE ON child_employee_leave_requests
  FOR EACH ROW
  EXECUTE FUNCTION fn_trg_set_updated_at();

-- ============================================
-- Extension Tables
-- ============================================

-- ext_model_specifications
DROP TRIGGER IF EXISTS trg_ext_model_specifications_updated_at ON ext_model_specifications;
CREATE TRIGGER trg_ext_model_specifications_updated_at
  BEFORE UPDATE ON ext_model_specifications
  FOR EACH ROW
  EXECUTE FUNCTION fn_trg_set_updated_at();

-- ============================================
-- Reference Tables (with updated_at)
-- ============================================

-- ref_ticket_statuses
DROP TRIGGER IF EXISTS trg_ref_ticket_statuses_updated_at ON ref_ticket_statuses;
CREATE TRIGGER trg_ref_ticket_statuses_updated_at
  BEFORE UPDATE ON ref_ticket_statuses
  FOR EACH ROW
  EXECUTE FUNCTION fn_trg_set_updated_at();

-- ref_ticket_work_types
DROP TRIGGER IF EXISTS trg_ref_ticket_work_types_updated_at ON ref_ticket_work_types;
CREATE TRIGGER trg_ref_ticket_work_types_updated_at
  BEFORE UPDATE ON ref_ticket_work_types
  FOR EACH ROW
  EXECUTE FUNCTION fn_trg_set_updated_at();

-- ref_leave_types
DROP TRIGGER IF EXISTS trg_ref_leave_types_updated_at ON ref_leave_types;
CREATE TRIGGER trg_ref_leave_types_updated_at
  BEFORE UPDATE ON ref_leave_types
  FOR EACH ROW
  EXECUTE FUNCTION fn_trg_set_updated_at();

-- ref_package_items
DROP TRIGGER IF EXISTS trg_ref_package_items_updated_at ON ref_package_items;
CREATE TRIGGER trg_ref_package_items_updated_at
  BEFORE UPDATE ON ref_package_items
  FOR EACH ROW
  EXECUTE FUNCTION fn_trg_set_updated_at();

-- ref_package_services
DROP TRIGGER IF EXISTS trg_ref_package_services_updated_at ON ref_package_services;
CREATE TRIGGER trg_ref_package_services_updated_at
  BEFORE UPDATE ON ref_package_services
  FOR EACH ROW
  EXECUTE FUNCTION fn_trg_set_updated_at();

-- ============================================
-- Junction Tables (most only have created_at, skip updated_at trigger)
-- ============================================
-- jct_appointment_approvers has updated_at
DROP TRIGGER IF EXISTS trg_jct_appointment_approvers_updated_at ON jct_appointment_approvers;
CREATE TRIGGER trg_jct_appointment_approvers_updated_at
  BEFORE UPDATE ON jct_appointment_approvers
  FOR EACH ROW
  EXECUTE FUNCTION fn_trg_set_updated_at();

