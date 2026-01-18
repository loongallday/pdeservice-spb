-- Reference table for stock location types
CREATE TABLE IF NOT EXISTS public.ref_stock_location_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR NOT NULL UNIQUE,
  name_th VARCHAR NOT NULL,
  name_en VARCHAR,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed data
INSERT INTO public.ref_stock_location_types (code, name_th, name_en, description) VALUES
  ('warehouse', 'คลังสินค้า', 'Warehouse', 'คลังสินค้าหลัก'),
  ('vehicle', 'รถบริการ', 'Service Vehicle', 'สต๊อกในรถบริการ'),
  ('technician', 'ช่างเทคนิค', 'Technician', 'สต๊อกประจำช่าง');

-- Enable RLS
ALTER TABLE public.ref_stock_location_types ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can read ref_stock_location_types"
  ON public.ref_stock_location_types
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Indexes
CREATE INDEX idx_ref_stock_location_types_code ON public.ref_stock_location_types(code);
CREATE INDEX idx_ref_stock_location_types_active ON public.ref_stock_location_types(is_active) WHERE is_active = true;

-- Grants
GRANT SELECT ON public.ref_stock_location_types TO authenticated;
GRANT ALL ON public.ref_stock_location_types TO service_role;

COMMENT ON TABLE public.ref_stock_location_types IS 'Reference table for stock location types (warehouse, vehicle, technician)';
