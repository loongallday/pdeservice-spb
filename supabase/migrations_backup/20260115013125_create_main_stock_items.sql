-- Stock items (quantity per location per package item)
CREATE TABLE IF NOT EXISTS public.main_stock_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES public.main_stock_locations(id) ON DELETE CASCADE,
  package_item_id UUID NOT NULL REFERENCES public.ref_package_items(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL DEFAULT 0,
  minimum_quantity INTEGER NOT NULL DEFAULT 0,
  reserved_quantity INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Unique constraint: one record per location/item combination
  CONSTRAINT uq_stock_location_item UNIQUE (location_id, package_item_id),

  -- Prevent negative quantities
  CONSTRAINT chk_quantity_non_negative CHECK (quantity >= 0),
  CONSTRAINT chk_reserved_non_negative CHECK (reserved_quantity >= 0),
  CONSTRAINT chk_minimum_non_negative CHECK (minimum_quantity >= 0),
  CONSTRAINT chk_available_non_negative CHECK (quantity >= reserved_quantity)
);

-- Enable RLS
ALTER TABLE public.main_stock_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can read main_stock_items"
  ON public.main_stock_items
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Performance indexes
CREATE INDEX idx_stock_items_location ON public.main_stock_items(location_id);
CREATE INDEX idx_stock_items_package_item ON public.main_stock_items(package_item_id);
CREATE INDEX idx_stock_items_location_item ON public.main_stock_items(location_id, package_item_id);
CREATE INDEX idx_stock_items_low_stock ON public.main_stock_items(location_id, quantity) WHERE quantity <= minimum_quantity;
CREATE INDEX idx_stock_items_has_stock ON public.main_stock_items(location_id) WHERE quantity > 0;

-- Grants
GRANT SELECT ON public.main_stock_items TO authenticated;
GRANT ALL ON public.main_stock_items TO service_role;

COMMENT ON TABLE public.main_stock_items IS 'Stock quantity per location per package item';
