-- Phase 3: Rename all tables to new naming convention
-- Using ALTER TABLE RENAME for speed (instant operation)
-- Order: referenced tables first, referencing tables last

-- ============================================
-- Reference Tables (ref_*) - No dependencies
-- ============================================
ALTER TABLE IF EXISTS public.ticket_statuses RENAME TO ref_ticket_statuses;
ALTER TABLE IF EXISTS public.work_types RENAME TO ref_ticket_work_types;
ALTER TABLE IF EXISTS public.leave_types RENAME TO ref_leave_types;
ALTER TABLE IF EXISTS public.package_items RENAME TO ref_package_items;
ALTER TABLE IF EXISTS public.package_services RENAME TO ref_package_services;

-- ============================================
-- Organization Tables (main_org_*)
-- ============================================
ALTER TABLE IF EXISTS public.departments RENAME TO main_org_departments;
ALTER TABLE IF EXISTS public.roles RENAME TO main_org_roles;

-- ============================================
-- Main Tables (main_*)
-- ============================================
ALTER TABLE IF EXISTS public.companies RENAME TO main_companies;
ALTER TABLE IF EXISTS public.employees RENAME TO main_employees;
ALTER TABLE IF EXISTS public.sites RENAME TO main_sites;
ALTER TABLE IF EXISTS public.models RENAME TO main_models;
ALTER TABLE IF EXISTS public.merchandise RENAME TO main_merchandise;
ALTER TABLE IF EXISTS public.appointments RENAME TO main_appointments;
ALTER TABLE IF EXISTS public.tickets RENAME TO main_tickets;
ALTER TABLE IF EXISTS public.announcements RENAME TO main_announcements;
ALTER TABLE IF EXISTS public.feature RENAME TO main_features;

-- ============================================
-- Child Tables (child_*)
-- ============================================
ALTER TABLE IF EXISTS public.contacts RENAME TO child_site_contacts;
ALTER TABLE IF EXISTS public.ticket_audit RENAME TO child_ticket_audit;
ALTER TABLE IF EXISTS public.announcement_photos RENAME TO child_announcement_photos;
ALTER TABLE IF EXISTS public.announcement_files RENAME TO child_announcement_files;
ALTER TABLE IF EXISTS public.leave_balances RENAME TO child_employee_leave_balances;
ALTER TABLE IF EXISTS public.leave_requests RENAME TO child_employee_leave_requests;

-- ============================================
-- Extension Tables (ext_*)
-- ============================================
ALTER TABLE IF EXISTS public.model_specifications RENAME TO ext_model_specifications;

-- ============================================
-- Junction Tables (jct_*)
-- ============================================
ALTER TABLE IF EXISTS public.ticket_employees RENAME TO jct_ticket_employees;
ALTER TABLE IF EXISTS public.ticket_merchandise RENAME TO jct_ticket_merchandise;
ALTER TABLE IF EXISTS public.appointment_approval_users RENAME TO jct_appointment_approvers;
ALTER TABLE IF EXISTS public.employee_site_trainings RENAME TO jct_site_employee_trainings;
ALTER TABLE IF EXISTS public.model_package_items RENAME TO jct_model_package_items;
ALTER TABLE IF EXISTS public.model_package_services RENAME TO jct_model_package_services;

-- ============================================
-- System Tables (sys_*)
-- ============================================
ALTER TABLE IF EXISTS public.idempotency_keys RENAME TO sys_idempotency_keys;

-- ============================================
-- Rename FK constraints to match new table names
-- ============================================
-- This helps with clarity and debugging

-- main_employees FKs
ALTER TABLE main_employees 
  RENAME CONSTRAINT employees_role_id_fkey TO main_employees_role_id_fkey;
ALTER TABLE main_employees 
  RENAME CONSTRAINT employees_supervisor_id_fkey TO main_employees_supervisor_id_fkey;
ALTER TABLE main_employees 
  RENAME CONSTRAINT employees_auth_user_id_fkey TO main_employees_auth_user_id_fkey;
ALTER TABLE main_employees 
  RENAME CONSTRAINT employees_department_id_fkey TO main_employees_department_id_fkey;

-- main_org_roles FKs
ALTER TABLE main_org_roles 
  RENAME CONSTRAINT roles_department_id_fkey TO main_org_roles_department_id_fkey;

-- main_org_departments FKs
ALTER TABLE main_org_departments 
  RENAME CONSTRAINT departments_head_id_fkey TO main_org_departments_head_id_fkey;

-- main_sites FKs
ALTER TABLE main_sites 
  RENAME CONSTRAINT sites_company_id_fkey TO main_sites_company_id_fkey;

