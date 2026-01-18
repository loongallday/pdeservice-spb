-- Phase 4: Update views to use new table names
-- Recreate all views with correct table references

-- Drop and recreate v_tickets
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
  -- Appointment data (from main_appointments)
  a.appointment_date,
  a.appointment_time_start,
  a.appointment_time_end,
  a.is_approved as appointment_is_approved,
  a.appointment_type,
  -- Site data
  s.name as site_name,
  -- Company data
  c.name_th as company_name,
  c.name_en as company_name_en,
  c.tax_id as company_tax_id,
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
LEFT JOIN main_companies c ON s.company_id = c.tax_id
LEFT JOIN ref_ticket_work_types wt ON t.work_type_id = wt.id
LEFT JOIN ref_ticket_statuses ts ON t.status_id = ts.id
LEFT JOIN main_employees assigner ON t.assigner_id = assigner.id
LEFT JOIN main_employees creator ON t.created_by = creator.id
LEFT JOIN child_site_contacts con ON t.contact_id = con.id;

-- Drop and recreate v_employees
DROP VIEW IF EXISTS v_employees CASCADE;
CREATE OR REPLACE VIEW v_employees AS
SELECT 
  e.id,
  e.name,
  e.code,
  e.is_active,
  e.created_at,
  e.updated_at,
  e.auth_user_id,
  e.nickname,
  e.email,
  e.role_id,
  e.profile_image_url,
  e.supervisor_id,
  -- Role data
  r.code as role_code,
  r.name_th as role_name_th,
  r.name_en as role_name_en,
  r.level as role_level,
  -- Department data (via role)
  d.id as department_id,
  d.code as department_code,
  d.name_th as department_name_th,
  d.name_en as department_name_en
FROM main_employees e
LEFT JOIN main_org_roles r ON e.role_id = r.id
LEFT JOIN main_org_departments d ON r.department_id = d.id;

-- Drop and recreate v_sites
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
  c.name_th as company_name_th,
  c.name_en as company_name_en,
  c.tax_id as company_tax_id
FROM main_sites s
LEFT JOIN main_companies c ON s.company_id = c.tax_id;

-- Drop and recreate v_merchandise
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
  -- Dealer company
  deal.name_th as dealer_name
FROM main_merchandise m
LEFT JOIN main_models mo ON m.model_id = mo.id
LEFT JOIN main_sites s ON m.site_id = s.id
LEFT JOIN main_companies c ON s.company_id = c.tax_id
LEFT JOIN main_companies dist ON m.distributor_id = dist.tax_id
LEFT JOIN main_companies deal ON m.dealer_id = deal.tax_id;

-- Drop and recreate v_leave_requests
DROP VIEW IF EXISTS v_leave_requests CASCADE;
CREATE OR REPLACE VIEW v_leave_requests AS
SELECT 
  lr.id,
  lr.employee_id,
  lr.leave_type_id,
  lr.start_date,
  lr.end_date,
  lr.total_days,
  lr.reason,
  lr.status,
  lr.approved_by,
  lr.approved_at,
  lr.created_at,
  lr.updated_at,
  lr.half_day_type,
  -- Employee data
  e.name as employee_name,
  e.code as employee_code,
  -- Leave type data
  lt.name as leave_type_name,
  lt.code as leave_type_code,
  -- Approver data
  approver.name as approved_by_name,
  approver.code as approved_by_code
FROM child_employee_leave_requests lr
LEFT JOIN main_employees e ON lr.employee_id = e.id
LEFT JOIN ref_leave_types lt ON lr.leave_type_id = lt.id
LEFT JOIN main_employees approver ON lr.approved_by = approver.id;

-- Drop and recreate v_leave_balances
DROP VIEW IF EXISTS v_leave_balances CASCADE;
CREATE OR REPLACE VIEW v_leave_balances AS
SELECT 
  lb.id,
  lb.employee_id,
  lb.leave_type_id,
  lb.year,
  lb.total_days,
  lb.used_days,
  lb.remaining_days,
  lb.created_at,
  lb.updated_at,
  -- Employee data
  e.name as employee_name,
  e.code as employee_code,
  -- Leave type data
  lt.name as leave_type_name,
  lt.code as leave_type_code
FROM child_employee_leave_balances lb
LEFT JOIN main_employees e ON lb.employee_id = e.id
LEFT JOIN ref_leave_types lt ON lb.leave_type_id = lt.id;

-- Add security barrier to all views (for RLS)
ALTER VIEW v_tickets SET (security_barrier = true);
ALTER VIEW v_employees SET (security_barrier = true);
ALTER VIEW v_sites SET (security_barrier = true);
ALTER VIEW v_merchandise SET (security_barrier = true);
ALTER VIEW v_leave_requests SET (security_barrier = true);
ALTER VIEW v_leave_balances SET (security_barrier = true);

