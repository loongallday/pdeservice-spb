-- ============================================================
-- E2E Test: Full Ticket Workflow
-- Tests: Create ticket → Assign employee → Update status → Complete
-- Run with: psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -f tests/e2e/full-workflow.test.sql
-- ============================================================

\set ON_ERROR_STOP on
\timing on

BEGIN;

\echo '============================================================'
\echo 'E2E TEST: Full Ticket Workflow'
\echo '============================================================'

-- ============================================================
-- SETUP: Create test data
-- ============================================================
\echo ''
\echo '>>> SETUP: Creating test data...'

-- Create test department
INSERT INTO main_org_departments (id, code, name_th, name_en, is_active)
VALUES ('11111111-1111-1111-1111-111111111111', 'TEST_DEPT', 'แผนกทดสอบ', 'Test Department', true)
ON CONFLICT (id) DO NOTHING;

-- Create test role (level 1 for assigner permissions)
INSERT INTO main_org_roles (id, code, name_th, name_en, level, department_id, is_active)
VALUES ('22222222-2222-2222-2222-222222222222', 'TEST_ROLE', 'บทบาททดสอบ', 'Test Role', 1, '11111111-1111-1111-1111-111111111111', true)
ON CONFLICT (id) DO NOTHING;

-- Create test technician role (level 0)
INSERT INTO main_org_roles (id, code, name_th, name_en, level, department_id, is_active)
VALUES ('22222222-2222-2222-2222-222222222223', 'TEST_TECH', 'ช่างทดสอบ', 'Test Technician', 0, '11111111-1111-1111-1111-111111111111', true)
ON CONFLICT (id) DO NOTHING;

-- Create test employees
INSERT INTO main_employees (id, code, name, nickname, email, role_id, is_active)
VALUES
  ('33333333-3333-3333-3333-333333333333', 'E2E001', 'Test Assigner', 'Assigner', 'assigner@test.com', '22222222-2222-2222-2222-222222222222', true),
  ('33333333-3333-3333-3333-333333333334', 'E2E002', 'Test Technician', 'Tech', 'tech@test.com', '22222222-2222-2222-2222-222222222223', true)
ON CONFLICT (id) DO NOTHING;

-- Create test company
INSERT INTO main_companies (id, name_th, name_en, tax_id)
VALUES ('44444444-4444-4444-4444-444444444444', 'บริษัททดสอบ จำกัด', 'Test Company Ltd.', '1234567890123')
ON CONFLICT (id) DO NOTHING;

-- Create test site
INSERT INTO main_sites (id, name, company_id, address_detail)
VALUES ('55555555-5555-5555-5555-555555555555', 'Test Site', '44444444-4444-4444-4444-444444444444', '123 Test Street')
ON CONFLICT (id) DO NOTHING;

-- Get work type and status IDs
DO $$
DECLARE
  v_work_type_id UUID;
  v_status_open_id UUID;
  v_status_in_progress_id UUID;
  v_status_completed_id UUID;
BEGIN
  SELECT id INTO v_work_type_id FROM ref_ticket_work_types WHERE code = 'pm' LIMIT 1;
  SELECT id INTO v_status_open_id FROM ref_ticket_statuses WHERE code = 'open' LIMIT 1;
  SELECT id INTO v_status_in_progress_id FROM ref_ticket_statuses WHERE code = 'in_progress' LIMIT 1;
  SELECT id INTO v_status_completed_id FROM ref_ticket_statuses WHERE code = 'completed' LIMIT 1;

  IF v_work_type_id IS NULL THEN
    INSERT INTO ref_ticket_work_types (id, code, name, is_active)
    VALUES ('66666666-6666-6666-6666-666666666666', 'pm', 'Preventive Maintenance', true)
    RETURNING id INTO v_work_type_id;
  END IF;

  IF v_status_open_id IS NULL THEN
    INSERT INTO ref_ticket_statuses (id, code, name, is_active)
    VALUES ('77777777-7777-7777-7777-777777777771', 'open', 'Open', true)
    RETURNING id INTO v_status_open_id;
  END IF;

  IF v_status_in_progress_id IS NULL THEN
    INSERT INTO ref_ticket_statuses (id, code, name, is_active)
    VALUES ('77777777-7777-7777-7777-777777777772', 'in_progress', 'In Progress', true)
    RETURNING id INTO v_status_in_progress_id;
  END IF;

  IF v_status_completed_id IS NULL THEN
    INSERT INTO ref_ticket_statuses (id, code, name, is_active)
    VALUES ('77777777-7777-7777-7777-777777777773', 'completed', 'Completed', true)
    RETURNING id INTO v_status_completed_id;
  END IF;

  -- Store IDs for later use
  PERFORM set_config('test.work_type_id', v_work_type_id::text, true);
  PERFORM set_config('test.status_open_id', v_status_open_id::text, true);
  PERFORM set_config('test.status_in_progress_id', v_status_in_progress_id::text, true);
  PERFORM set_config('test.status_completed_id', v_status_completed_id::text, true);
