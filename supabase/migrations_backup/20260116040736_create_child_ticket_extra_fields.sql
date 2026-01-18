-- Create child_ticket_extra_fields table for custom key-value pairs on tickets
CREATE TABLE IF NOT EXISTS child_ticket_extra_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES main_tickets(id) ON DELETE CASCADE,
  field_key VARCHAR(100) NOT NULL,
  field_value TEXT,
  created_by UUID REFERENCES main_employees(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Ensure unique key per ticket
  CONSTRAINT unique_ticket_field_key UNIQUE (ticket_id, field_key)
);

-- Add comment
COMMENT ON TABLE child_ticket_extra_fields IS 'Child: Custom key-value extra fields for tickets';

-- Create indexes
CREATE INDEX idx_ticket_extra_fields_ticket_id ON child_ticket_extra_fields(ticket_id);
CREATE INDEX idx_ticket_extra_fields_key ON child_ticket_extra_fields(field_key);

-- Enable RLS
ALTER TABLE child_ticket_extra_fields ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Allow authenticated read" ON child_ticket_extra_fields
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated insert" ON child_ticket_extra_fields
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated update" ON child_ticket_extra_fields
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated delete" ON child_ticket_extra_fields
  FOR DELETE TO authenticated
  USING (true);

-- Service role full access
CREATE POLICY "Service role full access" ON child_ticket_extra_fields
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Grant permissions
GRANT ALL ON child_ticket_extra_fields TO authenticated;
GRANT ALL ON child_ticket_extra_fields TO service_role;