-- child_site_contacts FKs
ALTER TABLE child_site_contacts 
  RENAME CONSTRAINT contacts_site_id_fkey TO child_site_contacts_site_id_fkey;

-- main_tickets FKs
ALTER TABLE main_tickets 
  RENAME CONSTRAINT tickets_work_type_id_fkey TO main_tickets_work_type_id_fkey;
ALTER TABLE main_tickets 
  RENAME CONSTRAINT tickets_status_id_fkey TO main_tickets_status_id_fkey;
ALTER TABLE main_tickets 
  RENAME CONSTRAINT tickets_assigner_id_fkey TO main_tickets_assigner_id_fkey;
ALTER TABLE main_tickets 
  RENAME CONSTRAINT tickets_site_id_fkey TO main_tickets_site_id_fkey;
ALTER TABLE main_tickets 
  RENAME CONSTRAINT tickets_contact_id_fkey TO main_tickets_contact_id_fkey;
ALTER TABLE main_tickets 
  RENAME CONSTRAINT tickets_appointment_id_fkey TO main_tickets_appointment_id_fkey;
ALTER TABLE main_tickets 
  RENAME CONSTRAINT tickets_created_by_fkey TO main_tickets_created_by_fkey;

-- jct_ticket_employees FKs
ALTER TABLE jct_ticket_employees 
  RENAME CONSTRAINT ticket_employees_ticket_id_fkey TO jct_ticket_employees_ticket_id_fkey;
ALTER TABLE jct_ticket_employees 
  RENAME CONSTRAINT ticket_employees_employee_id_fkey TO jct_ticket_employees_employee_id_fkey;

-- jct_ticket_merchandise FKs
ALTER TABLE jct_ticket_merchandise 
  RENAME CONSTRAINT ticket_merchandise_ticket_id_fkey TO jct_ticket_merchandise_ticket_id_fkey;
ALTER TABLE jct_ticket_merchandise 
  RENAME CONSTRAINT ticket_merchandise_merchandise_id_fkey TO jct_ticket_merchandise_merch_id_fkey;

-- child_ticket_audit FKs
ALTER TABLE child_ticket_audit 
  RENAME CONSTRAINT ticket_audit_ticket_id_fkey TO child_ticket_audit_ticket_id_fkey;
ALTER TABLE child_ticket_audit 
  RENAME CONSTRAINT ticket_audit_changed_by_fkey TO child_ticket_audit_changed_by_fkey;

-- main_merchandise FKs
ALTER TABLE main_merchandise 
  RENAME CONSTRAINT merchandise_model_id_fkey TO main_merchandise_model_id_fkey;
ALTER TABLE main_merchandise 
  RENAME CONSTRAINT merchandise_site_id_fkey TO main_merchandise_site_id_fkey;
ALTER TABLE main_merchandise 
  RENAME CONSTRAINT merchandise_distributor_id_fkey TO main_merchandise_distributor_id_fkey;
ALTER TABLE main_merchandise 
  RENAME CONSTRAINT merchandise_dealer_id_fkey TO main_merchandise_dealer_id_fkey;
ALTER TABLE main_merchandise 
  RENAME CONSTRAINT merchandise_replaced_by_id_fkey TO main_merchandise_replaced_by_id_fkey;

-- ext_model_specifications FK
ALTER TABLE ext_model_specifications 
  RENAME CONSTRAINT model_specifications_model_id_fkey TO ext_model_specifications_model_id_fkey;

-- jct_model_package_items FKs
ALTER TABLE jct_model_package_items 
  RENAME CONSTRAINT model_package_items_model_id_fkey TO jct_model_package_items_model_id_fkey;
ALTER TABLE jct_model_package_items 
  RENAME CONSTRAINT model_package_items_item_id_fkey TO jct_model_package_items_item_id_fkey;

-- jct_model_package_services FKs
ALTER TABLE jct_model_package_services 
  RENAME CONSTRAINT model_package_services_model_id_fkey TO jct_model_package_services_model_id_fkey;
ALTER TABLE jct_model_package_services 
  RENAME CONSTRAINT model_package_services_service_id_fkey TO jct_model_package_services_service_id_fkey;

-- child_employee_leave_balances FKs
ALTER TABLE child_employee_leave_balances 
  RENAME CONSTRAINT leave_balances_employee_id_fkey TO child_employee_leave_balances_employee_id_fkey;
ALTER TABLE child_employee_leave_balances 
  RENAME CONSTRAINT leave_balances_leave_type_id_fkey TO child_employee_leave_balances_type_id_fkey;