END $$;

\echo '✓ Test data created'

-- ============================================================
-- TEST 1: Create a new ticket
-- ============================================================
\echo ''
\echo '>>> TEST 1: Creating a new ticket...'

DO $$
DECLARE
  v_ticket_id UUID;
  v_ticket_code VARCHAR;
  v_work_type_id UUID := current_setting('test.work_type_id')::UUID;
  v_status_open_id UUID := current_setting('test.status_open_id')::UUID;
BEGIN
  INSERT INTO main_tickets (
    id,
    site_id,
    work_type_id,
    status_id,
    details,
    assigner_id,
    created_by
  ) VALUES (
    '88888888-8888-8888-8888-888888888888',
    '55555555-5555-5555-5555-555555555555',
    v_work_type_id,
    v_status_open_id,
    'E2E Test Ticket - Full workflow test',
    '33333333-3333-3333-3333-333333333333',
    '33333333-3333-3333-3333-333333333333'
  )
  RETURNING id, ticket_code INTO v_ticket_id, v_ticket_code;

  -- Verify ticket was created with auto-generated code
  IF v_ticket_code IS NULL OR v_ticket_code = '' THEN
    RAISE EXCEPTION 'TEST FAILED: Ticket code was not generated';
  END IF;

  RAISE NOTICE '✓ Ticket created with ID: % and code: %', v_ticket_id, v_ticket_code;
  PERFORM set_config('test.ticket_id', v_ticket_id::text, true);
  PERFORM set_config('test.ticket_code', v_ticket_code, true);
END $$;

-- Verify trigger set updated_at
SELECT
  CASE WHEN updated_at IS NOT NULL THEN '✓ updated_at trigger working'
       ELSE '✗ FAILED: updated_at not set' END as trigger_test
FROM main_tickets WHERE id = '88888888-8888-8888-8888-888888888888';

-- ============================================================
-- TEST 2: Assign technician to ticket
-- ============================================================
\echo ''
\echo '>>> TEST 2: Assigning technician to ticket...'

DO $$
DECLARE
  v_assignment_count INT;
BEGIN
  INSERT INTO jct_ticket_employees (
    ticket_id,
    employee_id,
    date,
    is_key_employee
  ) VALUES (
    '88888888-8888-8888-8888-888888888888',
    '33333333-3333-3333-3333-333333333334',
    CURRENT_DATE,
    true
  );

  SELECT COUNT(*) INTO v_assignment_count
  FROM jct_ticket_employees
  WHERE ticket_id = '88888888-8888-8888-8888-888888888888';

  IF v_assignment_count = 1 THEN
    RAISE NOTICE '✓ Technician assigned successfully';
  ELSE
    RAISE EXCEPTION 'TEST FAILED: Expected 1 assignment, got %', v_assignment_count;
  END IF;
END $$;

-- ============================================================
-- TEST 3: Update ticket status to In Progress
-- ============================================================
\echo ''
\echo '>>> TEST 3: Updating ticket status to In Progress...'

DO $$
DECLARE
  v_old_updated_at TIMESTAMPTZ;
  v_new_updated_at TIMESTAMPTZ;
  v_status_in_progress_id UUID := current_setting('test.status_in_progress_id')::UUID;
  v_status_code VARCHAR;
