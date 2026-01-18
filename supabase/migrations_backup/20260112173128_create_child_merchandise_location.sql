-- Migration: Create child_merchandise_location table
-- Child of main_merchandise: Tracks specific location within a site (building, floor, room, zone)

-- Create child_merchandise_location table
CREATE TABLE IF NOT EXISTS public.child_merchandise_location (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchandise_id UUID NOT NULL,
  building TEXT,
  floor TEXT,
  room TEXT,
  zone TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Foreign key constraint
  CONSTRAINT child_merchandise_location_merchandise_id_fkey
    FOREIGN KEY (merchandise_id) REFERENCES public.main_merchandise(id) ON DELETE CASCADE
);

-- Unique constraint: one location record per merchandise
CREATE UNIQUE INDEX idx_child_merchandise_location_unique
  ON child_merchandise_location(merchandise_id);

-- Indexes for performance
CREATE INDEX idx_child_merchandise_location_merchandise_id
  ON child_merchandise_location(merchandise_id);
CREATE INDEX idx_child_merchandise_location_building
  ON child_merchandise_location(building) WHERE building IS NOT NULL;
CREATE INDEX idx_child_merchandise_location_floor
  ON child_merchandise_location(floor) WHERE floor IS NOT NULL;

-- Comments
COMMENT ON TABLE public.child_merchandise_location IS 'Child of main_merchandise: Tracks specific location within a site (building, floor, room, zone)';
COMMENT ON COLUMN public.child_merchandise_location.id IS 'Primary key';
COMMENT ON COLUMN public.child_merchandise_location.merchandise_id IS 'FK to main_merchandise';
COMMENT ON COLUMN public.child_merchandise_location.building IS 'Building name or number';
COMMENT ON COLUMN public.child_merchandise_location.floor IS 'Floor number or name';
COMMENT ON COLUMN public.child_merchandise_location.room IS 'Room number or name';
COMMENT ON COLUMN public.child_merchandise_location.zone IS 'Zone or area within the room/floor';
COMMENT ON COLUMN public.child_merchandise_location.notes IS 'Additional location notes or directions';
COMMENT ON COLUMN public.child_merchandise_location.created_at IS 'Created timestamp';
COMMENT ON COLUMN public.child_merchandise_location.updated_at IS 'Updated timestamp';

-- Enable Row Level Security
ALTER TABLE public.child_merchandise_location ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Authenticated users can read all locations
CREATE POLICY "Authenticated users can read merchandise locations"
  ON public.child_merchandise_location
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Service role can insert/update/delete (API handles authorization)
CREATE POLICY "Service role can modify merchandise locations"
  ON public.child_merchandise_location
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Grant permissions
GRANT SELECT ON public.child_merchandise_location TO authenticated;
GRANT ALL ON public.child_merchandise_location TO service_role;

-- Create updated_at trigger
CREATE TRIGGER set_child_merchandise_location_updated_at
  BEFORE UPDATE ON public.child_merchandise_location
  FOR EACH ROW
  EXECUTE FUNCTION fn_trg_set_updated_at();
