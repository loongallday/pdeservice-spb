-- Fix security linter issues:
-- 1. Recreate views with SECURITY INVOKER (instead of SECURITY DEFINER)
-- 2. Set search_path on all functions

-- ============================================
-- FIX 1: Recreate views with SECURITY INVOKER
-- ============================================

-- Drop and recreate tickets_search_view with SECURITY INVOKER
DROP VIEW IF EXISTS tickets_search_view;
CREATE VIEW tickets_search_view 
WITH (security_invoker = true)
AS
SELECT 
  t.id,
  t.details,
  t.status_id,
  t.work_type_id,
  t.assigner_id,
  t.site_id,
  t.contact_id,
  t.created_at,
  t.updated_at,
  t.created_by,
  t.additional,
  t.appointment_id,
  t.appointment_date,
  t.appointment_time_start,
  t.appointment_time_end,
  t.appointment_is_approved,
  t.appointment_type,
  t.site_name,
  t.company_name,
  wt.name AS work_type_name,
  wt.code AS work_type_code,
  ts.name AS status_name,
  ts.code AS status_code,
  assigner.name AS assigner_name,
  assigner.code AS assigner_code,
  creator.name AS creator_name,
  creator.code AS creator_code,
  contact.person_name AS contact_name
FROM tickets t
LEFT JOIN work_types wt ON t.work_type_id = wt.id
LEFT JOIN ticket_statuses ts ON t.status_id = ts.id
LEFT JOIN employees assigner ON t.assigner_id = assigner.id
LEFT JOIN employees creator ON t.created_by = creator.id
LEFT JOIN contacts contact ON t.contact_id = contact.id;

-- Drop and recreate employees_view with SECURITY INVOKER
DROP VIEW IF EXISTS employees_view;
CREATE VIEW employees_view 
WITH (security_invoker = true)
AS
SELECT 
  e.id,
  e.code,
  e.name,
  e.email,
  e.nickname,
  e.is_active,
  e.role_id,
  e.department_id,
  e.auth_user_id,
  e.profile_image_url,
  e.created_at,
  e.updated_at,
  r.code AS role_code,
  r.name_th AS role_name_th,
  r.name_en AS role_name_en,
  d.code AS department_code,
  d.name_th AS department_name_th,
  d.name_en AS department_name_en
FROM employees e
LEFT JOIN roles r ON e.role_id = r.id
LEFT JOIN departments d ON e.department_id = d.id;

-- ============================================
-- FIX 2: Set search_path on trigger functions
-- ============================================

-- Recreate sync_ticket_appointment with search_path
CREATE OR REPLACE FUNCTION sync_ticket_appointment()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  UPDATE public.tickets
  SET 
    appointment_date = NEW.appointment_date,
    appointment_time_start = NEW.appointment_time_start,
    appointment_time_end = NEW.appointment_time_end,
    appointment_is_approved = NEW.is_approved,
    appointment_type = NEW.appointment_type
  WHERE appointment_id = NEW.id;
  RETURN NEW;
END;
$$;

-- Recreate sync_ticket_site with search_path
CREATE OR REPLACE FUNCTION sync_ticket_site()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.name IS DISTINCT FROM OLD.name THEN
    UPDATE public.tickets SET site_name = NEW.name WHERE site_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

-- Recreate sync_company_name with search_path
CREATE OR REPLACE FUNCTION sync_company_name()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.name_th IS DISTINCT FROM OLD.name_th OR NEW.name_en IS DISTINCT FROM OLD.name_en THEN
    -- Update sites
    UPDATE public.sites
    SET company_name_th = NEW.name_th, company_name_en = NEW.name_en
    WHERE company_id = NEW.tax_id;
    
    -- Update tickets
    UPDATE public.tickets t
    SET company_name = COALESCE(NEW.name_th, NEW.name_en)
    FROM public.sites s
    WHERE t.site_id = s.id AND s.company_id = NEW.tax_id;
  END IF;
  RETURN NEW;
END;
$$;

-- Recreate sync_site_company_on_change with search_path
CREATE OR REPLACE FUNCTION sync_site_company_on_change()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  -- Populate company names from companies table
  IF NEW.company_id IS NOT NULL THEN
    SELECT name_th, name_en INTO NEW.company_name_th, NEW.company_name_en
    FROM public.companies WHERE tax_id = NEW.company_id;
  END IF;
  RETURN NEW;
END;
$$;

-- Recreate sync_employee_department with search_path
CREATE OR REPLACE FUNCTION sync_employee_department()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.role_id IS NOT NULL THEN
    SELECT department_id INTO NEW.department_id FROM public.roles WHERE id = NEW.role_id;
  END IF;
  RETURN NEW;
END;
$$;

-- Recreate sync_ticket_denorm_on_change with search_path
CREATE OR REPLACE FUNCTION sync_ticket_denorm_on_change()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  -- Populate site_name and company_name from site
  IF NEW.site_id IS NOT NULL AND (NEW.site_id IS DISTINCT FROM OLD.site_id OR NEW.site_name IS NULL) THEN
    SELECT s.name, COALESCE(c.name_th, c.name_en)
    INTO NEW.site_name, NEW.company_name
    FROM public.sites s
    LEFT JOIN public.companies c ON s.company_id = c.tax_id
    WHERE s.id = NEW.site_id;
  END IF;
  
  -- Populate appointment fields from appointment
  IF NEW.appointment_id IS NOT NULL AND (NEW.appointment_id IS DISTINCT FROM OLD.appointment_id OR NEW.appointment_date IS NULL) THEN
    SELECT appointment_date, appointment_time_start, appointment_time_end, is_approved, appointment_type
    INTO NEW.appointment_date, NEW.appointment_time_start, NEW.appointment_time_end, NEW.appointment_is_approved, NEW.appointment_type
    FROM public.appointments WHERE id = NEW.appointment_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- ============================================
