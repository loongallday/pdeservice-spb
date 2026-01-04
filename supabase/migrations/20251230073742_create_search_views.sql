-- Create views for simplified querying

-- Tickets search view with all denormalized fields
CREATE OR REPLACE VIEW tickets_search_view AS
SELECT 
  t.id,
  t.details,
  t.status_id,
  t.work_type_id,
  t.assigner_id,
  t.site_id,
  t.contact_id,
  t.created_at,
  t.updated_at,
  t.created_by,
  t.additional,
  t.appointment_id,
  t.appointment_date,
  t.appointment_time_start,
  t.appointment_time_end,
  t.appointment_is_approved,
  t.appointment_type,
  t.site_name,
  t.company_name,
  wt.name AS work_type_name,
  wt.code AS work_type_code,
  ts.name AS status_name,
  ts.code AS status_code,
  assigner.name AS assigner_name,
  assigner.code AS assigner_code,
  creator.name AS creator_name,
  creator.code AS creator_code,
  contact.person_name AS contact_name
FROM tickets t
LEFT JOIN work_types wt ON t.work_type_id = wt.id
LEFT JOIN ticket_statuses ts ON t.status_id = ts.id
LEFT JOIN employees assigner ON t.assigner_id = assigner.id
LEFT JOIN employees creator ON t.created_by = creator.id
LEFT JOIN contacts contact ON t.contact_id = contact.id;

-- Employees view with role and department info
CREATE OR REPLACE VIEW employees_view AS
SELECT 
  e.id,
  e.code,
  e.name,
  e.email,
  e.nickname,
  e.is_active,
  e.role_id,
  e.department_id,
  e.auth_user_id,
  e.profile_image_url,
  e.created_at,
  e.updated_at,
  r.code AS role_code,
  r.name_th AS role_name_th,
  r.name_en AS role_name_en,
  d.code AS department_code,
  d.name_th AS department_name_th,
  d.name_en AS department_name_en
FROM employees e
LEFT JOIN roles r ON e.role_id = r.id
LEFT JOIN departments d ON e.department_id = d.id;

