-- Create child_ticket_work_givers table
-- Links tickets to work givers (1:1 relationship - each ticket can have at most one work giver)

CREATE TABLE IF NOT EXISTS public.child_ticket_work_givers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL,
  work_giver_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Foreign key constraints
  CONSTRAINT child_ticket_work_givers_ticket_id_fkey 
    FOREIGN KEY (ticket_id) REFERENCES public.main_tickets(id) ON DELETE CASCADE,
  CONSTRAINT child_ticket_work_givers_work_giver_id_fkey 
    FOREIGN KEY (work_giver_id) REFERENCES public.ref_work_givers(id) ON DELETE RESTRICT,
  
  -- Unique constraint to enforce 1:1 relationship (one ticket = one work giver)
  CONSTRAINT child_ticket_work_givers_ticket_id_unique UNIQUE (ticket_id)
);

-- Add comments
COMMENT ON TABLE public.child_ticket_work_givers IS 'Child of main_tickets: Work giver assignment for tickets (1:1 relationship)';
COMMENT ON COLUMN public.child_ticket_work_givers.id IS 'Primary key';
COMMENT ON COLUMN public.child_ticket_work_givers.ticket_id IS 'FK → main_tickets (unique - one work giver per ticket)';
COMMENT ON COLUMN public.child_ticket_work_givers.work_giver_id IS 'FK → ref_work_givers';
COMMENT ON COLUMN public.child_ticket_work_givers.created_at IS 'Created timestamp';
COMMENT ON COLUMN public.child_ticket_work_givers.updated_at IS 'Updated timestamp';

-- Add indexes for better query performance
CREATE INDEX idx_child_ticket_work_givers_ticket_id ON public.child_ticket_work_givers(ticket_id);
CREATE INDEX idx_child_ticket_work_givers_work_giver_id ON public.child_ticket_work_givers(work_giver_id);

-- Enable Row Level Security
ALTER TABLE public.child_ticket_work_givers ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Allow authenticated users to read ticket work givers
CREATE POLICY "Authenticated users can read ticket work givers"
  ON public.child_ticket_work_givers
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Only service role can modify (via backend API)
CREATE POLICY "Service role can modify ticket work givers"
  ON public.child_ticket_work_givers
  FOR ALL
  USING (false)
  WITH CHECK (false);

