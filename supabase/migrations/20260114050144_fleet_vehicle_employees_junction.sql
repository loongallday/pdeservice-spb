-- Create junction table for fleet vehicle employees (many-to-many)
-- A vehicle can have multiple employees assigned

CREATE TABLE IF NOT EXISTS public.jct_fleet_vehicle_employees (
  vehicle_id TEXT NOT NULL REFERENCES public.fleet_vehicles(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.main_employees(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (vehicle_id, employee_id)
);

-- Indexes
CREATE INDEX idx_jct_fleet_vehicle_employees_vehicle ON public.jct_fleet_vehicle_employees(vehicle_id);
CREATE INDEX idx_jct_fleet_vehicle_employees_employee ON public.jct_fleet_vehicle_employees(employee_id);

-- Comments
COMMENT ON TABLE public.jct_fleet_vehicle_employees IS 'พนักงานที่ประจำรถแต่ละคัน (หลายคนต่อรถได้)';

-- Enable RLS
ALTER TABLE public.jct_fleet_vehicle_employees ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can view vehicle employees"
  ON public.jct_fleet_vehicle_employees FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Level 2+ can manage vehicle employees"
  ON public.jct_fleet_vehicle_employees FOR ALL
  TO authenticated
  USING (public.get_employee_level() >= 2)
  WITH CHECK (public.get_employee_level() >= 2);

CREATE POLICY "Service role full access to vehicle employees"
  ON public.jct_fleet_vehicle_employees FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Grants
GRANT SELECT ON public.jct_fleet_vehicle_employees TO authenticated;
GRANT ALL ON public.jct_fleet_vehicle_employees TO service_role;

-- Drop the single employee_id column (replaced by junction table)
ALTER TABLE public.fleet_vehicles DROP COLUMN IF EXISTS employee_id;
