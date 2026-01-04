-- Fix remaining functions with mutable search_path

-- Drop all overloads and recreate with search_path set

-- 1. Fix create_policy_if_table_exists (3-arg version)
DROP FUNCTION IF EXISTS create_policy_if_table_exists(text, text, text);
CREATE FUNCTION create_policy_if_table_exists(
  policy_name text, 
  table_name text, 
  policy_definition text
)
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  -- Check if table exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND information_schema.tables.table_name = create_policy_if_table_exists.table_name) THEN
    RETURN;
  END IF;
  
  -- Drop existing policy if exists
  EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_name, table_name);
  
  -- Create new policy
  EXECUTE format('CREATE POLICY %I ON public.%I %s', policy_name, table_name, policy_definition);
END;
$$;

-- 2. Fix drop_policies_if_table_exists (2-arg version with array)
DROP FUNCTION IF EXISTS drop_policies_if_table_exists(text, text[]);
CREATE FUNCTION drop_policies_if_table_exists(
  table_name text, 
  policy_names text[]
)
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  policy_name text;
BEGIN
  -- Check if table exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND information_schema.tables.table_name = drop_policies_if_table_exists.table_name) THEN
    RETURN;
  END IF;
  
  -- Drop specified policies
  FOREACH policy_name IN ARRAY policy_names LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_name, table_name);
  END LOOP;
END;
$$;

-- 3. Fix merge_ticket_duplicates (1-arg version)
DROP FUNCTION IF EXISTS merge_ticket_duplicates(uuid);
CREATE FUNCTION merge_ticket_duplicates(p_canonical_ticket_id uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  -- This is a stub - the actual implementation depends on how duplicates are identified
  -- The current implementation just returns without doing anything
  -- Real implementation would need to identify duplicates and merge them
  RETURN;
END;
$$;

