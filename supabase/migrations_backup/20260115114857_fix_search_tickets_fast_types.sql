-- =============================================
-- Fix search_tickets_fast - cast varchar to text for return type compatibility
-- =============================================

DROP FUNCTION IF EXISTS search_tickets_fast;

CREATE OR REPLACE FUNCTION search_tickets_fast(
  p_page INTEGER DEFAULT 1,
  p_limit INTEGER DEFAULT 20,
  p_sort TEXT DEFAULT 'created_at',
  p_order TEXT DEFAULT 'desc',
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL,
  p_date_type TEXT DEFAULT 'appointed',
  p_site_id UUID DEFAULT NULL,
  p_status_id UUID DEFAULT NULL,
  p_work_type_id UUID DEFAULT NULL,
  p_assigner_id UUID DEFAULT NULL,
  p_contact_id UUID DEFAULT NULL,
  p_details TEXT DEFAULT NULL,
  p_exclude_backlog BOOLEAN DEFAULT FALSE,
  p_only_backlog BOOLEAN DEFAULT FALSE,
  p_employee_id UUID DEFAULT NULL,
  p_department_id UUID DEFAULT NULL,
  p_appointment_is_approved BOOLEAN DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  ticket_code TEXT,
  ticket_number INTEGER,
  details TEXT,
  details_summary TEXT,
  additional TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  site_id UUID,
  site_name TEXT,
  company_name TEXT,
  province_code INTEGER,
  district_code INTEGER,
  work_type_code TEXT,
  work_type_name TEXT,
  status_code TEXT,
  status_name TEXT,
  assigner_name TEXT,
  creator_name TEXT,
  appointment_id UUID,
  appointment_date DATE,
  appointment_time_start TIME,
  appointment_time_end TIME,
  appointment_type TEXT,
  appointment_is_approved BOOLEAN,
  work_giver_code TEXT,
  work_giver_name TEXT,
  employee_count BIGINT,
  cf_employee_count BIGINT,
  total_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_offset INTEGER;
  v_total BIGINT;
BEGIN
  v_offset := (p_page - 1) * p_limit;

  -- Get total count first
  SELECT COUNT(DISTINCT t.id) INTO v_total
  FROM main_tickets t
  LEFT JOIN main_appointments a ON t.appointment_id = a.id
  LEFT JOIN main_sites s ON t.site_id = s.id
  LEFT JOIN main_companies c ON s.company_id = c.id
  LEFT JOIN jct_ticket_employees_cf jtec ON t.id = jtec.ticket_id
  LEFT JOIN main_employees e ON jtec.employee_id = e.id
  LEFT JOIN main_org_roles r ON e.role_id = r.id
  WHERE
    (p_start_date IS NULL OR p_end_date IS NULL OR
      CASE p_date_type
        WHEN 'appointed' THEN a.appointment_date BETWEEN p_start_date AND p_end_date
        WHEN 'created' THEN t.created_at::date BETWEEN p_start_date AND p_end_date
        WHEN 'updated' THEN t.updated_at::date BETWEEN p_start_date AND p_end_date
        ELSE TRUE
      END
    )
    AND (p_site_id IS NULL OR t.site_id = p_site_id)
    AND (p_status_id IS NULL OR t.status_id = p_status_id)
    AND (p_work_type_id IS NULL OR t.work_type_id = p_work_type_id)
    AND (p_assigner_id IS NULL OR t.assigner_id = p_assigner_id)
    AND (p_contact_id IS NULL OR t.contact_id = p_contact_id)
    AND (p_details IS NULL OR (
      t.ticket_code ILIKE '%' || p_details || '%'
      OR t.id::text ILIKE '%' || p_details || '%'
      OR t.details ILIKE '%' || p_details || '%'
      OR s.name ILIKE '%' || p_details || '%'
      OR c.name_th ILIKE '%' || p_details || '%'
      OR c.name_en ILIKE '%' || p_details || '%'
    ))
    AND (NOT p_exclude_backlog OR t.appointment_id IS NOT NULL)
    AND (NOT p_only_backlog OR t.appointment_id IS NULL)
    AND (p_employee_id IS NULL OR jtec.employee_id = p_employee_id)
    AND (p_department_id IS NULL OR r.department_id = p_department_id)
    AND (p_appointment_is_approved IS NULL OR a.is_approved = p_appointment_is_approved);

  -- Return full data with proper type casting
  RETURN QUERY
  WITH filtered AS (
    SELECT DISTINCT ON (t.id)
      t.id as tid,
      t.created_at as t_created,
      t.updated_at as t_updated,
      a.appointment_date as a_date
    FROM main_tickets t
    LEFT JOIN main_appointments a ON t.appointment_id = a.id
    LEFT JOIN main_sites s ON t.site_id = s.id
    LEFT JOIN main_companies c ON s.company_id = c.id
    LEFT JOIN jct_ticket_employees_cf jtec ON t.id = jtec.ticket_id
    LEFT JOIN main_employees e ON jtec.employee_id = e.id
    LEFT JOIN main_org_roles r ON e.role_id = r.id
    WHERE
      (p_start_date IS NULL OR p_end_date IS NULL OR
        CASE p_date_type
          WHEN 'appointed' THEN a.appointment_date BETWEEN p_start_date AND p_end_date
          WHEN 'created' THEN t.created_at::date BETWEEN p_start_date AND p_end_date
          WHEN 'updated' THEN t.updated_at::date BETWEEN p_start_date AND p_end_date
          ELSE TRUE
        END
      )
      AND (p_site_id IS NULL OR t.site_id = p_site_id)
      AND (p_status_id IS NULL OR t.status_id = p_status_id)
      AND (p_work_type_id IS NULL OR t.work_type_id = p_work_type_id)
      AND (p_assigner_id IS NULL OR t.assigner_id = p_assigner_id)
      AND (p_contact_id IS NULL OR t.contact_id = p_contact_id)
      AND (p_details IS NULL OR (
        t.ticket_code ILIKE '%' || p_details || '%'
        OR t.id::text ILIKE '%' || p_details || '%'
        OR t.details ILIKE '%' || p_details || '%'
        OR s.name ILIKE '%' || p_details || '%'
        OR c.name_th ILIKE '%' || p_details || '%'
        OR c.name_en ILIKE '%' || p_details || '%'
      ))
      AND (NOT p_exclude_backlog OR t.appointment_id IS NOT NULL)
      AND (NOT p_only_backlog OR t.appointment_id IS NULL)
      AND (p_employee_id IS NULL OR jtec.employee_id = p_employee_id)
      AND (p_department_id IS NULL OR r.department_id = p_department_id)
      AND (p_appointment_is_approved IS NULL OR a.is_approved = p_appointment_is_approved)
    ORDER BY t.id,
      CASE WHEN p_order = 'desc' AND p_sort = 'created_at' THEN t.created_at END DESC NULLS LAST,
      CASE WHEN p_order = 'asc' AND p_sort = 'created_at' THEN t.created_at END ASC NULLS LAST
  ),
  sorted AS (
    SELECT tid
    FROM filtered
    ORDER BY
      CASE WHEN p_order = 'desc' AND p_sort = 'created_at' THEN t_created END DESC NULLS LAST,
      CASE WHEN p_order = 'asc' AND p_sort = 'created_at' THEN t_created END ASC NULLS LAST,
      CASE WHEN p_order = 'desc' AND p_sort = 'updated_at' THEN t_updated END DESC NULLS LAST,
      CASE WHEN p_order = 'asc' AND p_sort = 'updated_at' THEN t_updated END ASC NULLS LAST,
      CASE WHEN p_order = 'desc' AND p_sort = 'appointment_date' THEN a_date END DESC NULLS LAST,
      CASE WHEN p_order = 'asc' AND p_sort = 'appointment_date' THEN a_date END ASC NULLS LAST,
      t_created DESC NULLS LAST
    LIMIT p_limit OFFSET v_offset
  )
  SELECT
    t.id,
    t.ticket_code::TEXT,
    t.ticket_number,
    t.details,
    t.details_summary,
    t.additional,
    t.created_at,
    t.updated_at,
    t.site_id,
    s.name::TEXT as site_name,
    COALESCE(c.name_th, c.name_en)::TEXT as company_name,
    s.province_code,
    s.district_code,
    wt.code::TEXT as work_type_code,
    wt.name::TEXT as work_type_name,
    st.code::TEXT as status_code,
    st.name::TEXT as status_name,
    ea.name::TEXT as assigner_name,
    ec.name::TEXT as creator_name,
    a.id as appointment_id,
    a.appointment_date,
    a.appointment_time_start,
    a.appointment_time_end,
    a.appointment_type::TEXT,
    a.is_approved as appointment_is_approved,
    wg.code::TEXT as work_giver_code,
    wg.name::TEXT as work_giver_name,
    (SELECT COUNT(*) FROM jct_ticket_employees WHERE ticket_id = t.id) as employee_count,
    (SELECT COUNT(*) FROM jct_ticket_employees_cf WHERE ticket_id = t.id) as cf_employee_count,
    v_total as total_count
  FROM sorted
  JOIN main_tickets t ON t.id = sorted.tid
  LEFT JOIN main_sites s ON t.site_id = s.id
  LEFT JOIN main_companies c ON s.company_id = c.id
  LEFT JOIN ref_ticket_work_types wt ON t.work_type_id = wt.id
  LEFT JOIN ref_ticket_statuses st ON t.status_id = st.id
  LEFT JOIN main_employees ea ON t.assigner_id = ea.id
  LEFT JOIN main_employees ec ON t.created_by = ec.id
  LEFT JOIN main_appointments a ON t.appointment_id = a.id
  LEFT JOIN child_ticket_work_givers twg ON t.id = twg.ticket_id
  LEFT JOIN ref_work_givers wg ON twg.work_giver_id = wg.id;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION search_tickets_fast TO authenticated;
GRANT EXECUTE ON FUNCTION search_tickets_fast TO service_role;

COMMENT ON FUNCTION search_tickets_fast IS 'Optimized ticket search - returns full data in single query with proper type casting';
