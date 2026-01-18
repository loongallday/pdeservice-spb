-- =============================================
-- Serial Stock Movements - Audit trail for serialized items
-- =============================================

-- Movement type enum
CREATE TYPE stock_serial_movement_type AS ENUM (
  'receive',       -- Received into inventory
  'transfer',      -- Transferred between locations
  'reserve',       -- Reserved for a ticket
  'unreserve',     -- Released reservation
  'deploy',        -- Deployed to customer/site
  'return',        -- Returned from customer
  'defective',     -- Marked as defective
  'repair',        -- Sent for repair / returned from repair
  'scrap',         -- Written off / disposed
  'adjust'         -- Manual status adjustment
);

-- Movement history table
CREATE TABLE child_stock_serial_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Which serial item
  serial_item_id UUID NOT NULL REFERENCES main_stock_serial_items(id) ON DELETE CASCADE,

  -- Movement details
  movement_type stock_serial_movement_type NOT NULL,

  -- Location tracking
  from_location_id UUID REFERENCES main_stock_locations(id),
  to_location_id UUID REFERENCES main_stock_locations(id),

  -- Status change
  from_status stock_serial_status,
  to_status stock_serial_status NOT NULL,

  -- Related ticket (for deploy/return/reserve)
  ticket_id UUID REFERENCES main_tickets(id),

  -- Who and when
  performed_by UUID NOT NULL REFERENCES main_employees(id),
  performed_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Additional info
  notes TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX idx_serial_movements_item ON child_stock_serial_movements(serial_item_id);
CREATE INDEX idx_serial_movements_date ON child_stock_serial_movements(performed_at DESC);
CREATE INDEX idx_serial_movements_type ON child_stock_serial_movements(movement_type);
CREATE INDEX idx_serial_movements_ticket ON child_stock_serial_movements(ticket_id) WHERE ticket_id IS NOT NULL;

-- Enable RLS
ALTER TABLE child_stock_serial_movements ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can view serial movements"
  ON child_stock_serial_movements FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role has full access to serial movements"
  ON child_stock_serial_movements FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Comments
COMMENT ON TABLE child_stock_serial_movements IS 'Complete audit trail for serialized item movements';
COMMENT ON COLUMN child_stock_serial_movements.movement_type IS 'Type of movement: receive, transfer, deploy, return, etc.';
COMMENT ON COLUMN child_stock_serial_movements.from_location_id IS 'Source location (null for receive)';
COMMENT ON COLUMN child_stock_serial_movements.to_location_id IS 'Destination location (null for deploy/scrap)';
