-- Create ticket audit table
-- This table tracks all changes to tickets including creation, updates, and deletion

CREATE TABLE IF NOT EXISTS public.ticket_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL,
  action VARCHAR NOT NULL CHECK (action IN ('created', 'updated', 'deleted')),
  changed_by UUID NOT NULL REFERENCES employees(id),
  
  -- Store old and new values as JSONB for flexibility
  old_values JSONB,
  new_values JSONB,
  
  -- Track which fields were changed (for updates)
  changed_fields TEXT[],
  
  -- Additional metadata
  metadata JSONB,
  
  -- Timestamp
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add comments
COMMENT ON TABLE public.ticket_audit IS 'Audit trail for all ticket operations (create, update, delete)';
COMMENT ON COLUMN public.ticket_audit.ticket_id IS 'ID of the ticket being audited (may be NULL for deleted tickets if we want to keep reference)';
COMMENT ON COLUMN public.ticket_audit.action IS 'Action performed: created, updated, or deleted';
COMMENT ON COLUMN public.ticket_audit.changed_by IS 'Employee ID who performed the action';
COMMENT ON COLUMN public.ticket_audit.old_values IS 'Previous values of changed fields (JSONB object)';
COMMENT ON COLUMN public.ticket_audit.new_values IS 'New values of changed fields (JSONB object)';
COMMENT ON COLUMN public.ticket_audit.changed_fields IS 'Array of field names that were changed (for updates)';
COMMENT ON COLUMN public.ticket_audit.metadata IS 'Additional metadata about the change (e.g., related entity changes, IP address, user agent)';

-- Create indexes for better query performance
CREATE INDEX idx_ticket_audit_ticket_id ON public.ticket_audit(ticket_id);
CREATE INDEX idx_ticket_audit_changed_by ON public.ticket_audit(changed_by);
CREATE INDEX idx_ticket_audit_action ON public.ticket_audit(action);
CREATE INDEX idx_ticket_audit_created_at ON public.ticket_audit(created_at DESC);

-- Composite index for common queries (ticket history)
CREATE INDEX idx_ticket_audit_ticket_created ON public.ticket_audit(ticket_id, created_at DESC);

-- Add foreign key constraint (with ON DELETE SET NULL to preserve audit trail even if ticket is deleted)
-- Note: We use ON DELETE SET NULL instead of CASCADE to preserve audit records
ALTER TABLE public.ticket_audit
  ADD CONSTRAINT ticket_audit_ticket_id_fkey 
  FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE SET NULL;

-- Enable RLS (Row Level Security)
ALTER TABLE public.ticket_audit ENABLE ROW LEVEL SECURITY;

-- Create RLS policy: Only authenticated users can read audit logs
-- Level 0+ can read their own changes, Level 2+ can read all
CREATE POLICY "Users can read ticket audit logs"
  ON public.ticket_audit
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND (
      -- Level 2+ can read all audit logs
      EXISTS (
        SELECT 1 FROM employees e
        LEFT JOIN roles r ON e.role_id = r.id
        WHERE e.auth_user_id = auth.uid()
        AND COALESCE(r.level, 0) >= 2
      )
      OR
      -- Level 0+ can read audit logs where they made the change
      EXISTS (
        SELECT 1 FROM employees
        WHERE employees.auth_user_id = auth.uid()
        AND employees.id = ticket_audit.changed_by
      )
    )
  );

-- Only service role can insert audit logs (via backend API)
-- Note: Service role bypasses RLS, so this policy is for additional safety
-- Regular authenticated users should not be able to insert audit logs
CREATE POLICY "Service role can insert ticket audit logs"
  ON public.ticket_audit
  FOR INSERT
  WITH CHECK (false); -- Only service role (which bypasses RLS) can insert

-- No updates or deletes allowed on audit logs (immutable)
CREATE POLICY "No updates to ticket audit logs"
  ON public.ticket_audit
  FOR UPDATE
  USING (false);

CREATE POLICY "No deletes to ticket audit logs"
  ON public.ticket_audit
  FOR DELETE
  USING (false);

