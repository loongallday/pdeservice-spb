-- Migration: Create child_ticket_comments table
-- Child of main_tickets: Comments on tickets with @mention support

CREATE TABLE IF NOT EXISTS public.child_ticket_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL,
  author_id UUID NOT NULL,
  content TEXT NOT NULL,
  mentioned_employee_ids UUID[] DEFAULT '{}',
  is_edited BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Foreign key constraints
  CONSTRAINT child_ticket_comments_ticket_id_fkey
    FOREIGN KEY (ticket_id) REFERENCES public.main_tickets(id) ON DELETE CASCADE,
  CONSTRAINT child_ticket_comments_author_id_fkey
    FOREIGN KEY (author_id) REFERENCES public.main_employees(id) ON DELETE RESTRICT
);

-- Comments
COMMENT ON TABLE public.child_ticket_comments IS 'Child of main_tickets: Comments on tickets with @mention support';
COMMENT ON COLUMN public.child_ticket_comments.id IS 'Primary key';
COMMENT ON COLUMN public.child_ticket_comments.ticket_id IS 'FK to main_tickets';
COMMENT ON COLUMN public.child_ticket_comments.author_id IS 'FK to main_employees - who wrote the comment';
COMMENT ON COLUMN public.child_ticket_comments.content IS 'Comment text content (may contain @mentions in format @[employee_id])';
COMMENT ON COLUMN public.child_ticket_comments.mentioned_employee_ids IS 'Array of employee IDs mentioned in this comment';
COMMENT ON COLUMN public.child_ticket_comments.is_edited IS 'Whether this comment has been edited';
COMMENT ON COLUMN public.child_ticket_comments.created_at IS 'Created timestamp';
COMMENT ON COLUMN public.child_ticket_comments.updated_at IS 'Updated timestamp';

-- Indexes
CREATE INDEX idx_child_ticket_comments_ticket_id ON public.child_ticket_comments(ticket_id);
CREATE INDEX idx_child_ticket_comments_author_id ON public.child_ticket_comments(author_id);
CREATE INDEX idx_child_ticket_comments_created_at ON public.child_ticket_comments(created_at DESC);
CREATE INDEX idx_child_ticket_comments_mentioned ON public.child_ticket_comments USING GIN (mentioned_employee_ids);

-- Enable Row Level Security
ALTER TABLE public.child_ticket_comments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Authenticated users can read all comments
CREATE POLICY "Authenticated users can read ticket comments"
  ON public.child_ticket_comments
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Service role can insert/update/delete (API handles authorization)
CREATE POLICY "Service role can modify ticket comments"
  ON public.child_ticket_comments
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- Grant permissions
GRANT SELECT ON public.child_ticket_comments TO authenticated;
GRANT ALL ON public.child_ticket_comments TO service_role;
