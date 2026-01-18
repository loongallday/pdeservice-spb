-- Phase 1: Create new views for fast reads
-- Views use current table names (will be updated in Phase 4 after table renames)

-- Drop existing views first
DROP VIEW IF EXISTS tickets_search_view CASCADE;
DROP VIEW IF EXISTS employees_view CASCADE;

-- v_tickets: Complete ticket information with all related data
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
  -- Appointment data (from appointments table)
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
FROM tickets t
LEFT JOIN appointments a ON t.appointment_id = a.id
LEFT JOIN sites s ON t.site_id = s.id
LEFT JOIN companies c ON s.company_id = c.tax_id
LEFT JOIN work_types wt ON t.work_type_id = wt.id
LEFT JOIN ticket_statuses ts ON t.status_id = ts.id
LEFT JOIN employees assigner ON t.assigner_id = assigner.id
LEFT JOIN employees creator ON t.created_by = creator.id
LEFT JOIN contacts con ON t.contact_id = con.id;

-- v_employees: Employee with role and department info
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
FROM employees e
LEFT JOIN roles r ON e.role_id = r.id
LEFT JOIN departments d ON r.department_id = d.id;

-- v_sites: Site with company info
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
FROM sites s
LEFT JOIN companies c ON s.company_id = c.tax_id;

-- v_merchandise: Merchandise with model, site, and company info
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
FROM merchandise m
LEFT JOIN models mo ON m.model_id = mo.id
LEFT JOIN sites s ON m.site_id = s.id
LEFT JOIN companies c ON s.company_id = c.tax_id
LEFT JOIN companies dist ON m.distributor_id = dist.tax_id
LEFT JOIN companies deal ON m.dealer_id = deal.tax_id;

-- v_leave_requests: Leave requests with employee and type info
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
FROM leave_requests lr
LEFT JOIN employees e ON lr.employee_id = e.id
LEFT JOIN leave_types lt ON lr.leave_type_id = lt.id
LEFT JOIN employees approver ON lr.approved_by = approver.id;

-- v_leave_balances: Leave balances with employee and type info
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
FROM leave_balances lb
LEFT JOIN employees e ON lb.employee_id = e.id
LEFT JOIN leave_types lt ON lb.leave_type_id = lt.id;

-- Add security barrier to all views (for RLS)
ALTER VIEW v_tickets SET (security_barrier = true);
ALTER VIEW v_employees SET (security_barrier = true);
ALTER VIEW v_sites SET (security_barrier = true);
ALTER VIEW v_merchandise SET (security_barrier = true);
ALTER VIEW v_leave_requests SET (security_barrier = true);
ALTER VIEW v_leave_balances SET (security_barrier = true);

-- Add comments
COMMENT ON VIEW v_tickets IS 'Complete ticket view with appointment, site, company, work type, status, assigner, and creator info';
COMMENT ON VIEW v_employees IS 'Employee view with role and department info';
COMMENT ON VIEW v_sites IS 'Site view with company info';
COMMENT ON VIEW v_merchandise IS 'Merchandise view with model, site, company, distributor, and dealer info';
COMMENT ON VIEW v_leave_requests IS 'Leave request view with employee and leave type info';
COMMENT ON VIEW v_leave_balances IS 'Leave balance view with employee and leave type info';

