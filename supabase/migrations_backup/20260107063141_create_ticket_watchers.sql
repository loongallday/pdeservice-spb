-- Migration: Create ticket watchers junction table
-- Description: Tracks employees who are watching a ticket for notifications

-- Create source type for how watcher was added
CREATE TYPE watcher_source AS ENUM ('manual', 'auto_creator', 'auto_assigner');

-- Create junction table for ticket watchers
CREATE TABLE IF NOT EXISTS public.jct_ticket_watchers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES main_tickets(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES main_employees(id) ON DELETE CASCADE,
  added_by UUID REFERENCES main_employees(id) ON DELETE SET NULL,
  source watcher_source NOT NULL DEFAULT 'manual',
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique constraint: one watch per ticket/employee
CREATE UNIQUE INDEX idx_jct_ticket_watchers_unique
  ON jct_ticket_watchers(ticket_id, employee_id);

-- Performance indexes
CREATE INDEX idx_jct_ticket_watchers_ticket_id ON jct_ticket_watchers(ticket_id);
CREATE INDEX idx_jct_ticket_watchers_employee_id ON jct_ticket_watchers(employee_id);

-- Comments
COMMENT ON TABLE jct_ticket_watchers IS 'Junction: Tickets <-> Employee watchers for notifications';
COMMENT ON COLUMN jct_ticket_watchers.source IS 'How the watch was added: manual, auto_creator, auto_assigner';
COMMENT ON COLUMN jct_ticket_watchers.added_by IS 'Employee who added this watcher (null if system/self)';

-- Enable RLS
ALTER TABLE jct_ticket_watchers ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Anyone authenticated can read watchers
CREATE POLICY "jct_ticket_watchers_read" ON jct_ticket_watchers
  FOR SELECT
  TO authenticated
  USING (true);

-- Anyone authenticated can add watchers (including themselves)
CREATE POLICY "jct_ticket_watchers_insert" ON jct_ticket_watchers
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Anyone authenticated can remove watchers (including themselves)
CREATE POLICY "jct_ticket_watchers_delete" ON jct_ticket_watchers
  FOR DELETE
  TO authenticated
  USING (true);

-- Service role can do anything
CREATE POLICY "jct_ticket_watchers_service" ON jct_ticket_watchers
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Add ticket_update to notification_type enum
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'ticket_update';

-- Add deduplication index on main_notifications
CREATE INDEX IF NOT EXISTS idx_main_notifications_dedup
  ON main_notifications(recipient_id, ticket_id, type, created_at DESC);
