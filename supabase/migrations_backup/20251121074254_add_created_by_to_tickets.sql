-- Add created_by column to tickets table
-- This column stores the employee ID of the user who created the ticket

ALTER TABLE tickets
ADD COLUMN created_by UUID REFERENCES employees(id);

-- Add index for better query performance
CREATE INDEX idx_tickets_created_by ON tickets(created_by);

-- Add comment
COMMENT ON COLUMN tickets.created_by IS 'Employee ID of the user who created the ticket';

