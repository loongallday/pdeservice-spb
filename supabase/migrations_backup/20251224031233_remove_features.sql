-- Migration: Remove poll, PM, app_configuration, work_results, and rewards features
-- Created: 2025-12-24
-- Description: Drops all tables, constraints, indexes, policies, and feature entries for removed features

-- =============================================
-- 1. DROP FOREIGN KEY CONSTRAINTS
-- =============================================

-- Polls foreign keys
ALTER TABLE public.poll_votes DROP CONSTRAINT IF EXISTS poll_votes_option_id_fkey;
ALTER TABLE public.poll_votes DROP CONSTRAINT IF EXISTS poll_votes_employee_id_fkey;
ALTER TABLE public.poll_votes DROP CONSTRAINT IF EXISTS poll_votes_poll_id_fkey;
ALTER TABLE public.poll_options DROP CONSTRAINT IF EXISTS poll_options_poll_id_fkey;
ALTER TABLE public.polls DROP CONSTRAINT IF EXISTS polls_created_by_fkey;

-- Work results foreign keys
ALTER TABLE public.work_result_document_pages DROP CONSTRAINT IF EXISTS work_result_document_pages_document_id_fkey;
ALTER TABLE public.work_result_documents DROP CONSTRAINT IF EXISTS work_result_documents_work_result_id_fkey;
ALTER TABLE public.work_result_photos DROP CONSTRAINT IF EXISTS work_result_photos_work_result_id_fkey;
ALTER TABLE public.work_results DROP CONSTRAINT IF EXISTS work_results_created_by_fkey;
ALTER TABLE public.work_results DROP CONSTRAINT IF EXISTS work_results_ticket_id_fkey;
ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS tickets_work_result_id_fkey;

-- PM log foreign keys
ALTER TABLE public.pmlog DROP CONSTRAINT IF EXISTS pmlog_performed_by_fkey;
ALTER TABLE public.pmlog DROP CONSTRAINT IF EXISTS pmlog_merchandise_id_fkey;

-- =============================================
-- 2. REMOVE COLUMN FROM TICKETS
-- =============================================

ALTER TABLE public.tickets DROP COLUMN IF EXISTS work_result_id;

-- =============================================
-- 3. DROP INDEXES
-- =============================================

-- Polls indexes
DROP INDEX IF EXISTS public.idx_polls_created_by;
DROP INDEX IF EXISTS public.idx_polls_expires_at;
DROP INDEX IF EXISTS public.idx_poll_votes_poll_id;
DROP INDEX IF EXISTS public.idx_poll_votes_employee_id;

-- Work results indexes
DROP INDEX IF EXISTS public.idx_work_results_ticket_id;
DROP INDEX IF EXISTS public.idx_work_results_created_by;

-- PM log indexes
DROP INDEX IF EXISTS public.idx_pmlog_merchandise_id;
DROP INDEX IF EXISTS public.idx_pmlog_performed_at;

-- =============================================
-- 4. DROP RLS POLICIES
-- =============================================

-- Polls policies
DROP POLICY IF EXISTS select_policy ON public.polls;
DROP POLICY IF EXISTS insert_policy ON public.polls;
DROP POLICY IF EXISTS update_policy ON public.polls;
DROP POLICY IF EXISTS delete_policy ON public.polls;

DROP POLICY IF EXISTS select_policy ON public.poll_options;
DROP POLICY IF EXISTS insert_policy ON public.poll_options;
DROP POLICY IF EXISTS update_policy ON public.poll_options;
DROP POLICY IF EXISTS delete_policy ON public.poll_options;

DROP POLICY IF EXISTS select_policy ON public.poll_votes;
DROP POLICY IF EXISTS insert_policy ON public.poll_votes;
DROP POLICY IF EXISTS update_policy ON public.poll_votes;
DROP POLICY IF EXISTS delete_policy ON public.poll_votes;

-- Work results policies
DROP POLICY IF EXISTS select_policy ON public.work_results;
DROP POLICY IF EXISTS insert_policy ON public.work_results;
DROP POLICY IF EXISTS update_policy ON public.work_results;
DROP POLICY IF EXISTS delete_policy ON public.work_results;

DROP POLICY IF EXISTS select_policy ON public.work_result_photos;
DROP POLICY IF EXISTS insert_policy ON public.work_result_photos;
DROP POLICY IF EXISTS update_policy ON public.work_result_photos;
DROP POLICY IF EXISTS delete_policy ON public.work_result_photos;

DROP POLICY IF EXISTS select_policy ON public.work_result_documents;
DROP POLICY IF EXISTS insert_policy ON public.work_result_documents;
DROP POLICY IF EXISTS update_policy ON public.work_result_documents;
DROP POLICY IF EXISTS delete_policy ON public.work_result_documents;

DROP POLICY IF EXISTS select_policy ON public.work_result_document_pages;
DROP POLICY IF EXISTS insert_policy ON public.work_result_document_pages;
DROP POLICY IF EXISTS update_policy ON public.work_result_document_pages;
DROP POLICY IF EXISTS delete_policy ON public.work_result_document_pages;

-- PM log policies
DROP POLICY IF EXISTS select_policy ON public.pmlog;
DROP POLICY IF EXISTS insert_policy ON public.pmlog;
DROP POLICY IF EXISTS update_policy ON public.pmlog;
DROP POLICY IF EXISTS delete_policy ON public.pmlog;

-- App configuration policies
DROP POLICY IF EXISTS select_policy ON public.app_configuration;
DROP POLICY IF EXISTS insert_policy ON public.app_configuration;
DROP POLICY IF EXISTS update_policy ON public.app_configuration;
DROP POLICY IF EXISTS delete_policy ON public.app_configuration;

-- Rewards policies
DROP POLICY IF EXISTS "Anyone can read active rewards" ON public.rewards;
DROP POLICY IF EXISTS "Admins can manage rewards" ON public.rewards;

-- =============================================
-- 5. DROP TABLES
-- =============================================

-- Polls tables (child first)
DROP TABLE IF EXISTS public.poll_votes;
DROP TABLE IF EXISTS public.poll_options;
DROP TABLE IF EXISTS public.polls;

-- Work results tables (child first)
DROP TABLE IF EXISTS public.work_result_document_pages;
DROP TABLE IF EXISTS public.work_result_documents;
DROP TABLE IF EXISTS public.work_result_photos;
DROP TABLE IF EXISTS public.work_results;

-- PM log table
DROP TABLE IF EXISTS public.pmlog;

-- App configuration table
DROP TABLE IF EXISTS public.app_configuration;

-- Rewards table
DROP TABLE IF EXISTS public.rewards;

-- =============================================
-- 6. REMOVE FEATURE ENTRIES
-- =============================================

DELETE FROM public.feature WHERE id IN (
  'menu_polls',
  'menu_pm_summary',
  'work_results'
);

-- =============================================
-- MIGRATION COMPLETE
-- =============================================

