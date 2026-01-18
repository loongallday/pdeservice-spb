drop extension if exists "pg_net";

-- Helper function to safely drop policies if table exists
CREATE OR REPLACE FUNCTION drop_policies_if_table_exists(
  table_name text,
  policy_names text[]
) RETURNS void AS $$
DECLARE
  policy_name text;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables 
             WHERE table_schema = 'public' 
             AND information_schema.tables.table_name = drop_policies_if_table_exists.table_name) THEN
    FOREACH policy_name IN ARRAY policy_names
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_name, drop_policies_if_table_exists.table_name);
    END LOOP;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Drop app_configuration policies only if table exists
SELECT drop_policies_if_table_exists('app_configuration', ARRAY['delete_policy', 'insert_policy', 'select_policy', 'update_policy']);

-- Drop appointments policies only if table exists
SELECT drop_policies_if_table_exists('appointments', ARRAY['delete_policy', 'insert_policy', 'select_policy', 'update_policy']);

-- Drop companies policies only if table exists
SELECT drop_policies_if_table_exists('companies', ARRAY['delete_policy', 'insert_policy', 'select_policy', 'update_policy']);

-- Drop contacts policies only if table exists
SELECT drop_policies_if_table_exists('contacts', ARRAY['delete_policy', 'insert_policy', 'select_policy', 'update_policy']);

-- Drop employees policies only if table exists
SELECT drop_policies_if_table_exists('employees', ARRAY['employee_delete_minl', 'employee_insert_minl', 'employee_update_minl', 'employees_select_all']);

-- Drop feature policies only if table exists
SELECT drop_policies_if_table_exists('feature', ARRAY['delete_policy', 'insert_policy', 'select_policy', 'update_policy']);

-- Drop leave_balances policies only if table exists
SELECT drop_policies_if_table_exists('leave_balances', ARRAY['delete_policy', 'insert_policy', 'select_policy', 'update_policy']);

-- Drop leave_requests policies only if table exists
SELECT drop_policies_if_table_exists('leave_requests', ARRAY['delete_policy', 'insert_policy', 'select_policy', 'update_policy']);

-- Drop leave_types policies only if table exists
SELECT drop_policies_if_table_exists('leave_types', ARRAY['delete_policy', 'insert_policy', 'select_policy', 'update_policy']);

-- Drop poll_options policies only if table exists
SELECT drop_policies_if_table_exists('poll_options', ARRAY['delete_policy', 'insert_policy', 'select_policy', 'update_policy']);

-- Drop poll_votes policies only if table exists
SELECT drop_policies_if_table_exists('poll_votes', ARRAY['delete_policy', 'insert_policy', 'select_policy', 'update_policy']);

-- Drop polls policies only if table exists
SELECT drop_policies_if_table_exists('polls', ARRAY['delete_policy', 'insert_policy', 'select_policy', 'update_policy']);

-- Drop roles policies only if table exists
SELECT drop_policies_if_table_exists('roles', ARRAY['delete_policy', 'insert_policy', 'roles_select_all', 'update_policy']);

-- Drop sites policies only if table exists
SELECT drop_policies_if_table_exists('sites', ARRAY['delete_policy', 'insert_policy', 'select_policy', 'update_policy']);

-- Drop ticket_employees policies only if table exists
SELECT drop_policies_if_table_exists('ticket_employees', ARRAY['delete_policy', 'insert_policy', 'select_policy', 'update_policy']);

-- Drop ticket_statuses policies only if table exists
SELECT drop_policies_if_table_exists('ticket_statuses', ARRAY['delete_policy', 'insert_policy', 'select_policy', 'update_policy']);

-- Drop tickets policies only if table exists
SELECT drop_policies_if_table_exists('tickets', ARRAY['tickets_delete_l1', 'tickets_insert_l1', 'tickets_read_l1', 'tickets_update_l1']);

