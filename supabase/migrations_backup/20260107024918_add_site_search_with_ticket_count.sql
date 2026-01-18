-- Add site search with ticket count functionality
-- Allows filtering sites by the number of tickets they have

-- Create function to search sites with ticket count
CREATE OR REPLACE FUNCTION search_sites_with_ticket_count(
  p_query text DEFAULT NULL,
  p_company_id uuid DEFAULT NULL,
  p_min_ticket_count integer DEFAULT NULL,
  p_max_ticket_count integer DEFAULT NULL,
  p_page integer DEFAULT 1,
  p_limit integer DEFAULT 20
)
RETURNS TABLE (
  id uuid,
  name text,
  address_detail text,
  company_id uuid,
  is_main_branch boolean,
  company_name_th text,
  company_name_en text,
  ticket_count bigint,
  total_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_offset integer;
  v_total bigint;
  v_safe_query text;
BEGIN
  -- Calculate offset
  v_offset := (p_page - 1) * p_limit;

  -- Sanitize query (replace commas with spaces)
  v_safe_query := COALESCE(REPLACE(p_query, ',', ' '), '');

  -- First, get total count for pagination
  SELECT COUNT(*) INTO v_total
  FROM (
    SELECT s.id
    FROM main_sites s
    LEFT JOIN main_companies c ON s.company_id = c.id
    LEFT JOIN main_tickets t ON t.site_id = s.id
    WHERE (
      -- Text search filter (optional)
      p_query IS NULL
      OR p_query = ''
      OR s.name ILIKE '%' || v_safe_query || '%'
      OR s.address_detail ILIKE '%' || v_safe_query || '%'
      OR c.name_th ILIKE '%' || v_safe_query || '%'
      OR c.name_en ILIKE '%' || v_safe_query || '%'
    )
    AND (
      -- Company filter (optional)
      p_company_id IS NULL
      OR s.company_id = p_company_id
    )
    GROUP BY s.id
    HAVING (
      -- Ticket count filters (optional)
      (p_min_ticket_count IS NULL OR COUNT(t.id) >= p_min_ticket_count)
      AND (p_max_ticket_count IS NULL OR COUNT(t.id) <= p_max_ticket_count)
    )
  ) filtered_sites;

  -- Return results with ticket count
  RETURN QUERY
  WITH site_tickets AS (
    SELECT
      s.id AS site_id,
      s.name AS site_name,
      s.address_detail AS site_address_detail,
      s.company_id AS site_company_id,
      s.is_main_branch AS site_is_main_branch,
      c.name_th AS co_name_th,
      c.name_en AS co_name_en,
      COUNT(t.id) AS t_count
    FROM main_sites s
    LEFT JOIN main_companies c ON s.company_id = c.id
    LEFT JOIN main_tickets t ON t.site_id = s.id
    WHERE (
      -- Text search filter (optional)
      p_query IS NULL
      OR p_query = ''
      OR s.name ILIKE '%' || v_safe_query || '%'
      OR s.address_detail ILIKE '%' || v_safe_query || '%'
      OR c.name_th ILIKE '%' || v_safe_query || '%'
      OR c.name_en ILIKE '%' || v_safe_query || '%'
    )
    AND (
      -- Company filter (optional)
      p_company_id IS NULL
      OR s.company_id = p_company_id
    )
    GROUP BY s.id, s.name, s.address_detail, s.company_id, s.is_main_branch, c.name_th, c.name_en
    HAVING (
      -- Ticket count filters (optional)
      (p_min_ticket_count IS NULL OR COUNT(t.id) >= p_min_ticket_count)
      AND (p_max_ticket_count IS NULL OR COUNT(t.id) <= p_max_ticket_count)
    )
  )
  SELECT
    st.site_id,
    st.site_name,
    st.site_address_detail,
    st.site_company_id,
    st.site_is_main_branch,
    st.co_name_th,
    st.co_name_en,
    st.t_count,
    v_total
  FROM site_tickets st
  ORDER BY st.site_name
  LIMIT p_limit
  OFFSET v_offset;
END;
$$;

-- Add comment
COMMENT ON FUNCTION search_sites_with_ticket_count IS 'Search sites with ticket count filtering. Supports text search, company filter, and min/max ticket count filters.';

-- Grant access
GRANT EXECUTE ON FUNCTION search_sites_with_ticket_count TO authenticated;
GRANT EXECUTE ON FUNCTION search_sites_with_ticket_count TO service_role;
