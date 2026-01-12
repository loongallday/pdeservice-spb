-- Create fleet management tables
-- Stores vehicle tracking data and garage/base locations

-- Vehicle status enum
CREATE TYPE vehicle_status AS ENUM ('moving', 'stopped', 'parked_at_base');

-- Fleet garages/bases table
CREATE TABLE IF NOT EXISTS public.fleet_garages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  radius_meters INTEGER NOT NULL DEFAULT 100, -- Detection radius
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Fleet vehicles table (synced from external GPS system)
CREATE TABLE IF NOT EXISTS public.fleet_vehicles (
  id TEXT PRIMARY KEY, -- External ID from GPS system
  name TEXT NOT NULL,
  plate_number TEXT,
  driver_name TEXT,
  status vehicle_status NOT NULL DEFAULT 'stopped',
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  speed DOUBLE PRECISION NOT NULL DEFAULT 0,
  heading INTEGER NOT NULL DEFAULT 0,
  signal_strength INTEGER NOT NULL DEFAULT 0,
  address TEXT, -- Reverse geocoded address
  current_garage_id UUID REFERENCES public.fleet_garages(id) ON DELETE SET NULL,
  last_sync_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Fleet vehicle history (optional - for tracking history)
CREATE TABLE IF NOT EXISTS public.fleet_vehicle_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id TEXT NOT NULL REFERENCES public.fleet_vehicles(id) ON DELETE CASCADE,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  speed DOUBLE PRECISION NOT NULL DEFAULT 0,
  heading INTEGER NOT NULL DEFAULT 0,
  status vehicle_status NOT NULL,
  address TEXT,
  garage_id UUID REFERENCES public.fleet_garages(id) ON DELETE SET NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_fleet_vehicles_status ON public.fleet_vehicles(status);
CREATE INDEX idx_fleet_vehicles_plate ON public.fleet_vehicles(plate_number);
CREATE INDEX idx_fleet_vehicles_garage ON public.fleet_vehicles(current_garage_id) WHERE current_garage_id IS NOT NULL;
CREATE INDEX idx_fleet_vehicles_last_sync ON public.fleet_vehicles(last_sync_at);
CREATE INDEX idx_fleet_garages_active ON public.fleet_garages(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_fleet_history_vehicle ON public.fleet_vehicle_history(vehicle_id);
CREATE INDEX idx_fleet_history_recorded ON public.fleet_vehicle_history(recorded_at);

-- Function to calculate distance between two points (Haversine formula)
CREATE OR REPLACE FUNCTION public.calculate_distance_meters(
  lat1 DOUBLE PRECISION,
  lon1 DOUBLE PRECISION,
  lat2 DOUBLE PRECISION,
  lon2 DOUBLE PRECISION
) RETURNS DOUBLE PRECISION AS $$
DECLARE
  R CONSTANT DOUBLE PRECISION := 6371000; -- Earth radius in meters
  phi1 DOUBLE PRECISION;
  phi2 DOUBLE PRECISION;
  delta_phi DOUBLE PRECISION;
  delta_lambda DOUBLE PRECISION;
  a DOUBLE PRECISION;
  c DOUBLE PRECISION;
BEGIN
  phi1 := radians(lat1);
  phi2 := radians(lat2);
  delta_phi := radians(lat2 - lat1);
  delta_lambda := radians(lon2 - lon1);

  a := sin(delta_phi / 2) * sin(delta_phi / 2) +
       cos(phi1) * cos(phi2) *
       sin(delta_lambda / 2) * sin(delta_lambda / 2);
  c := 2 * atan2(sqrt(a), sqrt(1 - a));

  RETURN R * c;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to find nearest garage for a vehicle location
CREATE OR REPLACE FUNCTION public.find_nearest_garage(
  p_latitude DOUBLE PRECISION,
  p_longitude DOUBLE PRECISION
) RETURNS TABLE(
  garage_id UUID,
  garage_name TEXT,
  distance_meters DOUBLE PRECISION,
  is_within_radius BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    g.id,
    g.name,
    public.calculate_distance_meters(p_latitude, p_longitude, g.latitude, g.longitude) as dist,
    public.calculate_distance_meters(p_latitude, p_longitude, g.latitude, g.longitude) <= g.radius_meters
  FROM public.fleet_garages g
  WHERE g.is_active = TRUE
  ORDER BY dist ASC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE;

-- Comments
COMMENT ON TABLE public.fleet_garages IS 'Garage/base locations for fleet vehicles';
COMMENT ON TABLE public.fleet_vehicles IS 'Real-time vehicle tracking data synced from external GPS system';
COMMENT ON TABLE public.fleet_vehicle_history IS 'Historical tracking data for vehicles';
COMMENT ON COLUMN public.fleet_garages.radius_meters IS 'Detection radius - vehicle within this distance is considered parked at base';
COMMENT ON COLUMN public.fleet_vehicles.current_garage_id IS 'Garage where vehicle is currently parked (NULL if not at any garage)';

-- Enable RLS
ALTER TABLE public.fleet_garages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fleet_vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fleet_vehicle_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies - All authenticated users can view
CREATE POLICY "Authenticated users can view garages"
  ON public.fleet_garages FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can view vehicles"
  ON public.fleet_vehicles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can view history"
  ON public.fleet_vehicle_history FOR SELECT
  TO authenticated
  USING (true);

-- Level 2+ can manage garages
CREATE POLICY "Level 2+ can manage garages"
  ON public.fleet_garages FOR ALL
  TO authenticated
  USING (public.get_employee_level() >= 2)
  WITH CHECK (public.get_employee_level() >= 2);

-- Service role full access
CREATE POLICY "Service role full access to garages"
  ON public.fleet_garages FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access to vehicles"
  ON public.fleet_vehicles FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access to history"
  ON public.fleet_vehicle_history FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Grants
GRANT SELECT ON public.fleet_garages TO authenticated;
GRANT SELECT ON public.fleet_vehicles TO authenticated;
GRANT SELECT ON public.fleet_vehicle_history TO authenticated;
GRANT ALL ON public.fleet_garages TO service_role;
GRANT ALL ON public.fleet_vehicles TO service_role;
GRANT ALL ON public.fleet_vehicle_history TO service_role;

-- Insert default garage (PDE office location - you can update this)
INSERT INTO public.fleet_garages (name, description, latitude, longitude, radius_meters)
VALUES ('สำนักงานใหญ่ PDE', 'สำนักงานใหญ่ พีดีอี เซอร์วิส', 13.7325, 100.7309, 150);
