-- =============================================
-- Serial Stock Items - Individual unit tracking
-- =============================================

-- Status enum for serialized items
CREATE TYPE stock_serial_status AS ENUM (
  'in_stock',      -- Available in inventory
  'reserved',      -- Reserved for a ticket
  'deployed',      -- Deployed to customer/site
  'defective',     -- Marked as defective
  'returned',      -- Returned from customer
  'scrapped'       -- Written off / disposed
);

-- Main table for serialized items
CREATE TABLE main_stock_serial_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Item identity
  package_item_id UUID NOT NULL REFERENCES ref_package_items(id),
  serial_no TEXT NOT NULL,

  -- Current location (null if deployed/scrapped)
  location_id UUID REFERENCES main_stock_locations(id),

  -- Status tracking
  status stock_serial_status NOT NULL DEFAULT 'in_stock',

  -- Deployment info (when deployed to ticket/site)
  ticket_id UUID REFERENCES main_tickets(id),
  site_id UUID REFERENCES main_sites(id),

  -- Additional info
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  received_by UUID REFERENCES main_employees(id),
  notes TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Serial number must be unique per item type
  CONSTRAINT unique_serial_per_item UNIQUE (package_item_id, serial_no)
);

-- Indexes for common queries
CREATE INDEX idx_serial_items_location ON main_stock_serial_items(location_id) WHERE location_id IS NOT NULL;
CREATE INDEX idx_serial_items_status ON main_stock_serial_items(status);
CREATE INDEX idx_serial_items_serial_no ON main_stock_serial_items(serial_no);
CREATE INDEX idx_serial_items_package_item ON main_stock_serial_items(package_item_id);
CREATE INDEX idx_serial_items_ticket ON main_stock_serial_items(ticket_id) WHERE ticket_id IS NOT NULL;

-- Enable RLS
ALTER TABLE main_stock_serial_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can view serial items"
  ON main_stock_serial_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role has full access to serial items"
  ON main_stock_serial_items FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Comments
COMMENT ON TABLE main_stock_serial_items IS 'Individual serialized inventory items with full tracking';
COMMENT ON COLUMN main_stock_serial_items.serial_no IS 'Unique serial number for this item';
COMMENT ON COLUMN main_stock_serial_items.status IS 'Current status: in_stock, reserved, deployed, defective, returned, scrapped';
COMMENT ON COLUMN main_stock_serial_items.location_id IS 'Current storage location (null if deployed or scrapped)';
COMMENT ON COLUMN main_stock_serial_items.ticket_id IS 'Associated ticket when deployed or reserved';
