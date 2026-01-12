-- Add driver_name_override column to fleet_vehicles
-- This allows manual editing of driver names while preserving the original from GPS

ALTER TABLE public.fleet_vehicles
ADD COLUMN driver_name_override TEXT;

COMMENT ON COLUMN public.fleet_vehicles.driver_name_override IS 'Manually set driver name that overrides the one from GPS system';
