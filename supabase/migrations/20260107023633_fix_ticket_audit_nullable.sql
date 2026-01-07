-- Fix: Make ticket_id nullable in child_ticket_audit
-- This allows ON DELETE SET NULL to work properly when tickets are deleted
-- Audit records are preserved with ticket_id = NULL for historical reference

-- Make ticket_id nullable
ALTER TABLE child_ticket_audit
ALTER COLUMN ticket_id DROP NOT NULL;

-- Update comment to reflect the change
COMMENT ON COLUMN child_ticket_audit.ticket_id IS 'ID of the ticket being audited (NULL if ticket was deleted - audit preserved for history)';
