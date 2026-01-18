-- Migration: Create main_notifications table
-- Main table for in-app notifications to employees

-- Create notification type enum
CREATE TYPE public.notification_type AS ENUM (
  'approval',              -- Appointment approved
  'unapproval',            -- Appointment un-approved
  'technician_confirmed',  -- Technician confirmed for ticket
  'new_comment',           -- New comment on ticket
  'mention'                -- @mentioned in a comment
);

CREATE TABLE IF NOT EXISTS public.main_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID NOT NULL,
  type public.notification_type NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,

  -- Related entities (nullable - depends on notification type)
  ticket_id UUID,
  comment_id UUID,
  audit_id UUID,

  -- Actor who triggered the notification
  actor_id UUID,

  -- Status
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  read_at TIMESTAMPTZ,

  -- Metadata for additional context
  metadata JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Foreign key constraints
  CONSTRAINT main_notifications_recipient_id_fkey
    FOREIGN KEY (recipient_id) REFERENCES public.main_employees(id) ON DELETE CASCADE,
  CONSTRAINT main_notifications_ticket_id_fkey
    FOREIGN KEY (ticket_id) REFERENCES public.main_tickets(id) ON DELETE SET NULL,
  CONSTRAINT main_notifications_comment_id_fkey
    FOREIGN KEY (comment_id) REFERENCES public.child_ticket_comments(id) ON DELETE SET NULL,
  CONSTRAINT main_notifications_actor_id_fkey
    FOREIGN KEY (actor_id) REFERENCES public.main_employees(id) ON DELETE SET NULL
);

-- Comments
COMMENT ON TABLE public.main_notifications IS 'Main: In-app notifications for employees';
COMMENT ON COLUMN public.main_notifications.id IS 'Primary key';
COMMENT ON COLUMN public.main_notifications.recipient_id IS 'Employee who should receive this notification';
COMMENT ON COLUMN public.main_notifications.type IS 'Type of notification';
COMMENT ON COLUMN public.main_notifications.title IS 'Notification title (Thai)';
COMMENT ON COLUMN public.main_notifications.message IS 'Notification message body (Thai)';
COMMENT ON COLUMN public.main_notifications.ticket_id IS 'Related ticket (if applicable)';
COMMENT ON COLUMN public.main_notifications.comment_id IS 'Related comment (if applicable)';
COMMENT ON COLUMN public.main_notifications.audit_id IS 'Related audit log entry (if applicable)';
COMMENT ON COLUMN public.main_notifications.actor_id IS 'Employee who triggered the notification';
COMMENT ON COLUMN public.main_notifications.is_read IS 'Whether notification has been read';
COMMENT ON COLUMN public.main_notifications.read_at IS 'When notification was read';
COMMENT ON COLUMN public.main_notifications.metadata IS 'Additional context data';
COMMENT ON COLUMN public.main_notifications.created_at IS 'Created timestamp';

-- Indexes
CREATE INDEX idx_main_notifications_recipient_id ON public.main_notifications(recipient_id);
CREATE INDEX idx_main_notifications_recipient_unread ON public.main_notifications(recipient_id) WHERE is_read = FALSE;
CREATE INDEX idx_main_notifications_created_at ON public.main_notifications(created_at DESC);
CREATE INDEX idx_main_notifications_ticket_id ON public.main_notifications(ticket_id);
CREATE INDEX idx_main_notifications_type ON public.main_notifications(type);

-- Enable Row Level Security
ALTER TABLE public.main_notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can only read their own notifications
CREATE POLICY "Users can read own notifications"
  ON public.main_notifications
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.main_employees e
      WHERE e.auth_user_id = auth.uid()
      AND e.id = main_notifications.recipient_id
    )
  );

-- Users can update only is_read/read_at on their own notifications
CREATE POLICY "Users can mark own notifications as read"
  ON public.main_notifications
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.main_employees e
      WHERE e.auth_user_id = auth.uid()
      AND e.id = main_notifications.recipient_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.main_employees e
      WHERE e.auth_user_id = auth.uid()
      AND e.id = main_notifications.recipient_id
    )
  );

-- Service role can insert notifications
CREATE POLICY "Service role can insert notifications"
  ON public.main_notifications
  FOR INSERT
  WITH CHECK (false);

-- No deletes allowed
CREATE POLICY "No deletes on notifications"
  ON public.main_notifications
  FOR DELETE
  USING (false);

-- Grant permissions
GRANT SELECT, UPDATE ON public.main_notifications TO authenticated;
GRANT ALL ON public.main_notifications TO service_role;
