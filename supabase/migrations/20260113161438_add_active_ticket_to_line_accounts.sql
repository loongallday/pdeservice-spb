-- Add active_ticket_id to track technician submit work context
ALTER TABLE child_employee_line_accounts
ADD COLUMN IF NOT EXISTS active_ticket_id uuid REFERENCES main_tickets(id) ON DELETE SET NULL;

COMMENT ON COLUMN child_employee_line_accounts.active_ticket_id IS 'Active ticket for technician submit work flow - files uploaded auto-link to this ticket';
