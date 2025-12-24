-- Migration: Add performance indexes for tickets and related tables
-- This migration adds missing indexes to optimize query performance

-- Tickets table indexes
CREATE INDEX IF NOT EXISTS idx_tickets_updated_at ON tickets(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_contact_id ON tickets(contact_id);
CREATE INDEX IF NOT EXISTS idx_tickets_work_result_id ON tickets(work_result_id);
CREATE INDEX IF NOT EXISTS idx_tickets_created_by ON tickets(created_by);

-- Composite indexes for common filter combinations
CREATE INDEX IF NOT EXISTS idx_tickets_status_created ON tickets(status_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_site_status ON tickets(site_id, status_id);
CREATE INDEX IF NOT EXISTS idx_tickets_assigner_status ON tickets(assigner_id, status_id);

-- ticket_employees indexes
CREATE INDEX IF NOT EXISTS idx_ticket_employees_date ON ticket_employees(date);
CREATE INDEX IF NOT EXISTS idx_ticket_employees_composite ON ticket_employees(ticket_id, employee_id, date);

-- Appointments indexes
CREATE INDEX IF NOT EXISTS idx_appointments_is_approved ON appointments(is_approved);
CREATE INDEX IF NOT EXISTS idx_appointments_date_approved ON appointments(appointment_date, is_approved);

-- Sites trigram indexes for search (pg_trgm extension already enabled from previous migration)
CREATE INDEX IF NOT EXISTS idx_sites_name_trgm ON sites USING gin(name gin_trgm_ops);

-- Tickets details search (trigram index for ILIKE pattern matching)
CREATE INDEX IF NOT EXISTS idx_tickets_details_trgm ON tickets USING gin(details gin_trgm_ops);

-- Add comments for documentation
COMMENT ON INDEX idx_tickets_updated_at IS 'Index for sorting tickets by updated_at';
COMMENT ON INDEX idx_tickets_contact_id IS 'Index for filtering tickets by contact_id';
COMMENT ON INDEX idx_tickets_work_result_id IS 'Index for filtering tickets by work_result_id';
COMMENT ON INDEX idx_tickets_created_by IS 'Index for filtering tickets by created_by';
COMMENT ON INDEX idx_tickets_status_created IS 'Composite index for status filtering with created_at sorting';
COMMENT ON INDEX idx_tickets_site_status IS 'Composite index for site and status filtering';
COMMENT ON INDEX idx_tickets_assigner_status IS 'Composite index for assigner and status filtering';
COMMENT ON INDEX idx_ticket_employees_date IS 'Index for filtering ticket_employees by date';
COMMENT ON INDEX idx_ticket_employees_composite IS 'Composite index for unique ticket-employee-date lookups';
COMMENT ON INDEX idx_appointments_is_approved IS 'Index for filtering appointments by approval status';
COMMENT ON INDEX idx_appointments_date_approved IS 'Composite index for date range and approval filtering';
COMMENT ON INDEX idx_sites_name_trgm IS 'GIN trigram index for efficient ILIKE pattern matching on site names';
COMMENT ON INDEX idx_tickets_details_trgm IS 'GIN trigram index for efficient ILIKE pattern matching on ticket details';


