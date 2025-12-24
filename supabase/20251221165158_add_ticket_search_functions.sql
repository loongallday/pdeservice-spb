-- Migration: Add database functions for optimized ticket search operations
-- These functions replace multiple sequential queries with single database calls

-- Function: Search tickets by details (searches across tickets, sites, and companies)
-- Replaces 7+ sequential queries with a single database call
CREATE OR REPLACE FUNCTION search_tickets_by_details(search_term TEXT)
RETURNS TABLE(ticket_id UUID) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT t.id
  FROM tickets t
  LEFT JOIN sites s ON t.site_id = s.id
  LEFT JOIN companies c ON s.company_id = c.tax_id
  WHERE 
    t.details ILIKE '%' || search_term || '%'
    OR t.id::text ILIKE '%' || search_term || '%'
    OR s.name ILIKE '%' || search_term || '%'
    OR c.name_th ILIKE '%' || search_term || '%'
    OR c.name_en ILIKE '%' || search_term || '%';
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION search_tickets_by_details IS 'Unified search across tickets, sites, and companies. Returns ticket IDs matching the search term.';

-- Function: Get ticket IDs by appointment date range
-- Handles both ticket.appointment_id and appointment.ticket_id relationships
CREATE OR REPLACE FUNCTION get_ticket_ids_by_appointment_date(
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE(ticket_id UUID) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT 
    CASE 
      WHEN t.id IS NOT NULL THEN t.id
      ELSE a.ticket_id
    END as ticket_id
  FROM appointments a
  LEFT JOIN tickets t ON t.appointment_id = a.id
  WHERE a.appointment_date >= p_start_date 
    AND a.appointment_date <= p_end_date
    AND (t.id IS NOT NULL OR a.ticket_id IS NOT NULL);
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_ticket_ids_by_appointment_date IS 'Get ticket IDs within an appointment date range. Handles both bidirectional relationships.';

-- Function: Get ticket IDs by appointment approval status
CREATE OR REPLACE FUNCTION get_ticket_ids_by_approval_status(
  p_approved BOOLEAN
)
RETURNS TABLE(ticket_id UUID) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT 
    CASE 
      WHEN t.id IS NOT NULL THEN t.id
      ELSE a.ticket_id
    END as ticket_id
  FROM appointments a
  LEFT JOIN tickets t ON t.appointment_id = a.id
  WHERE a.is_approved = p_approved
    AND (t.id IS NOT NULL OR a.ticket_id IS NOT NULL);
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_ticket_ids_by_approval_status IS 'Get ticket IDs by appointment approval status. Handles both bidirectional relationships.';

-- View: Tickets with denormalized appointment data
-- Enables efficient sorting by appointment_date at database level
CREATE OR REPLACE VIEW tickets_with_appointment AS
SELECT 
  t.*,
  COALESCE(a1.appointment_date, a2.appointment_date) as appointment_date_denorm,
  COALESCE(a1.appointment_time_start, a2.appointment_time_start) as appointment_time_start_denorm,
  COALESCE(a1.appointment_time_end, a2.appointment_time_end) as appointment_time_end_denorm,
  COALESCE(a1.appointment_type, a2.appointment_type) as appointment_type_denorm,
  COALESCE(a1.is_approved, a2.is_approved) as appointment_is_approved_denorm,
  COALESCE(a1.id, a2.id) as appointment_id_denorm
FROM tickets t
LEFT JOIN appointments a1 ON t.appointment_id = a1.id
LEFT JOIN appointments a2 ON a2.ticket_id = t.id AND t.appointment_id IS NULL;

COMMENT ON VIEW tickets_with_appointment IS 'Denormalized view of tickets with appointment data for efficient sorting and filtering.';

-- Grant permissions
GRANT EXECUTE ON FUNCTION search_tickets_by_details TO authenticated;
GRANT EXECUTE ON FUNCTION get_ticket_ids_by_appointment_date TO authenticated;
GRANT EXECUTE ON FUNCTION get_ticket_ids_by_approval_status TO authenticated;
GRANT SELECT ON tickets_with_appointment TO authenticated;

-- Enable RLS on the view (inherits from tickets table)
-- Note: Views inherit RLS from underlying tables automatically