-- child_employee_leave_requests FKs
ALTER TABLE child_employee_leave_requests 
  RENAME CONSTRAINT leave_requests_employee_id_fkey TO child_employee_leave_requests_employee_id_fkey;
ALTER TABLE child_employee_leave_requests 
  RENAME CONSTRAINT leave_requests_leave_type_id_fkey TO child_employee_leave_requests_type_id_fkey;
ALTER TABLE child_employee_leave_requests 
  RENAME CONSTRAINT leave_requests_approved_by_fkey TO child_employee_leave_requests_approved_by_fkey;

-- child_announcement_photos FK
ALTER TABLE child_announcement_photos 
  RENAME CONSTRAINT announcement_photos_announcement_id_fkey TO child_announcement_photos_ann_id_fkey;

-- child_announcement_files FK
ALTER TABLE child_announcement_files 
  RENAME CONSTRAINT announcement_files_announcement_id_fkey TO child_announcement_files_ann_id_fkey;

-- jct_appointment_approvers FK
ALTER TABLE jct_appointment_approvers 
  RENAME CONSTRAINT appointment_approval_users_employee_id_fkey TO jct_appointment_approvers_employee_id_fkey;

-- jct_site_employee_trainings FKs
ALTER TABLE jct_site_employee_trainings 
  RENAME CONSTRAINT employee_site_trainings_site_id_fkey TO jct_site_employee_trainings_site_id_fkey;
ALTER TABLE jct_site_employee_trainings 
  RENAME CONSTRAINT employee_site_trainings_employee_id_fkey TO jct_site_employee_trainings_employee_id_fkey;

-- sys_idempotency_keys FK
ALTER TABLE sys_idempotency_keys 
  RENAME CONSTRAINT idempotency_keys_employee_id_fkey TO sys_idempotency_keys_employee_id_fkey;

-- ============================================
-- Update table comments
-- ============================================
COMMENT ON TABLE ref_ticket_statuses IS 'Reference: Ticket status lookup values';
COMMENT ON TABLE ref_ticket_work_types IS 'Reference: Ticket work type lookup values';
COMMENT ON TABLE ref_leave_types IS 'Reference: Leave type lookup values';
COMMENT ON TABLE ref_package_items IS 'Reference: Package item catalog';
COMMENT ON TABLE ref_package_services IS 'Reference: Package service catalog';

COMMENT ON TABLE main_org_departments IS 'Main: Organizational departments';
COMMENT ON TABLE main_org_roles IS 'Main: Employee roles with permissions';

COMMENT ON TABLE main_companies IS 'Main: Company information from DBD API';
COMMENT ON TABLE main_employees IS 'Main: Employee records';
COMMENT ON TABLE main_sites IS 'Main: Customer sites/locations';
COMMENT ON TABLE main_models IS 'Main: Product model catalog';
COMMENT ON TABLE main_merchandise IS 'Main: Merchandise/equipment at sites';
COMMENT ON TABLE main_appointments IS 'Main: Appointment scheduling';
COMMENT ON TABLE main_tickets IS 'Main: Work tickets';
COMMENT ON TABLE main_announcements IS 'Main: System announcements';
COMMENT ON TABLE main_features IS 'Main: Feature flags and permissions';

COMMENT ON TABLE child_site_contacts IS 'Child of main_sites: Contact persons at sites';
COMMENT ON TABLE child_ticket_audit IS 'Child of main_tickets: Audit trail for tickets';
COMMENT ON TABLE child_announcement_photos IS 'Child of main_announcements: Photo attachments';
COMMENT ON TABLE child_announcement_files IS 'Child of main_announcements: File attachments';
COMMENT ON TABLE child_employee_leave_balances IS 'Child of main_employees: Leave balance per year';
COMMENT ON TABLE child_employee_leave_requests IS 'Child of main_employees: Leave requests';

COMMENT ON TABLE ext_model_specifications IS 'Extension of main_models: Technical specifications (1:1)';

COMMENT ON TABLE jct_ticket_employees IS 'Junction: Tickets <-> Employees assignment';
COMMENT ON TABLE jct_ticket_merchandise IS 'Junction: Tickets <-> Merchandise';
COMMENT ON TABLE jct_appointment_approvers IS 'Junction: Appointment approval permissions';
COMMENT ON TABLE jct_site_employee_trainings IS 'Junction: Sites <-> Employees training';
COMMENT ON TABLE jct_model_package_items IS 'Junction: Models <-> Package items';
COMMENT ON TABLE jct_model_package_services IS 'Junction: Models <-> Package services';

COMMENT ON TABLE sys_idempotency_keys IS 'System: Idempotency keys for duplicate prevention';

