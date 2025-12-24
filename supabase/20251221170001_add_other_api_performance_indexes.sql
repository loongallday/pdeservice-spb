-- Migration: Add performance indexes for other APIs
-- These indexes optimize commonly used query patterns across various API endpoints

-- Appointments indexes (compound index for ticket lookup + date queries)
CREATE INDEX IF NOT EXISTS idx_appointments_ticket_date ON appointments(ticket_id, appointment_date);

-- Work results indexes (for ticket lookup)
CREATE INDEX IF NOT EXISTS idx_work_results_ticket_id ON work_results(ticket_id);

-- Work result photos and documents (for work result lookup)
CREATE INDEX IF NOT EXISTS idx_work_result_photos_work_result_id ON work_result_photos(work_result_id);
CREATE INDEX IF NOT EXISTS idx_work_result_documents_work_result_id ON work_result_documents(work_result_id);
CREATE INDEX IF NOT EXISTS idx_work_result_document_pages_document_id ON work_result_document_pages(document_id);

-- Employees indexes (for auth user lookup and search)
CREATE INDEX IF NOT EXISTS idx_employees_auth_user_id ON employees(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_employees_role_id ON employees(role_id);
CREATE INDEX IF NOT EXISTS idx_employees_is_active ON employees(is_active);
-- Trigram indexes for employee name search (pg_trgm already enabled)
CREATE INDEX IF NOT EXISTS idx_employees_name_trgm ON employees USING gin(name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_employees_code_trgm ON employees USING gin(code gin_trgm_ops);

-- Roles indexes (for department lookup)
CREATE INDEX IF NOT EXISTS idx_roles_department_id ON roles(department_id);

-- Contacts indexes (for site lookup)
CREATE INDEX IF NOT EXISTS idx_contacts_site_id ON contacts(site_id);

-- Merchandise indexes (for site and model lookup)
CREATE INDEX IF NOT EXISTS idx_merchandise_site_id ON merchandise(site_id);
CREATE INDEX IF NOT EXISTS idx_merchandise_model_id ON merchandise(model_id);
-- Trigram index for serial number search
CREATE INDEX IF NOT EXISTS idx_merchandise_serial_no_trgm ON merchandise USING gin(serial_no gin_trgm_ops);

-- Leave requests indexes
CREATE INDEX IF NOT EXISTS idx_leave_requests_employee_id ON leave_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_leave_requests_date_range ON leave_requests(start_date, end_date);

-- Leave balances indexes (for employee lookup)
CREATE INDEX IF NOT EXISTS idx_leave_balances_employee_id ON leave_balances(employee_id);
CREATE INDEX IF NOT EXISTS idx_leave_balances_year ON leave_balances(year);

-- Departments index
CREATE INDEX IF NOT EXISTS idx_departments_is_active ON departments(is_active);

-- Ticket merchandise (for ticket lookup)
CREATE INDEX IF NOT EXISTS idx_ticket_merchandise_ticket_id ON ticket_merchandise(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_merchandise_merchandise_id ON ticket_merchandise(merchandise_id);

-- Add comments
COMMENT ON INDEX idx_appointments_ticket_date IS 'Compound index for ticket-appointment queries with date filtering';
COMMENT ON INDEX idx_work_results_ticket_id IS 'Index for looking up work results by ticket';
COMMENT ON INDEX idx_employees_auth_user_id IS 'Index for authenticating users via auth_user_id lookup';
COMMENT ON INDEX idx_employees_name_trgm IS 'GIN trigram index for fuzzy name search';
COMMENT ON INDEX idx_merchandise_serial_no_trgm IS 'GIN trigram index for serial number search';


