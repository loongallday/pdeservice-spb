-- Create child_ticket_work_estimates table
-- Stores estimated work duration for tickets (used in route optimization)

CREATE TABLE child_ticket_work_estimates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES main_tickets(id) ON DELETE CASCADE,
    estimated_minutes INTEGER NOT NULL DEFAULT 60 CHECK (estimated_minutes > 0 AND estimated_minutes <= 480),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES main_employees(id),

    -- Each ticket can only have one work estimate
    CONSTRAINT unique_ticket_work_estimate UNIQUE (ticket_id)
);

-- Index for fast lookup by ticket_id
CREATE INDEX idx_ticket_work_estimates_ticket_id ON child_ticket_work_estimates(ticket_id);

-- Enable RLS
ALTER TABLE child_ticket_work_estimates ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow authenticated users to read work estimates"
    ON child_ticket_work_estimates
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow authenticated users to insert work estimates"
    ON child_ticket_work_estimates
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update work estimates"
    ON child_ticket_work_estimates
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete work estimates"
    ON child_ticket_work_estimates
    FOR DELETE
    TO authenticated
    USING (true);

-- Grant permissions
GRANT ALL ON child_ticket_work_estimates TO authenticated;
GRANT ALL ON child_ticket_work_estimates TO service_role;

-- Add comment
COMMENT ON TABLE child_ticket_work_estimates IS 'Stores estimated work duration for tickets, used in route optimization calculations';
COMMENT ON COLUMN child_ticket_work_estimates.estimated_minutes IS 'Estimated work duration in minutes (1-480)';