-- FIX 3: Set search_path on other functions
-- ============================================

-- Recreate validate_ticket_merchandise_site with search_path
CREATE OR REPLACE FUNCTION validate_ticket_merchandise_site()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  ticket_site_id UUID;
  merchandise_site_id UUID;
BEGIN
  -- Get the site_id from the ticket
  SELECT site_id INTO ticket_site_id FROM public.tickets WHERE id = NEW.ticket_id;
  
  -- Get the site_id from the merchandise
  SELECT site_id INTO merchandise_site_id FROM public.merchandise WHERE id = NEW.merchandise_id;
  
  -- Validate that merchandise belongs to the same site as the ticket
  IF ticket_site_id IS NOT NULL AND merchandise_site_id IS NOT NULL AND ticket_site_id != merchandise_site_id THEN
    RAISE EXCEPTION 'Merchandise must belong to the same site as the ticket';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Recreate user_has_min_level with search_path
CREATE OR REPLACE FUNCTION user_has_min_level(min_level INTEGER)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  user_level INTEGER;
BEGIN
  SELECT r.level INTO user_level
  FROM public.employees e
  JOIN public.roles r ON e.role_id = r.id
  WHERE e.auth_user_id = auth.uid();
  
  IF user_level IS NULL THEN
    RETURN FALSE;
  END IF;
  
  RETURN user_level >= min_level;
END;
$$;

-- Recreate current_user_is_role_level_gt0 with search_path
CREATE OR REPLACE FUNCTION current_user_is_role_level_gt0()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  user_level INTEGER;
BEGIN
  SELECT r.level INTO user_level
  FROM public.employees e
  JOIN public.roles r ON e.role_id = r.id
  WHERE e.auth_user_id = auth.uid();
  
  IF user_level IS NULL THEN
    RETURN FALSE;
  END IF;
  
  RETURN user_level > 0;
END;
$$;

-- Recreate cleanup_expired_idempotency_keys with search_path
CREATE OR REPLACE FUNCTION cleanup_expired_idempotency_keys()
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  DELETE FROM public.idempotency_keys WHERE expires_at < NOW();
END;
$$;

-- Recreate delete_tickets_cascade with search_path
CREATE OR REPLACE FUNCTION delete_tickets_cascade(p_ticket_ids UUID[])
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  -- Delete ticket_employees
  DELETE FROM public.ticket_employees WHERE ticket_id = ANY(p_ticket_ids);
  
  -- Delete ticket_merchandise
  DELETE FROM public.ticket_merchandise WHERE ticket_id = ANY(p_ticket_ids);
  
  -- Delete tickets
  DELETE FROM public.tickets WHERE id = ANY(p_ticket_ids);
END;
$$;

-- Recreate merge_ticket_duplicates with search_path
CREATE OR REPLACE FUNCTION merge_ticket_duplicates(p_keep_id UUID, p_remove_ids UUID[])
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  -- Move ticket_employees to kept ticket
  UPDATE public.ticket_employees SET ticket_id = p_keep_id WHERE ticket_id = ANY(p_remove_ids);
  
  -- Move ticket_merchandise to kept ticket
  UPDATE public.ticket_merchandise SET ticket_id = p_keep_id WHERE ticket_id = ANY(p_remove_ids);
  
  -- Delete duplicate tickets
  DELETE FROM public.tickets WHERE id = ANY(p_remove_ids);
END;
$$;

-- Recreate create_policy_if_table_exists with search_path
CREATE OR REPLACE FUNCTION create_policy_if_table_exists(
  table_name TEXT,
  policy_name TEXT,
  policy_command TEXT,
  policy_using TEXT DEFAULT NULL,
  policy_with_check TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  sql TEXT;
BEGIN
  -- Check if table exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND information_schema.tables.table_name = create_policy_if_table_exists.table_name) THEN
    RETURN;
  END IF;
  
  -- Drop existing policy if exists
  EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_name, table_name);
  
  -- Build CREATE POLICY statement
  sql := format('CREATE POLICY %I ON public.%I FOR %s', policy_name, table_name, policy_command);
  
  IF policy_using IS NOT NULL THEN
    sql := sql || ' USING (' || policy_using || ')';
  END IF;
  
  IF policy_with_check IS NOT NULL THEN
    sql := sql || ' WITH CHECK (' || policy_with_check || ')';
  END IF;
  
  EXECUTE sql;
END;
$$;

-- Recreate drop_policies_if_table_exists with search_path
CREATE OR REPLACE FUNCTION drop_policies_if_table_exists(table_name TEXT)
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  policy_record RECORD;
BEGIN
  -- Check if table exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND information_schema.tables.table_name = drop_policies_if_table_exists.table_name) THEN
    RETURN;
  END IF;
  
  -- Drop all policies on the table
  FOR policy_record IN
    SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND pg_policies.tablename = drop_policies_if_table_exists.table_name
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_record.policyname, table_name);
  END LOOP;
END;
$$;

