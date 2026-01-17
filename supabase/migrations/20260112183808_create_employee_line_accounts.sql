-- Migration: Create employee LINE accounts table
-- Child of main_employees: Maps LINE user IDs to employees for n8n integration

-- Create child_employee_line_accounts table
CREATE TABLE IF NOT EXISTS public.child_employee_line_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL UNIQUE REFERENCES main_employees(id) ON DELETE CASCADE,
  line_user_id TEXT NOT NULL UNIQUE,
  display_name TEXT,
  profile_picture_url TEXT,
  linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE UNIQUE INDEX idx_employee_line_accounts_employee
  ON child_employee_line_accounts(employee_id);
CREATE UNIQUE INDEX idx_employee_line_accounts_line_user
  ON child_employee_line_accounts(line_user_id);

-- Comments
COMMENT ON TABLE public.child_employee_line_accounts IS 'Child of main_employees: Maps LINE user IDs to employees for n8n integration';
COMMENT ON COLUMN public.child_employee_line_accounts.id IS 'Primary key';
COMMENT ON COLUMN public.child_employee_line_accounts.employee_id IS 'FK to main_employees (unique - one LINE account per employee)';
COMMENT ON COLUMN public.child_employee_line_accounts.line_user_id IS 'LINE user ID (unique - one employee per LINE account)';
COMMENT ON COLUMN public.child_employee_line_accounts.display_name IS 'LINE display name for reference';
COMMENT ON COLUMN public.child_employee_line_accounts.profile_picture_url IS 'LINE profile picture URL';
COMMENT ON COLUMN public.child_employee_line_accounts.linked_at IS 'When the LINE account was linked';
COMMENT ON COLUMN public.child_employee_line_accounts.created_at IS 'Created timestamp';
COMMENT ON COLUMN public.child_employee_line_accounts.updated_at IS 'Updated timestamp';

-- Enable Row Level Security
ALTER TABLE public.child_employee_line_accounts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Authenticated users can read all LINE account mappings
CREATE POLICY "Authenticated users can read LINE accounts"
  ON public.child_employee_line_accounts
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Service role can do everything (for n8n and admin operations)
CREATE POLICY "Service role can manage LINE accounts"
  ON public.child_employee_line_accounts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Grant permissions
GRANT SELECT ON public.child_employee_line_accounts TO authenticated;
GRANT ALL ON public.child_employee_line_accounts TO service_role;

-- Create updated_at trigger
CREATE TRIGGER set_child_employee_line_accounts_updated_at
  BEFORE UPDATE ON public.child_employee_line_accounts
  FOR EACH ROW
  EXECUTE FUNCTION fn_trg_set_updated_at();