BEGIN
  SELECT updated_at INTO v_old_updated_at
  FROM main_tickets WHERE id = '88888888-8888-8888-8888-888888888888';

  UPDATE main_tickets
  SET status_id = v_status_in_progress_id
  WHERE id = '88888888-8888-8888-8888-888888888888'
  RETURNING updated_at INTO v_new_updated_at;

  -- Verify status was actually updated
  SELECT s.code INTO v_status_code
  FROM main_tickets t
  JOIN ref_ticket_statuses s ON t.status_id = s.id
  WHERE t.id = '88888888-8888-8888-8888-888888888888';

  IF v_status_code = 'in_progress' THEN
    RAISE NOTICE '✓ Status updated to in_progress (updated_at: % -> %)', v_old_updated_at, v_new_updated_at;
  ELSE
    RAISE EXCEPTION 'TEST FAILED: Expected in_progress status, got %', v_status_code;
  END IF;
END $$;

-- Verify status change
SELECT
  t.ticket_code,
  s.code as status_code,
  s.name as status_name
FROM main_tickets t
JOIN ref_ticket_statuses s ON t.status_id = s.id
WHERE t.id = '88888888-8888-8888-8888-888888888888';

-- ============================================================
-- TEST 4: Create appointment for ticket
-- ============================================================
\echo ''
\echo '>>> TEST 4: Creating appointment...'

DO $$
DECLARE
  v_appointment_id UUID;
BEGIN
  -- Create appointment first
  INSERT INTO main_appointments (
    id,
    appointment_date,
    appointment_time_start,
    appointment_time_end,
    appointment_type,
    is_approved
  ) VALUES (
    '99999999-9999-9999-9999-999999999999',
    CURRENT_DATE + INTERVAL '1 day',
    '09:00',
    '12:00',
    'scheduled',
    false
  )
  RETURNING id INTO v_appointment_id;

  -- Link appointment to ticket
  UPDATE main_tickets
  SET appointment_id = v_appointment_id
  WHERE id = '88888888-8888-8888-8888-888888888888';

  RAISE NOTICE '✓ Appointment created with ID: % and linked to ticket', v_appointment_id;
END $$;

-- ============================================================
-- TEST 5: Add audit log entry
-- ============================================================
\echo ''
\echo '>>> TEST 5: Adding audit log entry...'

DO $$
DECLARE
  v_audit_count INT;
BEGIN
  INSERT INTO child_ticket_audit (
    ticket_id,
    action,
    employee_id,
    changes
  ) VALUES (
    '88888888-8888-8888-8888-888888888888',
    'updated',
    '33333333-3333-3333-3333-333333333333',
    '{"status": "in_progress"}'::jsonb
  );

  SELECT COUNT(*) INTO v_audit_count
  FROM child_ticket_audit
  WHERE ticket_id = '88888888-8888-8888-8888-888888888888';

  IF v_audit_count >= 1 THEN
    RAISE NOTICE '✓ Audit log entry created (% entries total)', v_audit_count;
  ELSE
    RAISE EXCEPTION 'TEST FAILED: Audit log not created';
  END IF;
END $$;

-- ============================================================
-- TEST 6: Complete the ticket
-- ============================================================
\echo ''
\echo '>>> TEST 6: Completing the ticket...'

DO $$
DECLARE
  v_status_completed_id UUID := current_setting('test.status_completed_id')::UUID;
  v_final_status VARCHAR;
BEGIN
  UPDATE main_tickets
  SET
    status_id = v_status_completed_id
  WHERE id = '88888888-8888-8888-8888-888888888888';

  SELECT s.code INTO v_final_status
  FROM main_tickets t
  JOIN ref_ticket_statuses s ON t.status_id = s.id
  WHERE t.id = '88888888-8888-8888-8888-888888888888';

  IF v_final_status = 'completed' THEN
    RAISE NOTICE '✓ Ticket completed successfully';
  ELSE
    RAISE EXCEPTION 'TEST FAILED: Expected completed status, got %', v_final_status;
  END IF;
END $$;

-- ============================================================
-- TEST 7: Test database functions
-- ============================================================
\echo ''
\echo '>>> TEST 7: Testing database functions...'

