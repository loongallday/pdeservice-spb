-- Junction table linking tickets to consumed stock items
CREATE TABLE IF NOT EXISTS public.jct_ticket_stock_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.main_tickets(id) ON DELETE CASCADE,
  stock_item_id UUID NOT NULL REFERENCES public.main_stock_items(id) ON DELETE RESTRICT,
  package_item_id UUID NOT NULL REFERENCES public.ref_package_items(id),
  quantity INTEGER NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'consumed',
  consumed_by UUID NOT NULL REFERENCES public.main_employees(id),
  consumed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_quantity_positive CHECK (quantity > 0),
  CONSTRAINT chk_status_valid CHECK (status IN ('reserved', 'consumed', 'returned'))
);

-- Enable RLS
ALTER TABLE public.jct_ticket_stock_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can read jct_ticket_stock_items"
  ON public.jct_ticket_stock_items
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Performance indexes
CREATE INDEX idx_ticket_stock_items_ticket ON public.jct_ticket_stock_items(ticket_id);
CREATE INDEX idx_ticket_stock_items_stock ON public.jct_ticket_stock_items(stock_item_id);
CREATE INDEX idx_ticket_stock_items_package ON public.jct_ticket_stock_items(package_item_id);
CREATE INDEX idx_ticket_stock_items_status ON public.jct_ticket_stock_items(status);
CREATE INDEX idx_ticket_stock_items_consumed_by ON public.jct_ticket_stock_items(consumed_by);

-- Grants
GRANT SELECT ON public.jct_ticket_stock_items TO authenticated;
GRANT ALL ON public.jct_ticket_stock_items TO service_role;

COMMENT ON TABLE public.jct_ticket_stock_items IS 'Junction table linking tickets to consumed stock items';
