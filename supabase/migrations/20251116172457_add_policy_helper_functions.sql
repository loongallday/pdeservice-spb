-- Permanent helper functions for safe policy management
-- These functions will be available in all future migrations

-- Helper function to safely create a policy if table exists
CREATE OR REPLACE FUNCTION create_policy_if_table_exists(
  policy_name text,
  table_name text,
  policy_definition text
) RETURNS void AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables 
             WHERE table_schema = 'public' 
             AND information_schema.tables.table_name = create_policy_if_table_exists.table_name) THEN
    -- Drop policy if it exists first
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 
                   create_policy_if_table_exists.policy_name, 
                   create_policy_if_table_exists.table_name);
    -- Create the policy
    EXECUTE format('CREATE POLICY %I ON public.%I %s', 
                   create_policy_if_table_exists.policy_name,
                   create_policy_if_table_exists.table_name,
                   policy_definition);
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Helper function to safely drop policies if table exists (permanent version)
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
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 
                     policy_name, 
                     drop_policies_if_table_exists.table_name);
    END LOOP;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Add comments
COMMENT ON FUNCTION create_policy_if_table_exists(text, text, text) IS 
  'Safely creates a policy on a table only if the table exists. Use this in migrations to prevent errors when tables are created in different migrations.';

COMMENT ON FUNCTION drop_policies_if_table_exists(text, text[]) IS 
  'Safely drops multiple policies on a table only if the table exists. Use this in migrations to prevent errors when tables are created in different migrations.';

