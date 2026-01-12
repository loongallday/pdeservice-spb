-- Migration: Add RPC for workload distribution data
-- This function efficiently retrieves workload distribution data by appointment date

CREATE OR REPLACE FUNCTION get_workload_distribution_data(
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  employee_id UUID,
  ticket_id UUID,
  appointment_date DATE
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    cf.employee_id,
    cf.ticket_id,
    a.appointment_date
  FROM jct_ticket_employees_cf cf
  INNER JOIN main_tickets t ON cf.ticket_id = t.id
  INNER JOIN main_appointments a ON t.appointment_id = a.id
  WHERE a.appointment_date >= p_start_date
    AND a.appointment_date <= p_end_date;
$$;

-- Grant access
GRANT EXECUTE ON FUNCTION get_workload_distribution_data(DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION get_workload_distribution_data(DATE, DATE) TO service_role;

COMMENT ON FUNCTION get_workload_distribution_data IS 'Get workload distribution data by appointment date range';
