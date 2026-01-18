-- Migration: Add site validation constraint for ticket_merchandise
-- Created: 2025-11-18
-- Description: Ensures merchandise linked to tickets must be in the same site

-- Create function to validate site match
CREATE OR REPLACE FUNCTION validate_ticket_merchandise_site()
RETURNS TRIGGER AS $$
DECLARE
  ticket_site_id UUID;
  merchandise_site_id UUID;
BEGIN
  -- Get ticket's site_id
  SELECT site_id INTO ticket_site_id
  FROM public.tickets
  WHERE id = NEW.ticket_id;

  -- Get merchandise's site_id
  SELECT site_id INTO merchandise_site_id
  FROM public.merchandise
  WHERE id = NEW.merchandise_id;

  -- If ticket has no site, allow (optional site)
  IF ticket_site_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- If merchandise has no site, reject
  IF merchandise_site_id IS NULL THEN
    RAISE EXCEPTION 'Merchandise must have a site_id';
  END IF;

  -- Check if sites match
  IF ticket_site_id != merchandise_site_id THEN
    RAISE EXCEPTION 'Merchandise must be in the same site as the ticket. Ticket site: %, Merchandise site: %', 
      ticket_site_id, merchandise_site_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to validate before insert or update
CREATE TRIGGER trigger_validate_ticket_merchandise_site
  BEFORE INSERT OR UPDATE ON public.ticket_merchandise
  FOR EACH ROW
  EXECUTE FUNCTION validate_ticket_merchandise_site();

-- Add comment
COMMENT ON FUNCTION validate_ticket_merchandise_site() IS 'Validates that merchandise linked to a ticket must be in the same site as the ticket';



