-- Function to get ticket IDs by appointment date range
-- This avoids URL length issues with large IN clauses
CREATE OR REPLACE FUNCTION search_ticket_ids_by_appointment_date(
  p_start_date DATE,
  p_end_date DATE,
  p_limit INTEGER DEFAULT 100,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  ticket_id UUID,
  total_count BIGINT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH matching_tickets AS (
    SELECT t.id
    FROM main_tickets t
    INNER JOIN main_appointments a ON t.appointment_id = a.id
    WHERE a.appointment_date >= p_start_date
      AND a.appointment_date <= p_end_date
  ),
  counted AS (
    SELECT COUNT(*) AS cnt FROM matching_tickets
  )
  SELECT 
    mt.id AS ticket_id,
    c.cnt AS total_count
  FROM matching_tickets mt
  CROSS JOIN counted c
  ORDER BY mt.id
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION search_ticket_ids_by_appointment_date TO authenticated;
GRANT EXECUTE ON FUNCTION search_ticket_ids_by_appointment_date TO service_role;