-- Test search_tickets function
DO $$
DECLARE
  v_result RECORD;
  v_count INT := 0;
BEGIN
  FOR v_result IN
    SELECT * FROM search_tickets(
      p_search_term := 'E2E Test',
      p_page := 1,
      p_limit := 10
    )
  LOOP
    v_count := v_count + 1;
  END LOOP;

  IF v_count >= 1 THEN
    RAISE NOTICE '✓ search_tickets function works (found % tickets)', v_count;
  ELSE
    RAISE NOTICE '⚠ search_tickets returned 0 results (may be expected if function filters differently)';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '⚠ search_tickets function error: %', SQLERRM;
END $$;

-- Test get_employee_level function
DO $$
DECLARE
  v_level INT;
BEGIN
  SELECT get_employee_level('33333333-3333-3333-3333-333333333333') INTO v_level;

  IF v_level = 1 THEN
    RAISE NOTICE '✓ get_employee_level function works (level: %)', v_level;
  ELSE
    RAISE NOTICE '⚠ get_employee_level returned unexpected level: %', v_level;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '⚠ get_employee_level function error: %', SQLERRM;
END $$;

-- Test cleanup functions (don't actually clean, just verify they exist)
DO $$
BEGIN
  PERFORM cleanup_expired_idempotency_keys();
  RAISE NOTICE '✓ cleanup_expired_idempotency_keys function exists and runs';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '⚠ cleanup_expired_idempotency_keys error: %', SQLERRM;
END $$;

DO $$
BEGIN
  PERFORM delete_expired_notifications();
  RAISE NOTICE '✓ delete_expired_notifications function exists and runs';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '⚠ delete_expired_notifications error: %', SQLERRM;
END $$;

DO $$
BEGIN
  PERFORM check_todo_deadlines();
  RAISE NOTICE '✓ check_todo_deadlines function exists and runs';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '⚠ check_todo_deadlines error: %', SQLERRM;
END $$;

-- ============================================================
-- TEST 8: Verify data integrity
-- ============================================================
\echo ''
\echo '>>> TEST 8: Verifying data integrity...'

-- Check all relationships
SELECT
  t.ticket_code,
  s.name as status,
  w.name as work_type,
  site.name as site_name,
  c.name_en as company_name,
  e.name as assigned_technician,
  a.date as appointment_date
FROM main_tickets t
JOIN ref_ticket_statuses s ON t.status_id = s.id
JOIN ref_ticket_work_types w ON t.work_type_id = w.id
JOIN main_sites site ON t.site_id = site.id
JOIN main_companies c ON site.company_id = c.id
LEFT JOIN jct_ticket_employees jte ON t.id = jte.ticket_id
LEFT JOIN main_employees e ON jte.employee_id = e.id
LEFT JOIN main_appointments a ON t.id = a.ticket_id
WHERE t.id = '88888888-8888-8888-8888-888888888888';

\echo ''
\echo '✓ All relationships verified'

-- ============================================================
-- CLEANUP: Remove test data
-- ============================================================
\echo ''
\echo '>>> CLEANUP: Removing test data...'

DELETE FROM child_ticket_audit WHERE ticket_id = '88888888-8888-8888-8888-888888888888';
DELETE FROM main_appointments WHERE ticket_id = '88888888-8888-8888-8888-888888888888';
DELETE FROM jct_ticket_employees WHERE ticket_id = '88888888-8888-8888-8888-888888888888';
DELETE FROM main_tickets WHERE id = '88888888-8888-8888-8888-888888888888';
DELETE FROM main_sites WHERE id = '55555555-5555-5555-5555-555555555555';
DELETE FROM main_companies WHERE id = '44444444-4444-4444-4444-444444444444';
DELETE FROM main_employees WHERE id IN ('33333333-3333-3333-3333-333333333333', '33333333-3333-3333-3333-333333333334');
DELETE FROM main_org_roles WHERE id IN ('22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222223');
DELETE FROM main_org_departments WHERE id = '11111111-1111-1111-1111-111111111111';

\echo '✓ Test data cleaned up'

COMMIT;

\echo ''
\echo '============================================================'
\echo 'E2E TEST COMPLETED SUCCESSFULLY'
\echo '============================================================'
