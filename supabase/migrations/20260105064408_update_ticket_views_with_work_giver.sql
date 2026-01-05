-- Update v_tickets view to include work_giver information
-- Adds work_giver_id, work_giver_code, and work_giver_name columns

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
  con.person_name as contact_name,
  -- Work Giver (new)
  wg.id as work_giver_id,
  rwg.code as work_giver_code,
  rwg.name as work_giver_name
FROM main_tickets t
LEFT JOIN main_appointments a ON t.appointment_id = a.id
LEFT JOIN main_sites s ON t.site_id = s.id
LEFT JOIN main_companies c ON s.company_id = c.id
LEFT JOIN ref_ticket_work_types wt ON t.work_type_id = wt.id
LEFT JOIN ref_ticket_statuses ts ON t.status_id = ts.id
LEFT JOIN main_employees assigner ON t.assigner_id = assigner.id
LEFT JOIN main_employees creator ON t.created_by = creator.id
LEFT JOIN child_site_contacts con ON t.contact_id = con.id
LEFT JOIN child_ticket_work_givers wg ON t.id = wg.ticket_id
LEFT JOIN ref_work_givers rwg ON wg.work_giver_id = rwg.id;

-- Add comment for the view
COMMENT ON VIEW v_tickets IS 'View: Complete ticket information with all related data including work giver';

