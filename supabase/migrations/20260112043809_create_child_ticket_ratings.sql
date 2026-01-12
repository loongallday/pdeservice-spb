-- Create child_ticket_ratings table for customer feedback
-- Employees call customers at ticket completion to collect ratings

CREATE TABLE IF NOT EXISTS public.child_ticket_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL UNIQUE,
  rated_by_employee_id UUID NOT NULL,

  -- Rating categories (1-5 scale)
  service_quality_rating SMALLINT NOT NULL CHECK (service_quality_rating >= 1 AND service_quality_rating <= 5),
  response_time_rating SMALLINT NOT NULL CHECK (response_time_rating >= 1 AND response_time_rating <= 5),
  professionalism_rating SMALLINT NOT NULL CHECK (professionalism_rating >= 1 AND professionalism_rating <= 5),

  -- Extra fields
  customer_comment TEXT,
  call_notes TEXT,

  -- Timestamps
  rated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Foreign keys
  CONSTRAINT fk_ticket
    FOREIGN KEY (ticket_id)
    REFERENCES public.main_tickets(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_rated_by_employee
    FOREIGN KEY (rated_by_employee_id)
    REFERENCES public.main_employees(id)
    ON DELETE RESTRICT
);

-- Indexes
CREATE INDEX idx_child_ticket_ratings_ticket_id ON public.child_ticket_ratings(ticket_id);
CREATE INDEX idx_child_ticket_ratings_rated_by ON public.child_ticket_ratings(rated_by_employee_id);
CREATE INDEX idx_child_ticket_ratings_rated_at ON public.child_ticket_ratings(rated_at DESC);

-- Comments
COMMENT ON TABLE public.child_ticket_ratings IS 'Customer ratings collected by employees via phone call at ticket completion';
COMMENT ON COLUMN public.child_ticket_ratings.service_quality_rating IS 'Rating for overall service quality (1-5)';
COMMENT ON COLUMN public.child_ticket_ratings.response_time_rating IS 'Rating for response time (1-5)';
COMMENT ON COLUMN public.child_ticket_ratings.professionalism_rating IS 'Rating for technician professionalism (1-5)';
COMMENT ON COLUMN public.child_ticket_ratings.customer_comment IS 'Optional feedback from customer';
COMMENT ON COLUMN public.child_ticket_ratings.call_notes IS 'Internal notes from employee who made the call';

-- Enable RLS
ALTER TABLE public.child_ticket_ratings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Level 0+ can view ratings
CREATE POLICY "Level 0+ can view ratings"
  ON public.child_ticket_ratings
  FOR SELECT
  USING (public.get_employee_level() >= 0);

-- Level 1+ can create ratings
CREATE POLICY "Level 1+ can create ratings"
  ON public.child_ticket_ratings
  FOR INSERT
  WITH CHECK (public.get_employee_level() >= 1);

-- Level 1+ can update ratings
CREATE POLICY "Level 1+ can update ratings"
  ON public.child_ticket_ratings
  FOR UPDATE
  USING (public.get_employee_level() >= 1);

-- Level 2+ can delete ratings
CREATE POLICY "Level 2+ can delete ratings"
  ON public.child_ticket_ratings
  FOR DELETE
  USING (public.get_employee_level() >= 2);

-- Service role full access
CREATE POLICY "Service role full access to ratings"
  ON public.child_ticket_ratings
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Grants
GRANT SELECT ON public.child_ticket_ratings TO authenticated;
GRANT ALL ON public.child_ticket_ratings TO service_role;
