-- Fix site search with ticket count function
-- Previous version had issues with return type structure

DROP FUNCTION IF EXISTS search_sites_with_ticket_count;

CREATE OR REPLACE FUNCTION search_sites_with_ticket_count(
  p_query text DEFAULT NULL,
  p_company_id uuid DEFAULT NULL,
  p_min_ticket_count integer DEFAULT NULL,
  p_max_ticket_count integer DEFAULT NULL,
  p_page integer DEFAULT 1,
  p_limit integer DEFAULT 20
)
RETURNS TABLE (
  site_id uuid,
  site_name text,
  site_address_detail text,
  site_company_id uuid,
  site_is_main_branch boolean,
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

  -- Get total count
  SELECT COUNT(*) INTO v_total
  FROM (
    SELECT s.id
    FROM main_sites s
    LEFT JOIN main_companies c ON s.company_id = c.id
    LEFT JOIN main_tickets t ON t.site_id = s.id
    WHERE (
      p_query IS NULL
      OR p_query = ''
      OR s.name ILIKE '%' || v_safe_query || '%'
      OR s.address_detail ILIKE '%' || v_safe_query || '%'
      OR c.name_th ILIKE '%' || v_safe_query || '%'
      OR c.name_en ILIKE '%' || v_safe_query || '%'
    )
    AND (p_company_id IS NULL OR s.company_id = p_company_id)
    GROUP BY s.id
    HAVING (
      (p_min_ticket_count IS NULL OR COUNT(t.id) >= p_min_ticket_count)
      AND (p_max_ticket_count IS NULL OR COUNT(t.id) <= p_max_ticket_count)
    )
  ) filtered;

  -- Return results
  RETURN QUERY
  SELECT
    s.id AS site_id,
    s.name AS site_name,
    s.address_detail AS site_address_detail,
    s.company_id AS site_company_id,
    s.is_main_branch AS site_is_main_branch,
    c.name_th AS company_name_th,
    c.name_en AS company_name_en,
    COUNT(t.id)::bigint AS ticket_count,
    v_total AS total_count
  FROM main_sites s
  LEFT JOIN main_companies c ON s.company_id = c.id
  LEFT JOIN main_tickets t ON t.site_id = s.id
  WHERE (
    p_query IS NULL
    OR p_query = ''
    OR s.name ILIKE '%' || v_safe_query || '%'
    OR s.address_detail ILIKE '%' || v_safe_query || '%'
    OR c.name_th ILIKE '%' || v_safe_query || '%'
    OR c.name_en ILIKE '%' || v_safe_query || '%'
  )
  AND (p_company_id IS NULL OR s.company_id = p_company_id)
  GROUP BY s.id, s.name, s.address_detail, s.company_id, s.is_main_branch, c.name_th, c.name_en
  HAVING (
    (p_min_ticket_count IS NULL OR COUNT(t.id) >= p_min_ticket_count)
    AND (p_max_ticket_count IS NULL OR COUNT(t.id) <= p_max_ticket_count)
  )
  ORDER BY s.name
  LIMIT p_limit
  OFFSET v_offset;
END;
$$;

COMMENT ON FUNCTION search_sites_with_ticket_count IS 'Search sites with ticket count filtering. Supports text search, company filter, and min/max ticket count filters.';

GRANT EXECUTE ON FUNCTION search_sites_with_ticket_count TO authenticated;
GRANT EXECUTE ON FUNCTION search_sites_with_ticket_count TO service_role;
