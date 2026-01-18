-- Stock movement types enum
CREATE TYPE stock_movement_type AS ENUM (
  'receive',
  'consume',
  'transfer_out',
  'transfer_in',
  'adjust_add',
  'adjust_remove',
  'reserve',
  'unreserve'
);

-- Stock movement history
CREATE TABLE IF NOT EXISTS public.child_stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_item_id UUID NOT NULL REFERENCES public.main_stock_items(id) ON DELETE CASCADE,
  movement_type stock_movement_type NOT NULL,
  quantity INTEGER NOT NULL,
  quantity_before INTEGER NOT NULL,
  quantity_after INTEGER NOT NULL,
  reference_id UUID,
  reference_type VARCHAR(50),
  related_location_id UUID REFERENCES public.main_stock_locations(id),
  notes TEXT,
  performed_by UUID NOT NULL REFERENCES public.main_employees(id),
  performed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.child_stock_movements ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can read child_stock_movements"
  ON public.child_stock_movements
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Performance indexes
CREATE INDEX idx_stock_movements_item ON public.child_stock_movements(stock_item_id);
CREATE INDEX idx_stock_movements_item_date ON public.child_stock_movements(stock_item_id, performed_at DESC);
CREATE INDEX idx_stock_movements_type ON public.child_stock_movements(movement_type);
CREATE INDEX idx_stock_movements_reference ON public.child_stock_movements(reference_id, reference_type) WHERE reference_id IS NOT NULL;
CREATE INDEX idx_stock_movements_performed_by ON public.child_stock_movements(performed_by);
CREATE INDEX idx_stock_movements_date ON public.child_stock_movements(performed_at DESC);

-- Grants
GRANT SELECT ON public.child_stock_movements TO authenticated;
GRANT ALL ON public.child_stock_movements TO service_role;

COMMENT ON TABLE public.child_stock_movements IS 'Stock movement history and audit trail';
