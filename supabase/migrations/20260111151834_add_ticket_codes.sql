-- Add Jira-style ticket codes (e.g., PDE-1, PDE-2)
-- This migration adds ticket_number and ticket_code columns to main_tickets

-- Add sequence for ticket numbers
CREATE SEQUENCE IF NOT EXISTS ticket_number_seq START WITH 1;

-- Add columns to main_tickets (initially nullable for backfill)
ALTER TABLE main_tickets
ADD COLUMN ticket_number INTEGER UNIQUE,
ADD COLUMN ticket_code VARCHAR(20) UNIQUE;

-- Create trigger function to auto-generate ticket code on insert
CREATE OR REPLACE FUNCTION generate_ticket_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.ticket_number IS NULL THEN
    NEW.ticket_number := nextval('ticket_number_seq');
  END IF;
  IF NEW.ticket_code IS NULL THEN
    NEW.ticket_code := 'PDE-' || NEW.ticket_number;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_ticket_code() IS 'Auto-generates ticket_number and ticket_code (PDE-N) on insert';

-- Create trigger
CREATE TRIGGER trg_generate_ticket_code
BEFORE INSERT ON main_tickets
FOR EACH ROW
EXECUTE FUNCTION generate_ticket_code();

-- Backfill existing tickets (ordered by created_at to maintain chronological order)
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) as num
  FROM main_tickets
  WHERE ticket_number IS NULL
)
UPDATE main_tickets t
SET ticket_number = n.num,
    ticket_code = 'PDE-' || n.num
FROM numbered n
WHERE t.id = n.id;

-- Update sequence to continue from max ticket_number
SELECT setval('ticket_number_seq', COALESCE((SELECT MAX(ticket_number) FROM main_tickets), 0) + 1, false);

-- Add NOT NULL constraints after backfill
ALTER TABLE main_tickets
ALTER COLUMN ticket_number SET NOT NULL,
ALTER COLUMN ticket_code SET NOT NULL;

-- Create indexes for fast lookups
CREATE INDEX idx_tickets_ticket_code ON main_tickets(ticket_code);
CREATE INDEX idx_tickets_ticket_number ON main_tickets(ticket_number);

-- Grant permissions
GRANT USAGE, SELECT ON SEQUENCE ticket_number_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE ticket_number_seq TO service_role;
