-- =============================================
-- Add composite indexes to improve ticket search performance
-- =============================================

-- Composite index for appointment date range + approval status queries
CREATE INDEX IF NOT EXISTS idx_appointments_date_approved
ON main_appointments(appointment_date, is_approved);

-- Composite index for employee ticket search (most common filter)
CREATE INDEX IF NOT EXISTS idx_ticket_employees_cf_employee_ticket
ON jct_ticket_employees_cf(employee_id, ticket_id);

-- Composite index for tickets by status + date (common dashboard query)
CREATE INDEX IF NOT EXISTS idx_tickets_status_created
ON main_tickets(status_id, created_at DESC);

-- Composite index for tickets by work_type + date
CREATE INDEX IF NOT EXISTS idx_tickets_worktype_created
ON main_tickets(work_type_id, created_at DESC);

-- Index for child_ticket_work_givers lookup
CREATE INDEX IF NOT EXISTS idx_ticket_work_givers_ticket
ON child_ticket_work_givers(ticket_id);

-- Analyze tables to update statistics
ANALYZE main_tickets;
ANALYZE main_appointments;
ANALYZE jct_ticket_employees_cf;
ANALYZE child_ticket_work_givers;
