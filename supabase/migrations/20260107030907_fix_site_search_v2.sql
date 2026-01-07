-- Fix site search with ticket count function v2
-- Use simpler approach with explicit returns

DROP FUNCTION IF EXISTS search_sites_with_ticket_count(text, uuid, integer, integer, integer, integer);

-- Create a simpler version using SQL language
CREATE OR REPLACE FUNCTION search_sites_with_ticket_count(
  p_query text DEFAULT NULL,
  p_company_id uuid DEFAULT NULL,
  p_min_ticket_count integer DEFAULT NULL,
  p_max_ticket_count integer DEFAULT NULL,
  p_page integer DEFAULT 1,
  p_limit integer DEFAULT 20
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_offset integer;
  v_total bigint;
  v_safe_query text;
  v_result json;
BEGIN
  v_offset := (p_page - 1) * p_limit;
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

  -- Get results as JSON
  SELECT json_build_object(
    'total', v_total,
    'data', COALESCE(json_agg(row_to_json(t)), '[]'::json)
  ) INTO v_result
  FROM (
    SELECT
      s.id,
      s.name,
      s.address_detail,
      s.company_id,
      s.is_main_branch,
      c.name_th AS company_name_th,
      c.name_en AS company_name_en,
      COUNT(t.id)::integer AS ticket_count
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
    OFFSET v_offset
  ) t;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION search_sites_with_ticket_count IS 'Search sites with ticket count filtering. Returns JSON with total and data array.';

GRANT EXECUTE ON FUNCTION search_sites_with_ticket_count TO authenticated;
GRANT EXECUTE ON FUNCTION search_sites_with_ticket_count TO service_role;
