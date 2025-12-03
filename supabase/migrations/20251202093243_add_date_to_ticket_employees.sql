-- Migration: Add date field to ticket_employees and unique constraint
-- Created: 2024-12-02

-- Add date column to ticket_employees table
ALTER TABLE public.ticket_employees
  ADD COLUMN IF NOT EXISTS date DATE;

-- Update existing records: set date to appointment_date from appointments table via tickets
-- If no appointment exists, use created_at date
UPDATE public.ticket_employees te
SET date = COALESCE(
  (SELECT a.appointment_date 
   FROM public.tickets t
   LEFT JOIN public.appointments a ON t.appointment_id = a.id
   WHERE t.id = te.ticket_id),
  DATE(te.created_at)
)
WHERE te.date IS NULL;

-- Make date NOT NULL after backfilling
ALTER TABLE public.ticket_employees
  ALTER COLUMN date SET NOT NULL;

-- Add unique constraint on (date, employee_id, ticket_id)
-- This ensures an employee can only be assigned once per ticket per date
ALTER TABLE public.ticket_employees
  ADD CONSTRAINT ticket_employees_date_employee_ticket_unique 
  UNIQUE (date, employee_id, ticket_id);

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_ticket_employees_date 
  ON public.ticket_employees(date);

-- Add comment
COMMENT ON COLUMN public.ticket_employees.date IS 'Date of assignment - used with employee_id and ticket_id for unique constraint';

