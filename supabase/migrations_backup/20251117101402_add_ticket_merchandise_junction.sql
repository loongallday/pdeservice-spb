-- Migration: Add ticket_merchandise junction table
-- Created: 2025-11-18
-- Description: Creates junction table to link tickets with merchandise (many-to-many relationship)

-- Create ticket_merchandise junction table
CREATE TABLE IF NOT EXISTS public.ticket_merchandise (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL,
  merchandise_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add foreign key constraints
ALTER TABLE public.ticket_merchandise
  ADD CONSTRAINT ticket_merchandise_ticket_id_fkey 
  FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE CASCADE;

ALTER TABLE public.ticket_merchandise
  ADD CONSTRAINT ticket_merchandise_merchandise_id_fkey 
  FOREIGN KEY (merchandise_id) REFERENCES public.merchandise(id) ON DELETE CASCADE;

-- Add unique constraint to prevent duplicate associations
CREATE UNIQUE INDEX IF NOT EXISTS idx_ticket_merchandise_unique 
  ON public.ticket_merchandise(ticket_id, merchandise_id);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_ticket_merchandise_ticket_id 
  ON public.ticket_merchandise(ticket_id);

CREATE INDEX IF NOT EXISTS idx_ticket_merchandise_merchandise_id 
  ON public.ticket_merchandise(merchandise_id);

-- Enable RLS
ALTER TABLE public.ticket_merchandise ENABLE ROW LEVEL SECURITY;

-- Add comments
COMMENT ON TABLE public.ticket_merchandise IS 'Junction table linking tickets to merchandise (many-to-many relationship)';
COMMENT ON COLUMN public.ticket_merchandise.ticket_id IS 'Reference to the ticket';
COMMENT ON COLUMN public.ticket_merchandise.merchandise_id IS 'Reference to the merchandise';



