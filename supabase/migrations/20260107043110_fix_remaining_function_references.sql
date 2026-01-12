-- Fix remaining functions that reference old table names

-- ============================================
-- FIX: fn_trg_validate_ticket_merch (the trigger causing the error)
-- ============================================
CREATE OR REPLACE FUNCTION fn_trg_validate_ticket_merch()
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
-- FIX: fn_delete_tickets_cascade
-- ============================================
CREATE OR REPLACE FUNCTION fn_delete_tickets_cascade(p_ticket_ids UUID[])
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
-- FIX: fn_merge_ticket_duplicates_batch
-- ============================================
CREATE OR REPLACE FUNCTION fn_merge_ticket_duplicates_batch(p_keep_id UUID, p_remove_ids UUID[])
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
