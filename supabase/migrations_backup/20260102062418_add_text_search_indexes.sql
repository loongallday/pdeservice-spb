-- Migration: Add GIN trigram indexes for faster ILIKE text searches
-- This significantly improves performance of search queries that use ILIKE patterns

-- Ensure pg_trgm extension exists (it was moved to extensions schema earlier)
-- The operators are now in extensions schema

-- Add GIN trigram indexes on employees table for name/email search
CREATE INDEX IF NOT EXISTS idx_employees_name_trgm 
  ON public.employees USING gin (name extensions.gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_employees_email_trgm 
  ON public.employees USING gin (email extensions.gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_employees_nickname_trgm 
  ON public.employees USING gin (nickname extensions.gin_trgm_ops);

-- Add GIN trigram indexes on sites table for name/address search
CREATE INDEX IF NOT EXISTS idx_sites_name_trgm 
  ON public.sites USING gin (name extensions.gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_sites_address_detail_trgm 
  ON public.sites USING gin (address_detail extensions.gin_trgm_ops);

-- Add GIN trigram indexes on tickets table for text search
CREATE INDEX IF NOT EXISTS idx_tickets_details_trgm 
  ON public.tickets USING gin (details extensions.gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_tickets_site_name_trgm 
  ON public.tickets USING gin (site_name extensions.gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_tickets_company_name_trgm 
  ON public.tickets USING gin (company_name extensions.gin_trgm_ops);

-- Add composite index for common employee filters
CREATE INDEX IF NOT EXISTS idx_employees_active_department 
  ON public.employees (is_active, department_id) 
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_employees_active_role 
  ON public.employees (is_active, role_id) 
  WHERE is_active = true;

-- Add composite index for ticket search with appointment date and status
CREATE INDEX IF NOT EXISTS idx_tickets_appt_date_status 
  ON public.tickets (appointment_date, status_id) 
  WHERE appointment_date IS NOT NULL;

