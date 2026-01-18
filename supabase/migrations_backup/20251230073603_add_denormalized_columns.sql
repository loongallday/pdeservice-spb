-- Add denormalized columns to simplify queries and eliminate joins

-- Add denormalized appointment fields to tickets
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS appointment_date DATE;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS appointment_time_start TIME;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS appointment_time_end TIME;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS appointment_is_approved BOOLEAN;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS appointment_type TEXT;

-- Add denormalized location fields to tickets for search
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS site_name TEXT;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS company_name TEXT;

-- Add company name directly to sites
ALTER TABLE sites ADD COLUMN IF NOT EXISTS company_name_th TEXT;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS company_name_en TEXT;

-- Add department_id directly to employees (skip roles lookup)
ALTER TABLE employees ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES departments(id);

-- Add indexes for denormalized fields
CREATE INDEX IF NOT EXISTS idx_tickets_appointment_date ON tickets(appointment_date);
CREATE INDEX IF NOT EXISTS idx_tickets_appointment_approved ON tickets(appointment_date, appointment_is_approved);
CREATE INDEX IF NOT EXISTS idx_tickets_site_name ON tickets(site_name);
CREATE INDEX IF NOT EXISTS idx_tickets_company_name ON tickets(company_name);
CREATE INDEX IF NOT EXISTS idx_employees_department_id ON employees(department_id);
CREATE INDEX IF NOT EXISTS idx_sites_company_name ON sites(company_name_th, company_name_en);

