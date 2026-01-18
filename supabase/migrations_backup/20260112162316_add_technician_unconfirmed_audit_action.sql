-- Add technician_unconfirmed audit action
-- This action is logged when confirmed technicians are removed due to appointment being unapproved

ALTER TABLE child_ticket_audit DROP CONSTRAINT ticket_audit_action_check;

ALTER TABLE child_ticket_audit ADD CONSTRAINT ticket_audit_action_check CHECK (
  action IN (
    'created',
    'updated',
    'deleted',
    'approved',
    'unapproved',
    'technician_confirmed',
    'technician_unconfirmed',
    'technician_changed',
    'employee_assigned',
    'employee_removed',
    'work_giver_set',
    'work_giver_changed',
    'comment_added'
  )
);
