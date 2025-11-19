-- Migration: Create merchandise management system
-- Created: 2025-11-17
-- Description: Creates tables for merchandise, models, and PM logs

-- Create models table
CREATE TABLE IF NOT EXISTS public.models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model TEXT NOT NULL UNIQUE,
  name TEXT,
  website_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create merchandise table
CREATE TABLE IF NOT EXISTS public.merchandise (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  serial_no TEXT NOT NULL,
  model_id UUID NOT NULL REFERENCES public.models(id) ON DELETE RESTRICT,
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE RESTRICT,
  pm_count INTEGER,
  distributor_id VARCHAR REFERENCES public.companies(tax_id) ON DELETE SET NULL,
  dealer_id VARCHAR REFERENCES public.companies(tax_id) ON DELETE SET NULL,
  replaced_by_id UUID REFERENCES public.merchandise(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create pmlog table
CREATE TABLE IF NOT EXISTS public.pmlog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchandise_id UUID NOT NULL REFERENCES public.merchandise(id) ON DELETE CASCADE,
  description TEXT,
  performed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  performed_by UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX idx_merchandise_model_id ON public.merchandise(model_id);
CREATE INDEX idx_merchandise_site_id ON public.merchandise(site_id);
CREATE INDEX idx_merchandise_distributor_id ON public.merchandise(distributor_id);
CREATE INDEX idx_merchandise_dealer_id ON public.merchandise(dealer_id);
CREATE INDEX idx_merchandise_replaced_by_id ON public.merchandise(replaced_by_id);
CREATE INDEX idx_merchandise_serial_no ON public.merchandise(serial_no);

CREATE INDEX idx_models_model ON public.models(model);

CREATE INDEX idx_pmlog_merchandise_id ON public.pmlog(merchandise_id);
CREATE INDEX idx_pmlog_performed_at ON public.pmlog(performed_at);

-- Add RLS policies
ALTER TABLE public.models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchandise ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pmlog ENABLE ROW LEVEL SECURITY;

-- Add comments
COMMENT ON TABLE public.models IS 'Merchandise models/types catalog';
COMMENT ON COLUMN public.models.model IS 'Unique model identifier';
COMMENT ON COLUMN public.models.name IS 'Display name of the model';
COMMENT ON COLUMN public.models.website_url IS 'URL to model information/documentation';

COMMENT ON TABLE public.merchandise IS 'Merchandise/equipment installed at sites';
COMMENT ON COLUMN public.merchandise.serial_no IS 'Serial number of the merchandise';
COMMENT ON COLUMN public.merchandise.model_id IS 'Reference to the model';
COMMENT ON COLUMN public.merchandise.site_id IS 'Site where merchandise is located';
COMMENT ON COLUMN public.merchandise.pm_count IS 'Maximum PM count before warranty renewal needed';
COMMENT ON COLUMN public.merchandise.distributor_id IS 'Company that distributed this merchandise';
COMMENT ON COLUMN public.merchandise.dealer_id IS 'Company that deals with this merchandise';
COMMENT ON COLUMN public.merchandise.replaced_by_id IS 'Reference to the merchandise that replaced this one';

COMMENT ON TABLE public.pmlog IS 'Preventive Maintenance log entries';
COMMENT ON COLUMN public.pmlog.merchandise_id IS 'Merchandise being maintained';
COMMENT ON COLUMN public.pmlog.description IS 'Description of PM work performed';
COMMENT ON COLUMN public.pmlog.performed_at IS 'When the PM was performed';
COMMENT ON COLUMN public.pmlog.performed_by IS 'Employee who performed the PM';

