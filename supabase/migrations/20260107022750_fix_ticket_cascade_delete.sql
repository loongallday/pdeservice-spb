-- Fix cascade delete for ticket-related tables
-- When a ticket is deleted, all related records should be automatically deleted

-- ============================================
-- jct_ticket_employees: Add ON DELETE CASCADE
-- ============================================
-- Drop the existing foreign key constraint
ALTER TABLE jct_ticket_employees
DROP CONSTRAINT IF EXISTS jct_ticket_employees_ticket_id_fkey;

-- Re-add with ON DELETE CASCADE
ALTER TABLE jct_ticket_employees
ADD CONSTRAINT jct_ticket_employees_ticket_id_fkey
FOREIGN KEY (ticket_id) REFERENCES main_tickets(id) ON DELETE CASCADE;

-- ============================================
-- Summary of cascade delete behavior:
-- ============================================
-- Tables with ON DELETE CASCADE (auto-delete when ticket deleted):
--   - jct_ticket_employees (fixed in this migration)
--   - jct_ticket_employees_cf (already has cascade)
--   - jct_ticket_merchandise (already has cascade)
--   - child_ticket_comments (already has cascade)
--   - child_ticket_work_givers (already has cascade)
--   - child_comment_photos (cascade via comment)
--   - child_comment_files (cascade via comment)
--
-- Tables with ON DELETE SET NULL (keep record, clear ticket_id):
--   - child_ticket_audit (intentional - preserve audit history)
--   - main_notifications (intentional - preserve notifications)
