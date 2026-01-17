-- Add employee_id column to fleet_vehicles table
-- Links vehicle to an employee for work location tracking

ALTER TABLE public.fleet_vehicles
ADD COLUMN employee_id UUID REFERENCES public.main_employees(id) ON DELETE SET NULL;

-- Index for quick lookup by employee
CREATE INDEX idx_fleet_vehicles_employee ON public.fleet_vehicles(employee_id) WHERE employee_id IS NOT NULL;

COMMENT ON COLUMN public.fleet_vehicles.employee_id IS 'พนักงานที่ประจำรถคันนี้ (เพื่อดึงข้อมูลงานที่ต้องไป)';