-- Drop work_result_document_pages policies only if table exists
SELECT drop_policies_if_table_exists('work_result_document_pages', ARRAY['delete_policy', 'insert_policy', 'select_policy', 'update_policy']);

-- Drop work_result_documents policies only if table exists
SELECT drop_policies_if_table_exists('work_result_documents', ARRAY['delete_policy', 'insert_policy', 'select_policy', 'update_policy']);

-- Drop work_result_photos policies only if table exists
SELECT drop_policies_if_table_exists('work_result_photos', ARRAY['delete_policy', 'insert_policy', 'select_policy', 'update_policy']);

-- Drop work_results policies only if table exists
SELECT drop_policies_if_table_exists('work_results', ARRAY['delete_policy', 'insert_policy', 'select_policy', 'update_policy']);

-- Drop work_types policies only if table exists
SELECT drop_policies_if_table_exists('work_types', ARRAY['delete_policy', 'insert_policy', 'select_policy', 'update_policy']);

-- Clean up helper function
DROP FUNCTION IF EXISTS drop_policies_if_table_exists(text, text[]);

-- Create policies only if tables exist
-- App configuration policies
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND information_schema.tables.table_name = 'app_configuration') THEN
    EXECUTE 'CREATE POLICY IF NOT EXISTS "delete_app_config" ON "public"."app_configuration" AS PERMISSIVE FOR DELETE TO authenticated USING (public.user_has_min_level(2))';
    EXECUTE 'CREATE POLICY IF NOT EXISTS "insert_app_config" ON "public"."app_configuration" AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (public.user_has_min_level(2))';
    EXECUTE 'CREATE POLICY IF NOT EXISTS "select_app_config" ON "public"."app_configuration" AS PERMISSIVE FOR SELECT TO authenticated USING (public.user_has_min_level(0))';
    EXECUTE 'CREATE POLICY IF NOT EXISTS "update_app_config" ON "public"."app_configuration" AS PERMISSIVE FOR UPDATE TO authenticated USING (public.user_has_min_level(2)) WITH CHECK (public.user_has_min_level(2))';
  END IF;
END $$;

-- Appointments policies
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND information_schema.tables.table_name = 'appointments') THEN
    EXECUTE 'CREATE POLICY IF NOT EXISTS "delete_appointments" ON "public"."appointments" AS PERMISSIVE FOR DELETE TO authenticated USING (public.user_has_min_level(1))';
    EXECUTE 'CREATE POLICY IF NOT EXISTS "insert_appointments" ON "public"."appointments" AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (public.user_has_min_level(1))';
    EXECUTE 'CREATE POLICY IF NOT EXISTS "select_appointments" ON "public"."appointments" AS PERMISSIVE FOR SELECT TO authenticated USING (public.user_has_min_level(0))';
    EXECUTE 'CREATE POLICY IF NOT EXISTS "update_appointments" ON "public"."appointments" AS PERMISSIVE FOR UPDATE TO authenticated USING (public.user_has_min_level(1)) WITH CHECK (public.user_has_min_level(1))';
  END IF;
END $$;

-- Companies policies
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND information_schema.tables.table_name = 'companies') THEN
    EXECUTE 'CREATE POLICY IF NOT EXISTS "delete_companies" ON "public"."companies" AS PERMISSIVE FOR DELETE TO authenticated USING (public.user_has_min_level(1))';
    EXECUTE 'CREATE POLICY IF NOT EXISTS "insert_companies" ON "public"."companies" AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (public.user_has_min_level(1))';
    EXECUTE 'CREATE POLICY IF NOT EXISTS "select_companies" ON "public"."companies" AS PERMISSIVE FOR SELECT TO authenticated USING (public.user_has_min_level(0))';
    EXECUTE 'CREATE POLICY IF NOT EXISTS "update_companies" ON "public"."companies" AS PERMISSIVE FOR UPDATE TO authenticated USING (public.user_has_min_level(1)) WITH CHECK (public.user_has_min_level(1))';
  END IF;
END $$;



