-- Update RLS policies on child_ticket_work_givers
-- Employees with level 1+ can read, insert, update, delete

-- Drop existing policies
DROP POLICY IF EXISTS "Allow read access to ticket work givers" ON public.child_ticket_work_givers;

-- Helper function to check employee level (if not exists)
CREATE OR REPLACE FUNCTION public.get_employee_level()
RETURNS INT AS $$
DECLARE
  emp_level INT;
BEGIN
  SELECT COALESCE(r.level, 0) INTO emp_level
  FROM public.main_employees e
  LEFT JOIN public.main_org_roles r ON e.role_id = r.id
  WHERE e.auth_user_id = auth.uid();
  
  RETURN COALESCE(emp_level, -1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Level 1+ can SELECT
CREATE POLICY "Level 1+ can read ticket work givers"
  ON public.child_ticket_work_givers
  FOR SELECT
  USING (public.get_employee_level() >= 1);

-- Level 1+ can INSERT
CREATE POLICY "Level 1+ can insert ticket work givers"
  ON public.child_ticket_work_givers
  FOR INSERT
  WITH CHECK (public.get_employee_level() >= 1);

-- Level 1+ can UPDATE
CREATE POLICY "Level 1+ can update ticket work givers"
  ON public.child_ticket_work_givers
  FOR UPDATE
  USING (public.get_employee_level() >= 1)
  WITH CHECK (public.get_employee_level() >= 1);

-- Level 1+ can DELETE
CREATE POLICY "Level 1+ can delete ticket work givers"
  ON public.child_ticket_work_givers
  FOR DELETE
  USING (public.get_employee_level() >= 1);

-- Also update ref_work_givers to ensure it's readable by level 0+
DROP POLICY IF EXISTS "Allow read access to work givers" ON public.ref_work_givers;

CREATE POLICY "Level 0+ can read work givers"
  ON public.ref_work_givers
  FOR SELECT
  USING (public.get_employee_level() >= 0);

