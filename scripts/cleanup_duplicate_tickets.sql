-- Script to identify and remove duplicate tickets for site 1e06d0f1-1b41-4942-918c-cec245a48326 on 2024-12-04
-- IMPORTANT: Review the duplicates before running the DELETE section

-- Step 1: Identify duplicate tickets
-- Tickets are considered duplicates if they have the same:
-- - site_id
-- - work_type_id
-- - assigner_id
-- - status_id
-- - details (or both NULL)
-- - created on the same day

WITH duplicate_groups AS (
  SELECT 
    site_id,
    work_type_id,
    assigner_id,
    status_id,
    COALESCE(details, '') as details_normalized,
    DATE(created_at) as created_date,
    ARRAY_AGG(id ORDER BY created_at ASC) as ticket_ids,
    ARRAY_AGG(created_at ORDER BY created_at ASC) as created_ats,
    COUNT(*) as duplicate_count
  FROM tickets
  WHERE site_id = '1e06d0f1-1b41-4942-918c-cec245a48326'
    AND DATE(created_at) = '2024-12-04'
  GROUP BY site_id, work_type_id, assigner_id, status_id, COALESCE(details, ''), DATE(created_at)
  HAVING COUNT(*) > 1
)
SELECT 
  dg.*,
  -- Show details for each duplicate group
  (SELECT json_agg(json_build_object(
    'id', t.id,
    'created_at', t.created_at,
    'details', t.details,
    'work_type_id', t.work_type_id,
    'status_id', t.status_id,
    'appointment_id', t.appointment_id,
    'work_result_id', t.work_result_id
  ) ORDER BY t.created_at)
  FROM tickets t
  WHERE t.id = ANY(dg.ticket_ids)) as tickets_detail
FROM duplicate_groups dg
ORDER BY duplicate_count DESC, created_date;

-- Step 2: Show what will be kept vs deleted
-- (Keep the FIRST ticket in each duplicate group, delete the rest)
WITH duplicate_groups AS (
  SELECT 
    site_id,
    work_type_id,
    assigner_id,
    status_id,
    COALESCE(details, '') as details_normalized,
    DATE(created_at) as created_date,
    ARRAY_AGG(id ORDER BY created_at ASC) as ticket_ids,
    COUNT(*) as duplicate_count
  FROM tickets
  WHERE site_id = '1e06d0f1-1b41-4942-918c-cec245a48326'
    AND DATE(created_at) = '2024-12-04'
  GROUP BY site_id, work_type_id, assigner_id, status_id, COALESCE(details, ''), DATE(created_at)
  HAVING COUNT(*) > 1
),
to_delete AS (
  SELECT 
    UNNEST(ticket_ids[2:]) as ticket_id_to_delete,
    ticket_ids[1] as kept_ticket_id,
    duplicate_count - 1 as will_delete_count
  FROM duplicate_groups
)
SELECT 
  t.id as "Ticket ID to DELETE",
  t.created_at as "Created At",
  t.details as "Details",
  td.kept_ticket_id as "Will KEEP this ticket instead",
  wt.name as "Work Type",
  s.name as "Status"
FROM to_delete td
JOIN tickets t ON t.id = td.ticket_id_to_delete
LEFT JOIN work_types wt ON t.work_type_id = wt.id
LEFT JOIN statuses s ON t.status_id = s.id
ORDER BY t.created_at;

-- Step 3: Count total tickets to be deleted
WITH duplicate_groups AS (
  SELECT 
    site_id,
    work_type_id,
    assigner_id,
    status_id,
    COALESCE(details, '') as details_normalized,
    DATE(created_at) as created_date,
    ARRAY_AGG(id ORDER BY created_at ASC) as ticket_ids,
    COUNT(*) as duplicate_count
  FROM tickets
  WHERE site_id = '1e06d0f1-1b41-4942-918c-cec245a48326'
    AND DATE(created_at) = '2024-12-04'
  GROUP BY site_id, work_type_id, assigner_id, status_id, COALESCE(details, ''), DATE(created_at)
  HAVING COUNT(*) > 1
)
SELECT 
  COUNT(*) as total_duplicate_groups,
  SUM(duplicate_count) as total_tickets_in_groups,
  SUM(duplicate_count - 1) as total_tickets_to_delete
FROM duplicate_groups;

-- ============================================================================
-- DANGER ZONE: Execute the queries above FIRST to review what will be deleted
-- ============================================================================

-- Step 4: DELETE duplicate tickets (UNCOMMENT AFTER REVIEW)
-- This keeps the OLDEST ticket in each duplicate group and deletes the rest

/*
BEGIN;

-- Create temporary table with tickets to delete
CREATE TEMP TABLE tickets_to_delete AS
WITH duplicate_groups AS (
  SELECT 
    site_id,
    work_type_id,
    assigner_id,
    status_id,
    COALESCE(details, '') as details_normalized,
    DATE(created_at) as created_date,
    ARRAY_AGG(id ORDER BY created_at ASC) as ticket_ids,
    COUNT(*) as duplicate_count
  FROM tickets
  WHERE site_id = '1e06d0f1-1b41-4942-918c-cec245a48326'
    AND DATE(created_at) = '2024-12-04'
  GROUP BY site_id, work_type_id, assigner_id, status_id, COALESCE(details, ''), DATE(created_at)
  HAVING COUNT(*) > 1
)
SELECT 
  UNNEST(ticket_ids[2:]) as ticket_id,
  ticket_ids[1] as kept_ticket_id
FROM duplicate_groups;

-- Show what we're about to delete
SELECT 
  COUNT(*) as tickets_to_delete,
  'Review this count before proceeding' as warning
FROM tickets_to_delete;

-- Delete related records first (to avoid foreign key issues)

-- Delete ticket_employees
DELETE FROM ticket_employees
WHERE ticket_id IN (SELECT ticket_id FROM tickets_to_delete);

-- Delete ticket_merchandise
DELETE FROM ticket_merchandise
WHERE ticket_id IN (SELECT ticket_id FROM tickets_to_delete);

-- Delete appointments linked to duplicate tickets
DELETE FROM appointments
WHERE ticket_id IN (SELECT ticket_id FROM tickets_to_delete);

-- Delete work results linked to duplicate tickets
-- (This will cascade to work_result_photos and work_result_documents)
DELETE FROM work_results
WHERE ticket_id IN (SELECT ticket_id FROM tickets_to_delete);

-- Finally, delete the duplicate tickets
DELETE FROM tickets
WHERE id IN (SELECT ticket_id FROM tickets_to_delete);

-- Show summary
SELECT 
  'Deleted ' || COUNT(*) || ' duplicate tickets' as result
FROM tickets_to_delete;

-- If everything looks good, COMMIT
-- If something is wrong, ROLLBACK

-- COMMIT;
-- or
-- ROLLBACK;

*/

