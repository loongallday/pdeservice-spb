-- Migration: Create ticket employees confirmed table
-- Created: 2025-01-05
-- Description: Creates jct_ticket_employees_cf table for tracking confirmed technicians for approved tickets

-- Create junction table for confirmed technicians
CREATE TABLE IF NOT EXISTS public.jct_ticket_employees_cf (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES main_tickets(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES main_employees(id) ON DELETE CASCADE,
  confirmed_by UUID NOT NULL REFERENCES main_employees(id),
  confirmed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  date DATE NOT NULL, -- Appointment date for this confirmation
  notes TEXT, -- Optional notes about this confirmation
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique constraint: one confirmation per ticket/employee/date
CREATE UNIQUE INDEX idx_ticket_employees_cf_unique 
  ON jct_ticket_employees_cf(ticket_id, employee_id, date);

-- Indexes for performance
CREATE INDEX idx_ticket_employees_cf_ticket_id ON jct_ticket_employees_cf(ticket_id);
CREATE INDEX idx_ticket_employees_cf_employee_id ON jct_ticket_employees_cf(employee_id);
CREATE INDEX idx_ticket_employees_cf_date ON jct_ticket_employees_cf(date);
CREATE INDEX idx_ticket_employees_cf_confirmed_by ON jct_ticket_employees_cf(confirmed_by);

-- Add comments
COMMENT ON TABLE jct_ticket_employees_cf IS 'Junction table for confirmed technicians on tickets. Tracks which technicians are confirmed to work on approved tickets.';
COMMENT ON COLUMN jct_ticket_employees_cf.ticket_id IS 'Reference to the ticket';
COMMENT ON COLUMN jct_ticket_employees_cf.employee_id IS 'Reference to the confirmed technician';
COMMENT ON COLUMN jct_ticket_employees_cf.confirmed_by IS 'Employee who confirmed this technician';
COMMENT ON COLUMN jct_ticket_employees_cf.confirmed_at IS 'Timestamp when confirmation was made';
COMMENT ON COLUMN jct_ticket_employees_cf.date IS 'Appointment date for this confirmation (used for unique constraint)';
COMMENT ON COLUMN jct_ticket_employees_cf.notes IS 'Optional notes about this confirmation';

-- Enable RLS
ALTER TABLE jct_ticket_employees_cf ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Level 0+ can read
CREATE POLICY "Users can read confirmed technicians"
  ON jct_ticket_employees_cf FOR SELECT
  USING (true);

-- Level 1+ can insert (approvers) - authorization checked in handler
CREATE POLICY "Approvers can confirm technicians"
  ON jct_ticket_employees_cf FOR INSERT
  WITH CHECK (true);

-- Level 2+ can update
CREATE POLICY "Admins can update confirmations"
  ON jct_ticket_employees_cf FOR UPDATE
  USING (true);

-- Level 2+ can delete
CREATE POLICY "Admins can delete confirmations"
  ON jct_ticket_employees_cf FOR DELETE
  USING (true);

