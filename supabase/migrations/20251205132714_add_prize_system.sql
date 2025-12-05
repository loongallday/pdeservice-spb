-- Migration: Add prize system for New Year lottery
-- Created: 2025-11-26
-- Description: Creates tables for prize management and user-prize associations for New Year gift lottery system

-- Create prizes table
CREATE TABLE IF NOT EXISTS public.prizes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create user_prizes junction table
CREATE TABLE IF NOT EXISTS public.user_prizes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  prize_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add foreign key constraints
ALTER TABLE public.user_prizes
  ADD CONSTRAINT user_prizes_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES public.employees(id) ON DELETE CASCADE;

ALTER TABLE public.user_prizes
  ADD CONSTRAINT user_prizes_prize_id_fkey 
  FOREIGN KEY (prize_id) REFERENCES public.prizes(id) ON DELETE CASCADE;

-- Add unique constraint to prevent duplicate user-prize associations
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_prizes_unique 
  ON public.user_prizes(user_id, prize_id);

-- Enable RLS
ALTER TABLE public.prizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_prizes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for prizes table
CREATE POLICY prizes_select_all ON public.prizes
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY prizes_insert_admin ON public.prizes
  FOR INSERT TO authenticated
  WITH CHECK (user_has_min_level(2));

CREATE POLICY prizes_update_admin ON public.prizes
  FOR UPDATE TO authenticated
  USING (user_has_min_level(2))
  WITH CHECK (user_has_min_level(2));

CREATE POLICY prizes_delete_admin ON public.prizes
  FOR DELETE TO authenticated
  USING (user_has_min_level(2));

-- RLS Policies for user_prizes table
CREATE POLICY user_prizes_select_all ON public.user_prizes
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY user_prizes_insert_admin ON public.user_prizes
  FOR INSERT TO authenticated
  WITH CHECK (user_has_min_level(2));

CREATE POLICY user_prizes_update_admin ON public.user_prizes
  FOR UPDATE TO authenticated
  USING (user_has_min_level(2))
  WITH CHECK (user_has_min_level(2));

CREATE POLICY user_prizes_delete_admin ON public.user_prizes
  FOR DELETE TO authenticated
  USING (user_has_min_level(2));

-- Add comments
COMMENT ON TABLE public.prizes IS 'Stores prizes available for the New Year gift lottery system';
COMMENT ON COLUMN public.prizes.id IS 'Unique identifier for the prize';
COMMENT ON COLUMN public.prizes.name IS 'Name of the prize';
COMMENT ON COLUMN public.prizes.image_url IS 'Optional URL to the prize image';
COMMENT ON COLUMN public.prizes.created_at IS 'Timestamp when the prize was created';

COMMENT ON TABLE public.user_prizes IS 'Junction table linking employees to prizes they have won';
COMMENT ON COLUMN public.user_prizes.id IS 'Unique identifier for the user-prize association';
COMMENT ON COLUMN public.user_prizes.user_id IS 'Reference to the employee who won the prize';
COMMENT ON COLUMN public.user_prizes.prize_id IS 'Reference to the prize that was won';
COMMENT ON COLUMN public.user_prizes.created_at IS 'Timestamp when the prize was assigned';
COMMENT ON COLUMN public.user_prizes.updated_at IS 'Timestamp when the assignment was last updated';

