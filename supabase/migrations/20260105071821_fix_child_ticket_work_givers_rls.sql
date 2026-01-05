-- Fix RLS policies on child_ticket_work_givers
-- The previous policies were too restrictive and blocked service role from reading

-- Drop existing policies
DROP POLICY IF EXISTS "Authenticated users can read ticket work givers" ON public.child_ticket_work_givers;
DROP POLICY IF EXISTS "Service role can modify ticket work givers" ON public.child_ticket_work_givers;

-- Create new permissive policy for SELECT (allow all reads - service role bypasses anyway)
-- This ensures authenticated users can read, and service role can also read
CREATE POLICY "Allow read access to ticket work givers"
  ON public.child_ticket_work_givers
  FOR SELECT
  USING (true);

-- Note: INSERT, UPDATE, DELETE are handled by service role which bypasses RLS
-- No need for additional policies as all modifications go through the API

-- Also fix ref_work_givers to ensure it's readable
DROP POLICY IF EXISTS "Authenticated users can read work givers" ON public.ref_work_givers;
DROP POLICY IF EXISTS "Allow public read access to work givers" ON public.ref_work_givers;

CREATE POLICY "Allow read access to work givers"
  ON public.ref_work_givers
  FOR SELECT
  USING (true);
