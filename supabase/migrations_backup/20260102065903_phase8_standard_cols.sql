-- Phase 8: Add standard columns (created_at, updated_at) where missing
-- Also add is_active where applicable

-- ============================================
-- Reference Tables - Add timestamps
-- ============================================

-- ref_ticket_statuses - missing created_at, updated_at
ALTER TABLE ref_ticket_statuses 
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE ref_ticket_statuses 
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- ref_ticket_work_types - missing updated_at
ALTER TABLE ref_ticket_work_types 
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- ref_leave_types - already has created_at, add updated_at if missing
ALTER TABLE ref_leave_types 
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- ============================================
-- Main Tables - Ensure all have timestamps
-- ============================================

-- main_org_departments - already has created_at, updated_at

-- main_org_roles - add timestamps if missing
ALTER TABLE main_org_roles 
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE main_org_roles 
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- main_features - add timestamps
ALTER TABLE main_features 
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE main_features 
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- ============================================
-- Junction Tables - Ensure all have created_at
-- ============================================

-- jct_ticket_employees - already has created_at
-- jct_ticket_merchandise - already has created_at
-- jct_appointment_approvers - already has created_at, updated_at
-- jct_site_employee_trainings - already has created_at

-- jct_model_package_items - already has created_at
-- jct_model_package_services - already has created_at

-- ============================================
-- Child Tables - Ensure all have timestamps
-- ============================================

-- child_ticket_audit - already has created_at (no updated_at needed for audit)
-- child_site_contacts - already has created_at, updated_at
-- child_announcement_photos - already has created_at
-- child_announcement_files - already has created_at
-- child_employee_leave_balances - already has created_at, updated_at
-- child_employee_leave_requests - already has created_at, updated_at

-- ============================================
-- Extension Tables - Ensure all have timestamps
-- ============================================

-- ext_model_specifications - already has created_at, updated_at

-- ============================================
-- Add is_active to reference tables that don't have it
-- ============================================

-- ref_ticket_statuses - add is_active
ALTER TABLE ref_ticket_statuses 
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- ref_ticket_work_types - add is_active
ALTER TABLE ref_ticket_work_types 
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

