-- Create main_todos table for reminder/task management
-- Employees can create todos with deadlines and assign to themselves or others

-- Add todo_reminder to notification_type enum
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'todo_reminder';

-- Create priority enum
CREATE TYPE todo_priority AS ENUM ('low', 'normal', 'high', 'urgent');

-- Create main_todos table
CREATE TABLE IF NOT EXISTS public.main_todos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  deadline TIMESTAMPTZ NOT NULL,

  -- Relations
  ticket_id UUID,
  creator_id UUID NOT NULL,
  assignee_id UUID NOT NULL,

  -- Status
  is_completed BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  notified_at TIMESTAMPTZ, -- Track if deadline notification was sent

  -- Priority
  priority todo_priority NOT NULL DEFAULT 'normal',

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Foreign keys
  CONSTRAINT fk_todo_ticket
    FOREIGN KEY (ticket_id)
    REFERENCES public.main_tickets(id)
    ON DELETE SET NULL,

  CONSTRAINT fk_todo_creator
    FOREIGN KEY (creator_id)
    REFERENCES public.main_employees(id)
    ON DELETE RESTRICT,

  CONSTRAINT fk_todo_assignee
    FOREIGN KEY (assignee_id)
    REFERENCES public.main_employees(id)
    ON DELETE RESTRICT
);

-- Indexes
CREATE INDEX idx_main_todos_assignee_id ON public.main_todos(assignee_id);
CREATE INDEX idx_main_todos_creator_id ON public.main_todos(creator_id);
CREATE INDEX idx_main_todos_ticket_id ON public.main_todos(ticket_id) WHERE ticket_id IS NOT NULL;
CREATE INDEX idx_main_todos_deadline ON public.main_todos(deadline);
CREATE INDEX idx_main_todos_is_completed ON public.main_todos(is_completed);
CREATE INDEX idx_main_todos_pending_notification ON public.main_todos(deadline)
  WHERE notified_at IS NULL AND is_completed = FALSE;

-- Comments
COMMENT ON TABLE public.main_todos IS 'Todo/reminder tasks with deadlines, assignable to employees';
COMMENT ON COLUMN public.main_todos.notified_at IS 'Timestamp when deadline notification was sent (NULL = not yet notified)';
COMMENT ON COLUMN public.main_todos.priority IS 'Task priority: low, normal, high, urgent';

-- Enable RLS
ALTER TABLE public.main_todos ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view todos they created or are assigned to
CREATE POLICY "Users can view own todos"
  ON public.main_todos
  FOR SELECT
  USING (
    creator_id IN (SELECT id FROM public.main_employees WHERE auth_user_id = auth.uid())
    OR assignee_id IN (SELECT id FROM public.main_employees WHERE auth_user_id = auth.uid())
    OR public.get_employee_level() >= 2
  );

-- Users can create todos (Level 1+)
CREATE POLICY "Level 1+ can create todos"
  ON public.main_todos
  FOR INSERT
  WITH CHECK (public.get_employee_level() >= 1);

-- Users can update todos they created
CREATE POLICY "Users can update own todos"
  ON public.main_todos
  FOR UPDATE
  USING (
    creator_id IN (SELECT id FROM public.main_employees WHERE auth_user_id = auth.uid())
    OR public.get_employee_level() >= 2
  );

-- Users can delete todos they created
CREATE POLICY "Users can delete own todos"
  ON public.main_todos
  FOR DELETE
  USING (
    creator_id IN (SELECT id FROM public.main_employees WHERE auth_user_id = auth.uid())
    OR public.get_employee_level() >= 2
  );

-- Service role full access
CREATE POLICY "Service role full access to todos"
  ON public.main_todos
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.main_todos TO authenticated;
GRANT ALL ON public.main_todos TO service_role;

-- ============================================
-- pg_cron job for deadline notifications
-- ============================================

-- Function to check and notify for due todos
CREATE OR REPLACE FUNCTION public.check_todo_deadlines()
RETURNS void AS $$
DECLARE
  todo_record RECORD;
BEGIN
  -- Find todos that are due and haven't been notified
  FOR todo_record IN
    SELECT
      t.id,
      t.title,
      t.description,
      t.deadline,
      t.ticket_id,
      t.creator_id,
      t.assignee_id,
      t.priority,
      e.name as creator_name
    FROM public.main_todos t
    JOIN public.main_employees e ON t.creator_id = e.id
    WHERE t.deadline <= NOW()
      AND t.notified_at IS NULL
      AND t.is_completed = FALSE
  LOOP
    -- Insert notification for assignee
    INSERT INTO public.main_notifications (
      recipient_id,
      type,
      title,
      message,
      ticket_id,
      actor_id,
      metadata
    ) VALUES (
      todo_record.assignee_id,
      'todo_reminder',
      'ถึงกำหนดงาน: ' || todo_record.title,
      CASE
        WHEN todo_record.creator_id = todo_record.assignee_id THEN 'งานที่คุณสร้างถึงกำหนดแล้ว'
        ELSE 'งานจาก ' || todo_record.creator_name || ' ถึงกำหนดแล้ว'
      END,
      todo_record.ticket_id,
      todo_record.creator_id,
      jsonb_build_object(
        'todo_id', todo_record.id,
        'priority', todo_record.priority::text,
        'deadline', todo_record.deadline
      )
    );

    -- Mark todo as notified
    UPDATE public.main_todos
    SET notified_at = NOW()
    WHERE id = todo_record.id;

    RAISE NOTICE 'Sent notification for todo: %', todo_record.id;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.check_todo_deadlines IS 'Checks for due todos and creates notifications for assignees';

-- Grant execute to service_role
GRANT EXECUTE ON FUNCTION public.check_todo_deadlines TO service_role;

-- Schedule the cron job to run every 5 minutes
SELECT cron.schedule(
  'check-todo-deadlines',
  '*/5 * * * *',
  'SELECT public.check_todo_deadlines()'
);
