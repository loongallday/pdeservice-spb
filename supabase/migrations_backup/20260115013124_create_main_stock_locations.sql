-- Stock locations (warehouses, vehicles, technician allocations)
CREATE TABLE IF NOT EXISTS public.main_stock_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR NOT NULL,
  code VARCHAR NOT NULL UNIQUE,
  location_type_id UUID NOT NULL REFERENCES public.ref_stock_location_types(id),
  site_id UUID REFERENCES public.main_sites(id) ON DELETE SET NULL,
  employee_id UUID REFERENCES public.main_employees(id) ON DELETE SET NULL,
  address TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.main_stock_locations ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can read main_stock_locations"
  ON public.main_stock_locations
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Indexes for performance
CREATE INDEX idx_stock_locations_type ON public.main_stock_locations(location_type_id);
CREATE INDEX idx_stock_locations_site ON public.main_stock_locations(site_id) WHERE site_id IS NOT NULL;
CREATE INDEX idx_stock_locations_employee ON public.main_stock_locations(employee_id) WHERE employee_id IS NOT NULL;
CREATE INDEX idx_stock_locations_active ON public.main_stock_locations(is_active) WHERE is_active = true;
CREATE INDEX idx_stock_locations_code ON public.main_stock_locations(code);

-- Grants
GRANT SELECT ON public.main_stock_locations TO authenticated;
GRANT ALL ON public.main_stock_locations TO service_role;

COMMENT ON TABLE public.main_stock_locations IS 'Stock storage locations (warehouses, vehicles, technician allocations)';
