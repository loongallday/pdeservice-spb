-- Migration: Add RPC for technician detail data
-- This function efficiently retrieves technician detail data by appointment date

CREATE OR REPLACE FUNCTION get_technician_detail_data(
  p_employee_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  ticket_id UUID,
  appointment_date DATE,
  work_type_code VARCHAR,
  work_type_name VARCHAR,
  province_code INTEGER
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    t.id as ticket_id,
    a.appointment_date,
    wt.code as work_type_code,
    wt.name as work_type_name,
    s.province_code
  FROM jct_ticket_employees_cf cf
  INNER JOIN main_tickets t ON cf.ticket_id = t.id
  INNER JOIN main_appointments a ON t.appointment_id = a.id
  LEFT JOIN ref_ticket_work_types wt ON t.work_type_id = wt.id
  LEFT JOIN main_sites s ON t.site_id = s.id
  WHERE cf.employee_id = p_employee_id
    AND a.appointment_date >= p_start_date
    AND a.appointment_date <= p_end_date;
$$;

-- Grant access
GRANT EXECUTE ON FUNCTION get_technician_detail_data(UUID, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION get_technician_detail_data(UUID, DATE, DATE) TO service_role;

COMMENT ON FUNCTION get_technician_detail_data IS 'Get technician detail data by employee ID and appointment date range';
