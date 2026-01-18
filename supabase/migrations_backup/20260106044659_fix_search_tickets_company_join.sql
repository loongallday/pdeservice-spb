-- Fix: Change company join from c.tax_id to c.id
-- The previous migration used s.company_id = c.tax_id which caused type mismatch (uuid vs varchar)
-- This fix uses the correct join: s.company_id = c.id

DROP FUNCTION IF EXISTS search_tickets;

CREATE OR REPLACE FUNCTION search_tickets(
  -- Pagination
  p_page INTEGER DEFAULT 1,
  p_limit INTEGER DEFAULT 20,
  -- Sorting
  p_sort TEXT DEFAULT 'created_at',
  p_order TEXT DEFAULT 'desc',
  -- Date filters
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL,
  p_date_type TEXT DEFAULT 'appointed', -- 'appointed', 'created', 'updated'
  -- Entity filters
  p_site_id UUID DEFAULT NULL,
  p_status_id UUID DEFAULT NULL,
  p_work_type_id UUID DEFAULT NULL,
  p_assigner_id UUID DEFAULT NULL,
  p_contact_id UUID DEFAULT NULL,
  -- Text search (searches: ticket.details, site.name, company.name_th, company.name_en)
  p_details TEXT DEFAULT NULL,
  -- Flags
  p_exclude_backlog BOOLEAN DEFAULT FALSE,
  p_only_backlog BOOLEAN DEFAULT FALSE,
  -- Employee filter (tickets assigned to this employee)
  p_employee_id UUID DEFAULT NULL,
  -- Department filter (tickets assigned to employees in this department)
  p_department_id UUID DEFAULT NULL,
  -- Appointment approval filter
  p_appointment_is_approved BOOLEAN DEFAULT NULL
)
RETURNS TABLE (
  ticket_id UUID,
  total_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_offset INTEGER;
BEGIN
  -- Calculate offset
  v_offset := (p_page - 1) * p_limit;

  RETURN QUERY
  WITH filtered_tickets AS (
    SELECT DISTINCT t.id, t.created_at, t.updated_at, a.appointment_date
    FROM main_tickets t
    LEFT JOIN main_appointments a ON t.appointment_id = a.id
    LEFT JOIN main_sites s ON t.site_id = s.id
    LEFT JOIN main_companies c ON s.company_id = c.id  -- Fixed: use c.id instead of c.tax_id
    LEFT JOIN jct_ticket_employees jte ON t.id = jte.ticket_id
    LEFT JOIN main_employees e ON jte.employee_id = e.id
    LEFT JOIN main_org_roles r ON e.role_id = r.id  -- Join to roles to get department
    WHERE
      -- Date filter based on type
      (p_start_date IS NULL OR p_end_date IS NULL OR
        CASE p_date_type
          WHEN 'appointed' THEN a.appointment_date BETWEEN p_start_date AND p_end_date
          WHEN 'created' THEN t.created_at::date BETWEEN p_start_date AND p_end_date
          WHEN 'updated' THEN t.updated_at::date BETWEEN p_start_date AND p_end_date
          ELSE TRUE
        END
      )
      -- Entity filters
      AND (p_site_id IS NULL OR t.site_id = p_site_id)
      AND (p_status_id IS NULL OR t.status_id = p_status_id)
      AND (p_work_type_id IS NULL OR t.work_type_id = p_work_type_id)
      AND (p_assigner_id IS NULL OR t.assigner_id = p_assigner_id)
      AND (p_contact_id IS NULL OR t.contact_id = p_contact_id)
      -- Text search across multiple fields: ticket details, site name, company names
      AND (p_details IS NULL OR (
        t.details ILIKE '%' || p_details || '%'
        OR s.name ILIKE '%' || p_details || '%'
        OR c.name_th ILIKE '%' || p_details || '%'
        OR c.name_en ILIKE '%' || p_details || '%'
      ))
      -- Backlog flags
      AND (NOT p_exclude_backlog OR t.appointment_id IS NOT NULL)
      AND (NOT p_only_backlog OR t.appointment_id IS NULL)
      -- Employee filter
      AND (p_employee_id IS NULL OR jte.employee_id = p_employee_id)
      -- Department filter (via role)
      AND (p_department_id IS NULL OR r.department_id = p_department_id)
      -- Appointment approval filter
      AND (p_appointment_is_approved IS NULL OR a.is_approved = p_appointment_is_approved)
  ),
  counted AS (
    SELECT COUNT(DISTINCT id) AS cnt FROM filtered_tickets
  ),
  sorted_tickets AS (
    SELECT ft.id
    FROM filtered_tickets ft
    ORDER BY
      CASE WHEN p_order = 'asc' AND p_sort = 'created_at' THEN ft.created_at END ASC NULLS LAST,
      CASE WHEN p_order = 'asc' AND p_sort = 'updated_at' THEN ft.updated_at END ASC NULLS LAST,
      CASE WHEN p_order = 'asc' AND p_sort = 'appointment_date' THEN ft.appointment_date END ASC NULLS LAST,
      CASE WHEN p_order = 'desc' AND p_sort = 'created_at' THEN ft.created_at END DESC NULLS LAST,
      CASE WHEN p_order = 'desc' AND p_sort = 'updated_at' THEN ft.updated_at END DESC NULLS LAST,
      CASE WHEN p_order = 'desc' AND p_sort = 'appointment_date' THEN ft.appointment_date END DESC NULLS LAST,
      ft.created_at DESC NULLS LAST  -- Default fallback
    LIMIT p_limit
    OFFSET v_offset
  )
  SELECT
    st.id AS ticket_id,
    c.cnt AS total_count
  FROM sorted_tickets st
  CROSS JOIN counted c;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION search_tickets TO authenticated;
GRANT EXECUTE ON FUNCTION search_tickets TO service_role;

COMMENT ON FUNCTION search_tickets IS 'Comprehensive ticket search with server-side filtering. Text search (p_details) searches across: ticket.details, site.name, company.name_th, company.name_en. Fixed company join to use c.id.';
