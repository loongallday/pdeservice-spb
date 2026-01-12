-- Fix functions that reference old table names after phase3 rename
-- Tables renamed: tickets -> main_tickets, merchandise -> main_merchandise, etc.

-- ============================================
-- FIX: validate_ticket_merchandise_site
-- ============================================
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
  SELECT site_id INTO ticket_site_id FROM public.main_tickets WHERE id = NEW.ticket_id;

  -- Get the site_id from the merchandise
  SELECT site_id INTO merchandise_site_id FROM public.main_merchandise WHERE id = NEW.merchandise_id;

  -- Validate that merchandise belongs to the same site as the ticket
  IF ticket_site_id IS NOT NULL AND merchandise_site_id IS NOT NULL AND ticket_site_id != merchandise_site_id THEN
    RAISE EXCEPTION 'Merchandise must belong to the same site as the ticket';
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================
-- FIX: sync_ticket_appointment
-- ============================================
CREATE OR REPLACE FUNCTION sync_ticket_appointment()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  UPDATE public.main_tickets
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

-- ============================================
-- FIX: sync_ticket_site
-- ============================================
CREATE OR REPLACE FUNCTION sync_ticket_site()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.name IS DISTINCT FROM OLD.name THEN
    UPDATE public.main_tickets SET site_name = NEW.name WHERE site_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

-- ============================================
-- FIX: sync_company_name
-- ============================================
CREATE OR REPLACE FUNCTION sync_company_name()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.name_th IS DISTINCT FROM OLD.name_th OR NEW.name_en IS DISTINCT FROM OLD.name_en THEN
    -- Update sites
    UPDATE public.main_sites
    SET company_name_th = NEW.name_th, company_name_en = NEW.name_en
    WHERE company_id = NEW.tax_id;

    -- Update tickets
    UPDATE public.main_tickets t
    SET company_name = COALESCE(NEW.name_th, NEW.name_en)
    FROM public.main_sites s
    WHERE t.site_id = s.id AND s.company_id = NEW.tax_id;
  END IF;
  RETURN NEW;
END;
$$;

-- ============================================
-- FIX: sync_site_company_on_change
-- ============================================
CREATE OR REPLACE FUNCTION sync_site_company_on_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  -- Populate company names from companies table
  IF NEW.company_id IS NOT NULL THEN
    SELECT name_th, name_en INTO NEW.company_name_th, NEW.company_name_en
    FROM public.main_companies WHERE tax_id = NEW.company_id;
  END IF;
  RETURN NEW;
END;
$$;

-- ============================================
-- FIX: sync_employee_department
-- ============================================
CREATE OR REPLACE FUNCTION sync_employee_department()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.role_id IS NOT NULL THEN
    SELECT department_id INTO NEW.department_id FROM public.main_org_roles WHERE id = NEW.role_id;
  END IF;
  RETURN NEW;
END;
$$;

-- ============================================
-- FIX: sync_ticket_denorm_on_change
-- ============================================
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
    FROM public.main_sites s
    LEFT JOIN public.main_companies c ON s.company_id = c.tax_id
    WHERE s.id = NEW.site_id;
  END IF;

  -- Populate appointment fields from appointment
  IF NEW.appointment_id IS NOT NULL AND (NEW.appointment_id IS DISTINCT FROM OLD.appointment_id OR NEW.appointment_date IS NULL) THEN
    SELECT appointment_date, appointment_time_start, appointment_time_end, is_approved, appointment_type
    INTO NEW.appointment_date, NEW.appointment_time_start, NEW.appointment_time_end, NEW.appointment_is_approved, NEW.appointment_type
    FROM public.main_appointments WHERE id = NEW.appointment_id;
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================
-- FIX: user_has_min_level
-- ============================================
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
  FROM public.main_employees e
  JOIN public.main_org_roles r ON e.role_id = r.id
  WHERE e.auth_user_id = auth.uid();

  IF user_level IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN user_level >= min_level;
END;
$$;

-- ============================================
-- FIX: current_user_is_role_level_gt0
-- ============================================
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
  FROM public.main_employees e
  JOIN public.main_org_roles r ON e.role_id = r.id
  WHERE e.auth_user_id = auth.uid();

  IF user_level IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN user_level > 0;
END;
$$;

-- ============================================
-- FIX: cleanup_expired_idempotency_keys
-- ============================================
CREATE OR REPLACE FUNCTION cleanup_expired_idempotency_keys()
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  DELETE FROM public.sys_idempotency_keys WHERE expires_at < NOW();
END;
$$;

-- ============================================
-- FIX: delete_tickets_cascade
-- ============================================
CREATE OR REPLACE FUNCTION delete_tickets_cascade(p_ticket_ids UUID[])
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  -- Delete ticket_employees
  DELETE FROM public.jct_ticket_employees WHERE ticket_id = ANY(p_ticket_ids);

  -- Delete ticket_merchandise
  DELETE FROM public.jct_ticket_merchandise WHERE ticket_id = ANY(p_ticket_ids);

  -- Delete tickets
  DELETE FROM public.main_tickets WHERE id = ANY(p_ticket_ids);
END;
$$;

-- ============================================
-- FIX: merge_ticket_duplicates
-- ============================================
CREATE OR REPLACE FUNCTION merge_ticket_duplicates(p_keep_id UUID, p_remove_ids UUID[])
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  -- Move ticket_employees to kept ticket
  UPDATE public.jct_ticket_employees SET ticket_id = p_keep_id WHERE ticket_id = ANY(p_remove_ids);

  -- Move ticket_merchandise to kept ticket
  UPDATE public.jct_ticket_merchandise SET ticket_id = p_keep_id WHERE ticket_id = ANY(p_remove_ids);

  -- Delete duplicate tickets
  DELETE FROM public.main_tickets WHERE id = ANY(p_remove_ids);
END;
$$;
