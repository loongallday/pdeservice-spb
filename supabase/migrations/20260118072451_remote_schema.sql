


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";






CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."customer_appointment_type" AS ENUM (
    'full_day',
    'time_range',
    'half_morning',
    'half_afternoon',
    'call_to_schedule'
);


ALTER TYPE "public"."customer_appointment_type" OWNER TO "postgres";


CREATE TYPE "public"."half_day_type_enum" AS ENUM (
    'morning',
    'afternoon'
);


ALTER TYPE "public"."half_day_type_enum" OWNER TO "postgres";


CREATE TYPE "public"."notification_type" AS ENUM (
    'approval',
    'unapproval',
    'technician_confirmed',
    'new_comment',
    'mention',
    'ticket_update',
    'approval_request',
    'todo_reminder',
    'fleet_departure',
    'fleet_arrival'
);


ALTER TYPE "public"."notification_type" OWNER TO "postgres";


CREATE TYPE "public"."safety_standard_type" AS ENUM (
    'safety_shoes',
    'safety_vest',
    'safety_helmet',
    'training'
);


ALTER TYPE "public"."safety_standard_type" OWNER TO "postgres";


CREATE TYPE "public"."stock_movement_type" AS ENUM (
    'receive',
    'consume',
    'transfer_out',
    'transfer_in',
    'adjust_add',
    'adjust_remove',
    'reserve',
    'unreserve'
);


ALTER TYPE "public"."stock_movement_type" OWNER TO "postgres";


CREATE TYPE "public"."stock_serial_movement_type" AS ENUM (
    'receive',
    'transfer',
    'reserve',
    'unreserve',
    'deploy',
    'return',
    'defective',
    'repair',
    'scrap',
    'adjust'
);


ALTER TYPE "public"."stock_serial_movement_type" OWNER TO "postgres";


CREATE TYPE "public"."stock_serial_status" AS ENUM (
    'in_stock',
    'reserved',
    'deployed',
    'defective',
    'returned',
    'scrapped'
);


ALTER TYPE "public"."stock_serial_status" OWNER TO "postgres";


CREATE TYPE "public"."todo_priority" AS ENUM (
    'low',
    'normal',
    'high',
    'urgent'
);


ALTER TYPE "public"."todo_priority" OWNER TO "postgres";


CREATE TYPE "public"."vehicle_status" AS ENUM (
    'moving',
    'stopped',
    'parked_at_base'
);


ALTER TYPE "public"."vehicle_status" OWNER TO "postgres";


CREATE TYPE "public"."watcher_source" AS ENUM (
    'manual',
    'auto_creator',
    'auto_assigner',
    'auto_superadmin'
);


ALTER TYPE "public"."watcher_source" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."adjust_stock"("p_stock_item_id" "uuid", "p_adjustment" integer, "p_performed_by" "uuid", "p_reason" "text") RETURNS TABLE("success" boolean, "message" "text", "new_quantity" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_current_quantity INTEGER;
  v_reserved_quantity INTEGER;
  v_new_quantity INTEGER;
  v_movement_type stock_movement_type;
BEGIN
  -- Get current stock with row lock
  SELECT quantity, reserved_quantity
  INTO v_current_quantity, v_reserved_quantity
  FROM main_stock_items
  WHERE id = p_stock_item_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Stock item not found'::TEXT, 0;
    RETURN;
  END IF;

  v_new_quantity := v_current_quantity + p_adjustment;

  -- Check for negative result
  IF v_new_quantity < 0 THEN
    RETURN QUERY SELECT false, format('Cannot reduce below zero (current: %s, adjustment: %s)', v_current_quantity, p_adjustment)::TEXT, v_current_quantity;
    RETURN;
  END IF;

  -- Check reserved constraint
  IF v_new_quantity < v_reserved_quantity THEN
    RETURN QUERY SELECT false, format('Cannot reduce below reserved quantity (%s)', v_reserved_quantity)::TEXT, v_current_quantity;
    RETURN;
  END IF;

  -- Determine movement type
  IF p_adjustment > 0 THEN
    v_movement_type := 'adjust_add';
  ELSE
    v_movement_type := 'adjust_remove';
  END IF;

  -- Update stock
  UPDATE main_stock_items
  SET quantity = v_new_quantity, updated_at = NOW()
  WHERE id = p_stock_item_id;

  -- Log movement
  INSERT INTO child_stock_movements (stock_item_id, movement_type, quantity, quantity_before, quantity_after, notes, performed_by)
  VALUES (p_stock_item_id, v_movement_type, p_adjustment, v_current_quantity, v_new_quantity, p_reason, p_performed_by);

  RETURN QUERY SELECT true, 'Adjustment completed'::TEXT, v_new_quantity;
END;
$$;


ALTER FUNCTION "public"."adjust_stock"("p_stock_item_id" "uuid", "p_adjustment" integer, "p_performed_by" "uuid", "p_reason" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."adjust_stock"("p_stock_item_id" "uuid", "p_adjustment" integer, "p_performed_by" "uuid", "p_reason" "text") IS 'Atomic operation to adjust stock quantity';



CREATE OR REPLACE FUNCTION "public"."calculate_distance_meters"("lat1" double precision, "lon1" double precision, "lat2" double precision, "lon2" double precision) RETURNS double precision
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
DECLARE
  R CONSTANT DOUBLE PRECISION := 6371000; -- Earth radius in meters
  phi1 DOUBLE PRECISION;
  phi2 DOUBLE PRECISION;
  delta_phi DOUBLE PRECISION;
  delta_lambda DOUBLE PRECISION;
  a DOUBLE PRECISION;
  c DOUBLE PRECISION;
BEGIN
  phi1 := radians(lat1);
  phi2 := radians(lat2);
  delta_phi := radians(lat2 - lat1);
  delta_lambda := radians(lon2 - lon1);

  a := sin(delta_phi / 2) * sin(delta_phi / 2) +
       cos(phi1) * cos(phi2) *
       sin(delta_lambda / 2) * sin(delta_lambda / 2);
  c := 2 * atan2(sqrt(a), sqrt(1 - a));

  RETURN R * c;
END;
$$;


ALTER FUNCTION "public"."calculate_distance_meters"("lat1" double precision, "lon1" double precision, "lat2" double precision, "lon2" double precision) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_todo_deadlines"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  todo_record RECORD;
BEGIN
  -- Find todos that are due and haven't been notified
  FOR todo_record IN
    SELECT
      t.id,
      t.title,
      t.description,
      t.deadline,
      t.ticket_id,
      t.creator_id,
      t.assignee_id,
      t.priority,
      e.name as creator_name
    FROM public.main_todos t
    JOIN public.main_employees e ON t.creator_id = e.id
    WHERE t.deadline <= NOW()
      AND t.notified_at IS NULL
      AND t.is_completed = FALSE
  LOOP
    -- Insert notification for assignee
    INSERT INTO public.main_notifications (
      recipient_id,
      type,
      title,
      message,
      ticket_id,
      actor_id,
      metadata
    ) VALUES (
      todo_record.assignee_id,
      'todo_reminder',
      'ถึงกำหนดงาน: ' || todo_record.title,
      CASE
        WHEN todo_record.creator_id = todo_record.assignee_id THEN 'งานที่คุณสร้างถึงกำหนดแล้ว'
        ELSE 'งานจาก ' || todo_record.creator_name || ' ถึงกำหนดแล้ว'
      END,
      todo_record.ticket_id,
      todo_record.creator_id,
      jsonb_build_object(
        'todo_id', todo_record.id,
        'priority', todo_record.priority::text,
        'deadline', todo_record.deadline
      )
    );

    -- Mark todo as notified
    UPDATE public.main_todos
    SET notified_at = NOW()
    WHERE id = todo_record.id;

    RAISE NOTICE 'Sent notification for todo: %', todo_record.id;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."check_todo_deadlines"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."check_todo_deadlines"() IS 'Checks for due todos and creates notifications for assignees';



CREATE OR REPLACE FUNCTION "public"."cleanup_expired_idempotency_keys"() RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
  DELETE FROM public.sys_idempotency_keys WHERE expires_at < NOW();
END;
$$;


ALTER FUNCTION "public"."cleanup_expired_idempotency_keys"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_expired_staged_files"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  marked_count INTEGER;
  deleted_count INTEGER;
BEGIN
  -- Step 1: Mark files as expired if expires_at has passed and still pending/linked
  UPDATE main_staged_files
  SET status = 'expired', updated_at = NOW()
  WHERE expires_at < NOW()
    AND status IN ('pending', 'linked');

  GET DIAGNOSTICS marked_count = ROW_COUNT;

  -- Step 2: Delete expired files that have been expired for more than 7 days
  -- (gives users time to see what expired before permanent deletion)
  DELETE FROM main_staged_files
  WHERE status = 'expired'
    AND updated_at < NOW() - INTERVAL '7 days';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  RAISE NOTICE 'Staged files cleanup: marked % as expired, deleted % old expired records', marked_count, deleted_count;

  RETURN jsonb_build_object(
    'marked_expired', marked_count,
    'deleted', deleted_count
  );
END;
$$;


ALTER FUNCTION "public"."cleanup_expired_staged_files"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."cleanup_expired_staged_files"() IS 'Marks staged files as expired if expires_at has passed (30 days from upload), and deletes records that have been expired for more than 7 days. Scheduled to run daily at 4:00 AM UTC.';



CREATE OR REPLACE FUNCTION "public"."consume_stock"("p_stock_item_id" "uuid", "p_quantity" integer, "p_ticket_id" "uuid", "p_performed_by" "uuid", "p_notes" "text" DEFAULT NULL::"text") RETURNS TABLE("success" boolean, "message" "text", "remaining_quantity" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_current_quantity INTEGER;
  v_reserved_quantity INTEGER;
  v_available INTEGER;
  v_model_id UUID;
BEGIN
  SELECT quantity, reserved_quantity, model_id
  INTO v_current_quantity, v_reserved_quantity, v_model_id
  FROM main_stock_items
  WHERE id = p_stock_item_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Stock item not found'::TEXT, 0;
    RETURN;
  END IF;

  v_available := v_current_quantity - v_reserved_quantity;

  IF p_quantity > v_available THEN
    RETURN QUERY SELECT false, format('Insufficient stock (available: %s, requested: %s)', v_available, p_quantity)::TEXT, v_available;
    RETURN;
  END IF;

  UPDATE main_stock_items
  SET quantity = quantity - p_quantity,
      updated_at = NOW()
  WHERE id = p_stock_item_id;

  INSERT INTO jct_ticket_stock_items (ticket_id, stock_item_id, model_id, quantity, status, consumed_by)
  VALUES (p_ticket_id, p_stock_item_id, v_model_id, p_quantity, 'consumed', p_performed_by);

  INSERT INTO child_stock_movements (stock_item_id, movement_type, quantity, quantity_before, quantity_after, reference_id, reference_type, notes, performed_by)
  VALUES (p_stock_item_id, 'consume', -p_quantity, v_current_quantity, v_current_quantity - p_quantity, p_ticket_id, 'ticket', p_notes, p_performed_by);

  RETURN QUERY SELECT true, 'Stock consumed successfully'::TEXT, (v_current_quantity - p_quantity);
END;
$$;


ALTER FUNCTION "public"."consume_stock"("p_stock_item_id" "uuid", "p_quantity" integer, "p_ticket_id" "uuid", "p_performed_by" "uuid", "p_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_user_is_role_level_gt0"() RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  user_level INTEGER;
BEGIN
  SELECT r.level INTO user_level
  FROM public.main_employees e
  JOIN public.main_org_roles r ON e.role_id = r.id
  WHERE e.auth_user_id = auth.uid();

  IF user_level IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN user_level > 0;
END;
$$;


ALTER FUNCTION "public"."current_user_is_role_level_gt0"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_expired_notifications"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM main_notifications
  WHERE created_at < NOW() - INTERVAL '2 weeks';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  RAISE NOTICE 'Deleted % expired notifications', deleted_count;

  RETURN deleted_count;
END;
$$;


ALTER FUNCTION "public"."delete_expired_notifications"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."delete_expired_notifications"() IS 'Deletes notifications older than 2 weeks. Scheduled to run daily at 3:00 AM UTC.';



CREATE OR REPLACE FUNCTION "public"."delete_tickets_cascade"("p_ticket_ids" "uuid"[]) RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
  -- Delete ticket_employees
  DELETE FROM public.jct_ticket_employees WHERE ticket_id = ANY(p_ticket_ids);

  -- Delete ticket_merchandise
  DELETE FROM public.jct_ticket_merchandise WHERE ticket_id = ANY(p_ticket_ids);

  -- Delete tickets
  DELETE FROM public.main_tickets WHERE id = ANY(p_ticket_ids);
END;
$$;


ALTER FUNCTION "public"."delete_tickets_cascade"("p_ticket_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."find_nearest_garage"("p_latitude" double precision, "p_longitude" double precision) RETURNS TABLE("garage_id" "uuid", "garage_name" "text", "distance_meters" double precision, "is_within_radius" boolean)
    LANGUAGE "plpgsql" STABLE
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    g.id,
    g.name,
    public.calculate_distance_meters(p_latitude, p_longitude, g.latitude, g.longitude) as dist,
    public.calculate_distance_meters(p_latitude, p_longitude, g.latitude, g.longitude) <= g.radius_meters
  FROM public.fleet_garages g
  WHERE g.is_active = TRUE
  ORDER BY dist ASC
  LIMIT 1;
END;
$$;


ALTER FUNCTION "public"."find_nearest_garage"("p_latitude" double precision, "p_longitude" double precision) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_cleanup_idempotency_keys"() RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
  DELETE FROM public.idempotency_keys WHERE expires_at < NOW();
END;
$$;


ALTER FUNCTION "public"."fn_cleanup_idempotency_keys"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."fn_cleanup_idempotency_keys"() IS 'Removes expired idempotency keys (should be called periodically)';



CREATE OR REPLACE FUNCTION "public"."fn_create_policy_if_exists"("policy_name" "text", "table_name" "text", "policy_definition" "text") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
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


ALTER FUNCTION "public"."fn_create_policy_if_exists"("policy_name" "text", "table_name" "text", "policy_definition" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_create_policy_if_exists_v2"("table_name" "text", "policy_name" "text", "policy_command" "text", "policy_using" "text" DEFAULT NULL::"text", "policy_with_check" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
DECLARE
  sql TEXT;
BEGIN
  -- Check if table exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND information_schema.tables.table_name = create_policy_if_table_exists.table_name) THEN
    RETURN;
  END IF;
  
  -- Drop existing policy if exists
  EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_name, table_name);
  
  -- Build CREATE POLICY statement
  sql := format('CREATE POLICY %I ON public.%I FOR %s', policy_name, table_name, policy_command);
  
  IF policy_using IS NOT NULL THEN
    sql := sql || ' USING (' || policy_using || ')';
  END IF;
  
  IF policy_with_check IS NOT NULL THEN
    sql := sql || ' WITH CHECK (' || policy_with_check || ')';
  END IF;
  
  EXECUTE sql;
END;
$$;


ALTER FUNCTION "public"."fn_create_policy_if_exists_v2"("table_name" "text", "policy_name" "text", "policy_command" "text", "policy_using" "text", "policy_with_check" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_delete_tickets_cascade"("p_ticket_ids" "uuid"[]) RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
  -- Delete ticket_employees
  DELETE FROM public.jct_ticket_employees WHERE ticket_id = ANY(p_ticket_ids);

  -- Delete ticket_merchandise
  DELETE FROM public.jct_ticket_merchandise WHERE ticket_id = ANY(p_ticket_ids);

  -- Delete tickets
  DELETE FROM public.main_tickets WHERE id = ANY(p_ticket_ids);
END;
$$;


ALTER FUNCTION "public"."fn_delete_tickets_cascade"("p_ticket_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_drop_policies_if_exists"("table_name" "text") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
DECLARE
  policy_record RECORD;
BEGIN
  -- Check if table exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND information_schema.tables.table_name = drop_policies_if_table_exists.table_name) THEN
    RETURN;
  END IF;
  
  -- Drop all policies on the table
  FOR policy_record IN
    SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND pg_policies.tablename = drop_policies_if_table_exists.table_name
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_record.policyname, table_name);
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."fn_drop_policies_if_exists"("table_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_drop_policies_if_exists_v2"("table_name" "text", "policy_names" "text"[]) RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
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


ALTER FUNCTION "public"."fn_drop_policies_if_exists_v2"("table_name" "text", "policy_names" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_merge_ticket_duplicates"("p_canonical_ticket_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
  -- This is a stub - the actual implementation depends on how duplicates are identified
  -- The current implementation just returns without doing anything
  -- Real implementation would need to identify duplicates and merge them
  RETURN;
END;
$$;


ALTER FUNCTION "public"."fn_merge_ticket_duplicates"("p_canonical_ticket_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_merge_ticket_duplicates_batch"("p_keep_id" "uuid", "p_remove_ids" "uuid"[]) RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
  -- Move ticket_employees to kept ticket
  UPDATE public.jct_ticket_employees SET ticket_id = p_keep_id WHERE ticket_id = ANY(p_remove_ids);

  -- Move ticket_merchandise to kept ticket
  UPDATE public.jct_ticket_merchandise SET ticket_id = p_keep_id WHERE ticket_id = ANY(p_remove_ids);

  -- Delete duplicate tickets
  DELETE FROM public.main_tickets WHERE id = ANY(p_remove_ids);
END;
$$;


ALTER FUNCTION "public"."fn_merge_ticket_duplicates_batch"("p_keep_id" "uuid", "p_remove_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_trg_set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."fn_trg_set_updated_at"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."fn_trg_set_updated_at"() IS 'Universal trigger function to set updated_at on UPDATE';



CREATE OR REPLACE FUNCTION "public"."fn_trg_validate_ticket_merch"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
DECLARE
  ticket_site_id UUID;
  merchandise_site_id UUID;
BEGIN
  -- Get the site_id from the ticket
  SELECT site_id INTO ticket_site_id FROM public.main_tickets WHERE id = NEW.ticket_id;

  -- Get the site_id from the merchandise
  SELECT site_id INTO merchandise_site_id FROM public.main_merchandise WHERE id = NEW.merchandise_id;

  -- Validate that merchandise belongs to the same site as the ticket
  IF ticket_site_id IS NOT NULL AND merchandise_site_id IS NOT NULL AND ticket_site_id != merchandise_site_id THEN
    RAISE EXCEPTION 'Merchandise must belong to the same site as the ticket';
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."fn_trg_validate_ticket_merch"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."fn_trg_validate_ticket_merch"() IS 'Validates that merchandise linked to a ticket must be in the same site as the ticket';



CREATE OR REPLACE FUNCTION "public"."fn_user_has_min_level"("min_level" integer) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  user_level INTEGER;
BEGIN
  SELECT r.level INTO user_level
  FROM public.employees e
  JOIN public.roles r ON e.role_id = r.id
  WHERE e.auth_user_id = auth.uid();
  
  IF user_level IS NULL THEN
    RETURN FALSE;
  END IF;
  
  RETURN user_level >= min_level;
END;
$$;


ALTER FUNCTION "public"."fn_user_has_min_level"("min_level" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_user_is_level_gt0"() RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  user_level INTEGER;
BEGIN
  SELECT r.level INTO user_level
  FROM public.employees e
  JOIN public.roles r ON e.role_id = r.id
  WHERE e.auth_user_id = auth.uid();
  
  IF user_level IS NULL THEN
    RETURN FALSE;
  END IF;
  
  RETURN user_level > 0;
END;
$$;


ALTER FUNCTION "public"."fn_user_is_level_gt0"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_ticket_audit_summary"("p_action" character varying, "p_changed_fields" "text"[], "p_old_values" "jsonb", "p_new_values" "jsonb", "p_metadata" "jsonb") RETURNS "text"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_summary TEXT := '';
  v_field TEXT;
  v_old_val TEXT;
  v_new_val TEXT;
  v_work_type_name TEXT;
  v_status_old TEXT;
  v_status_new TEXT;
  v_old_count INT;
  v_new_count INT;
  v_employee_names TEXT;
BEGIN
  -- Handle created action
  IF p_action = 'created' THEN
    -- Get work type name
    SELECT name INTO v_work_type_name
    FROM ref_ticket_work_types
    WHERE id = (p_new_values->>'work_type_id')::UUID;

    v_summary := 'สร้างตั๋วงานใหม่';
    IF v_work_type_name IS NOT NULL THEN
      v_summary := v_summary || ' [' || v_work_type_name || ']';
    END IF;

    -- Add metadata info
    IF p_metadata->>'appointment_created' = 'true' THEN
      v_summary := v_summary || ' พร้อมนัดหมาย';
    END IF;
    IF p_metadata->>'site_created' = 'true' THEN
      v_summary := v_summary || ' (สร้างไซต์ใหม่)';
    END IF;
    IF p_metadata->>'contact_created' = 'true' THEN
      v_summary := v_summary || ' (สร้างผู้ติดต่อใหม่)';
    END IF;

    RETURN v_summary;
  END IF;

  -- Handle approved action
  IF p_action = 'approved' THEN
    v_summary := 'อนุมัติการนัดหมาย';

    -- Add appointment details if changed
    IF p_new_values->>'appointment_date' IS NOT NULL THEN
      v_summary := v_summary || ' วันที่ ' || (p_new_values->>'appointment_date');
    END IF;
    IF p_new_values->>'appointment_time_start' IS NOT NULL THEN
      v_summary := v_summary || ' เวลา ' || (p_new_values->>'appointment_time_start');
      IF p_new_values->>'appointment_time_end' IS NOT NULL THEN
        v_summary := v_summary || '-' || (p_new_values->>'appointment_time_end');
      END IF;
    END IF;

    RETURN v_summary;
  END IF;

  -- Handle unapproved action
  IF p_action = 'unapproved' THEN
    RETURN 'ยกเลิกการอนุมัตินัดหมาย';
  END IF;

  -- Handle technician_confirmed action
  IF p_action = 'technician_confirmed' THEN
    v_old_count := COALESCE((p_metadata->>'employee_count')::INT, 0);

    -- Try to get employee names from new_values
    IF p_new_values->'employee_names' IS NOT NULL THEN
      SELECT string_agg(elem::TEXT, ', ')
      INTO v_employee_names
      FROM jsonb_array_elements_text(p_new_values->'employee_names') AS elem;

      -- Remove quotes from names
      v_employee_names := REPLACE(v_employee_names, '"', '');
    END IF;

    IF v_employee_names IS NOT NULL AND v_employee_names != '' THEN
      v_summary := 'ยืนยันช่าง: ' || v_employee_names;
    ELSE
      v_summary := 'ยืนยันช่าง ' || v_old_count || ' คน';
    END IF;

    -- Add date if available
    IF p_new_values->>'date' IS NOT NULL THEN
      v_summary := v_summary || ' วันที่ ' || (p_new_values->>'date');
    END IF;

    RETURN v_summary;
  END IF;

  -- Handle technician_changed action
  IF p_action = 'technician_changed' THEN
    v_old_count := COALESCE(jsonb_array_length(p_old_values->'confirmed_employees'), 0);
    v_new_count := COALESCE(jsonb_array_length(p_new_values->'confirmed_employees'), 0);

    IF v_new_count > v_old_count THEN
      v_summary := 'เพิ่มช่างยืนยัน ' || (v_new_count - v_old_count) || ' คน';
    ELSIF v_new_count < v_old_count THEN
      v_summary := 'ลดช่างยืนยัน ' || (v_old_count - v_new_count) || ' คน';
    ELSE
      v_summary := 'เปลี่ยนช่างยืนยัน';
    END IF;

    RETURN v_summary;
  END IF;

  -- Handle employee_assigned action
  IF p_action = 'employee_assigned' THEN
    v_new_count := COALESCE(jsonb_array_length(p_new_values->'employee_ids'), 0);

    IF p_new_values->'employee_names' IS NOT NULL THEN
      SELECT string_agg(elem::TEXT, ', ')
      INTO v_employee_names
      FROM jsonb_array_elements_text(p_new_values->'employee_names') AS elem;
      v_employee_names := REPLACE(v_employee_names, '"', '');
    END IF;

    IF v_employee_names IS NOT NULL AND v_employee_names != '' THEN
      v_summary := 'มอบหมายงานให้: ' || v_employee_names;
    ELSE
      v_summary := 'มอบหมายงานให้ช่าง ' || v_new_count || ' คน';
    END IF;

    RETURN v_summary;
  END IF;

  -- Handle employee_removed action
  IF p_action = 'employee_removed' THEN
    v_old_count := COALESCE(jsonb_array_length(p_old_values->'employee_ids'), 0);

    IF p_old_values->'employee_names' IS NOT NULL THEN
      SELECT string_agg(elem::TEXT, ', ')
      INTO v_employee_names
      FROM jsonb_array_elements_text(p_old_values->'employee_names') AS elem;
      v_employee_names := REPLACE(v_employee_names, '"', '');
    END IF;

    IF v_employee_names IS NOT NULL AND v_employee_names != '' THEN
      v_summary := 'ยกเลิกมอบหมาย: ' || v_employee_names;
    ELSE
      v_summary := 'ยกเลิกมอบหมายช่าง ' || v_old_count || ' คน';
    END IF;

    RETURN v_summary;
  END IF;

  -- Handle work_giver_set action
  IF p_action = 'work_giver_set' THEN
    IF p_new_values->>'work_giver_name' IS NOT NULL THEN
      v_summary := 'ตั้งผู้ให้งาน: ' || (p_new_values->>'work_giver_name');
    ELSE
      v_summary := 'ตั้งผู้ให้งาน';
    END IF;

    RETURN v_summary;
  END IF;

  -- Handle work_giver_changed action
  IF p_action = 'work_giver_changed' THEN
    v_old_val := COALESCE(p_old_values->>'work_giver_name', 'ไม่ระบุ');
    v_new_val := COALESCE(p_new_values->>'work_giver_name', 'ไม่ระบุ');

    RETURN 'เปลี่ยนผู้ให้งานจาก ' || v_old_val || ' เป็น ' || v_new_val;
  END IF;

  -- Handle updated action
  IF p_action = 'updated' THEN
    IF p_changed_fields IS NULL OR array_length(p_changed_fields, 1) IS NULL THEN
      RETURN 'อัปเดตข้อมูลตั๋ว';
    END IF;

    FOREACH v_field IN ARRAY p_changed_fields LOOP
      IF v_summary != '' THEN
        v_summary := v_summary || ', ';
      END IF;

      CASE v_field
        -- Employee changes
        WHEN 'employee_ids' THEN
          v_old_count := COALESCE(jsonb_array_length(p_old_values->'employee_ids'), 0);
          v_new_count := COALESCE(jsonb_array_length(p_new_values->'employee_ids'), 0);
          IF v_old_count = 0 AND v_new_count > 0 THEN
            v_summary := v_summary || 'มอบหมายช่าง ' || v_new_count || ' คน';
          ELSIF v_new_count > v_old_count THEN
            v_summary := v_summary || 'เพิ่มช่าง ' || (v_new_count - v_old_count) || ' คน';
          ELSIF v_new_count < v_old_count THEN
            v_summary := v_summary || 'ลดช่าง ' || (v_old_count - v_new_count) || ' คน';
          ELSE
            v_summary := v_summary || 'เปลี่ยนช่าง';
          END IF;

        -- Status changes
        WHEN 'status_id' THEN
          SELECT name INTO v_status_old FROM ref_ticket_statuses WHERE id = (p_old_values->>'status_id')::UUID;
          SELECT name INTO v_status_new FROM ref_ticket_statuses WHERE id = (p_new_values->>'status_id')::UUID;
          v_summary := v_summary || 'เปลี่ยนสถานะจาก ' || COALESCE(v_status_old, '?') || ' เป็น ' || COALESCE(v_status_new, '?');

        -- Appointment date changes
        WHEN 'appointment.appointment_date' THEN
          v_old_val := p_old_values->>'appointment.appointment_date';
          v_new_val := p_new_values->>'appointment.appointment_date';
          v_summary := v_summary || 'เปลี่ยนวันนัดจาก ' || COALESCE(v_old_val, '-') || ' เป็น ' || COALESCE(v_new_val, '-');

        -- Appointment time changes
        WHEN 'appointment.appointment_time_start' THEN
          v_old_val := p_old_values->>'appointment.appointment_time_start';
          v_new_val := p_new_values->>'appointment.appointment_time_start';
          v_summary := v_summary || 'เปลี่ยนเวลาเริ่มจาก ' || COALESCE(v_old_val, '-') || ' เป็น ' || COALESCE(v_new_val, '-');

        WHEN 'appointment.appointment_time_end' THEN
          v_old_val := p_old_values->>'appointment.appointment_time_end';
          v_new_val := p_new_values->>'appointment.appointment_time_end';
          v_summary := v_summary || 'เปลี่ยนเวลาสิ้นสุดจาก ' || COALESCE(v_old_val, '-') || ' เป็น ' || COALESCE(v_new_val, '-');

        WHEN 'appointment.appointment_type' THEN
          v_old_val := p_old_values->>'appointment.appointment_type';
          v_new_val := p_new_values->>'appointment.appointment_type';
          v_summary := v_summary || 'เปลี่ยนประเภทนัดจาก ' || COALESCE(v_old_val, '-') || ' เป็น ' || COALESCE(v_new_val, '-');

        -- Details changes
        WHEN 'details' THEN
          v_summary := v_summary || 'แก้ไขรายละเอียดงาน';

        -- Site changes
        WHEN 'site_id' THEN
          v_summary := v_summary || 'เปลี่ยนสถานที่';

        -- Contact changes
        WHEN 'contact_id' THEN
          v_summary := v_summary || 'เปลี่ยนผู้ติดต่อ';

        -- Assigner changes
        WHEN 'assigner_id' THEN
          v_summary := v_summary || 'เปลี่ยนผู้มอบหมาย';

        -- Work type changes
        WHEN 'work_type_id' THEN
          v_summary := v_summary || 'เปลี่ยนประเภทงาน';

        -- Merchandise changes
        WHEN 'merchandise_ids' THEN
          v_summary := v_summary || 'เปลี่ยนอุปกรณ์';

        ELSE
          v_summary := v_summary || 'แก้ไข ' || v_field;
      END CASE;
    END LOOP;

    RETURN v_summary;
  END IF;

  -- Handle deleted action
  IF p_action = 'deleted' THEN
    RETURN 'ลบตั๋วงาน';
  END IF;

  RETURN 'ดำเนินการ: ' || p_action;
END;
$$;


ALTER FUNCTION "public"."generate_ticket_audit_summary"("p_action" character varying, "p_changed_fields" "text"[], "p_old_values" "jsonb", "p_new_values" "jsonb", "p_metadata" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."generate_ticket_audit_summary"("p_action" character varying, "p_changed_fields" "text"[], "p_old_values" "jsonb", "p_new_values" "jsonb", "p_metadata" "jsonb") IS 'Generates natural language Thai summary from audit data. Supports: created, updated, deleted, approved, unapproved, technician_confirmed, technician_changed, employee_assigned, employee_removed, work_giver_set, work_giver_changed';



CREATE OR REPLACE FUNCTION "public"."generate_ticket_code"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.ticket_number IS NULL THEN
    NEW.ticket_number := nextval('ticket_number_seq');
  END IF;
  IF NEW.ticket_code IS NULL THEN
    NEW.ticket_code := 'PDE-' || NEW.ticket_number;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."generate_ticket_code"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."generate_ticket_code"() IS 'Auto-generates ticket_number and ticket_code (PDE-N) on insert';



CREATE OR REPLACE FUNCTION "public"."get_employee_level"() RETURNS integer
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
DECLARE
  emp_level INT;
BEGIN
  SELECT COALESCE(r.level, 0) INTO emp_level
  FROM public.main_employees e
  LEFT JOIN public.main_org_roles r ON e.role_id = r.id
  WHERE e.auth_user_id = auth.uid();
  
  RETURN COALESCE(emp_level, -1);
END;
$$;


ALTER FUNCTION "public"."get_employee_level"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_low_stock_items"() RETURNS TABLE("stock_item_id" "uuid", "location_id" "uuid", "location_name" character varying, "location_code" character varying, "model_id" "uuid", "item_code" "text", "item_name" character varying, "quantity" integer, "minimum_quantity" integer, "deficit" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    si.id,
    sl.id,
    sl.name,
    sl.code,
    m.id,
    m.model,
    m.name_th,
    si.quantity,
    si.minimum_quantity,
    (si.minimum_quantity - si.quantity) as deficit
  FROM main_stock_items si
  JOIN main_stock_locations sl ON si.location_id = sl.id
  JOIN main_models m ON si.model_id = m.id
  WHERE si.quantity <= si.minimum_quantity
    AND sl.is_active = true
    AND (m.is_active IS NULL OR m.is_active = true)
  ORDER BY deficit DESC, sl.name, m.model;
END;
$$;


ALTER FUNCTION "public"."get_low_stock_items"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_technician_detail_data"("p_employee_id" "uuid", "p_start_date" "date", "p_end_date" "date") RETURNS TABLE("ticket_id" "uuid", "appointment_date" "date", "work_type_code" character varying, "work_type_name" character varying, "province_code" integer)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT
    t.id as ticket_id,
    a.appointment_date,
    wt.code as work_type_code,
    wt.name as work_type_name,
    s.province_code
  FROM jct_ticket_employees_cf cf
  INNER JOIN main_tickets t ON cf.ticket_id = t.id
  INNER JOIN main_appointments a ON t.appointment_id = a.id
  LEFT JOIN ref_ticket_work_types wt ON t.work_type_id = wt.id
  LEFT JOIN main_sites s ON t.site_id = s.id
  WHERE cf.employee_id = p_employee_id
    AND a.appointment_date >= p_start_date
    AND a.appointment_date <= p_end_date;
$$;


ALTER FUNCTION "public"."get_technician_detail_data"("p_employee_id" "uuid", "p_start_date" "date", "p_end_date" "date") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_technician_detail_data"("p_employee_id" "uuid", "p_start_date" "date", "p_end_date" "date") IS 'Get technician detail data by employee ID and appointment date range';



CREATE OR REPLACE FUNCTION "public"."get_workload_distribution_data"("p_start_date" "date", "p_end_date" "date") RETURNS TABLE("employee_id" "uuid", "ticket_id" "uuid", "appointment_date" "date")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT
    cf.employee_id,
    cf.ticket_id,
    a.appointment_date
  FROM jct_ticket_employees_cf cf
  INNER JOIN main_tickets t ON cf.ticket_id = t.id
  INNER JOIN main_appointments a ON t.appointment_id = a.id
  WHERE a.appointment_date >= p_start_date
    AND a.appointment_date <= p_end_date;
$$;


ALTER FUNCTION "public"."get_workload_distribution_data"("p_start_date" "date", "p_end_date" "date") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_workload_distribution_data"("p_start_date" "date", "p_end_date" "date") IS 'Get workload distribution data by appointment date range';



CREATE OR REPLACE FUNCTION "public"."merge_ticket_duplicates"("p_keep_id" "uuid", "p_remove_ids" "uuid"[]) RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
  -- Move ticket_employees to kept ticket
  UPDATE public.jct_ticket_employees SET ticket_id = p_keep_id WHERE ticket_id = ANY(p_remove_ids);

  -- Move ticket_merchandise to kept ticket
  UPDATE public.jct_ticket_merchandise SET ticket_id = p_keep_id WHERE ticket_id = ANY(p_remove_ids);

  -- Delete duplicate tickets
  DELETE FROM public.main_tickets WHERE id = ANY(p_remove_ids);
END;
$$;


ALTER FUNCTION "public"."merge_ticket_duplicates"("p_keep_id" "uuid", "p_remove_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_fleet_status_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_is_departure BOOLEAN;
  v_is_arrival BOOLEAN;
  v_garage_id UUID;
  v_garage_name TEXT;
  v_plate_number TEXT;
  v_employee_names TEXT[];
  v_employee_ids UUID[];
  v_employee_list TEXT;
  v_notification_type public.notification_type;
  v_title TEXT;
  v_message TEXT;
  v_metadata JSONB;
BEGIN
  -- Check if this is a departure (leaving garage)
  v_is_departure := (
    OLD.status = 'parked_at_base' AND
    NEW.status IN ('moving', 'stopped')
  );

  -- Check if this is an arrival (arriving at garage)
  v_is_arrival := (
    OLD.status IN ('moving', 'stopped') AND
    NEW.status = 'parked_at_base'
  );

  -- Exit if neither departure nor arrival
  IF NOT v_is_departure AND NOT v_is_arrival THEN
    RETURN NEW;
  END IF;

  -- Get employees assigned to this vehicle
  SELECT
    array_agg(e.id),
    array_agg(e.name)
  INTO v_employee_ids, v_employee_names
  FROM public.jct_fleet_vehicle_employees jfve
  JOIN public.main_employees e ON e.id = jfve.employee_id
  WHERE jfve.vehicle_id = NEW.id;

  -- Skip if no employees assigned
  IF v_employee_ids IS NULL OR array_length(v_employee_ids, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  -- Build employee name list
  v_employee_list := array_to_string(v_employee_names, ', ');

  -- Get garage info
  IF v_is_departure THEN
    -- For departure, use the old garage (where they were parked)
    v_garage_id := OLD.current_garage_id;
  ELSE
    -- For arrival, use the new garage (where they arrived)
    v_garage_id := NEW.current_garage_id;
  END IF;

  -- Get garage name
  IF v_garage_id IS NOT NULL THEN
    SELECT name INTO v_garage_name
    FROM public.fleet_garages
    WHERE id = v_garage_id;
  END IF;

  -- Use default if no garage name found
  IF v_garage_name IS NULL THEN
    v_garage_name := 'ออฟฟิศ';
  END IF;

  -- Get plate number (prefer override)
  v_plate_number := COALESCE(NEW.plate_number_override, NEW.plate_number, NEW.name);

  -- Set notification type and messages
  IF v_is_departure THEN
    v_notification_type := 'fleet_departure';
    v_title := 'พนักงานออกเดินทาง';
    v_message := format('พนักงาน %s ออกจาก %s แล้ว (รถ: %s)',
      v_employee_list, v_garage_name, v_plate_number);
  ELSE
    v_notification_type := 'fleet_arrival';
    v_title := 'พนักงานถึงออฟฟิศ';
    v_message := format('พนักงาน %s ถึง %s แล้ว (รถ: %s)',
      v_employee_list, v_garage_name, v_plate_number);
  END IF;

  -- Build metadata
  v_metadata := jsonb_build_object(
    'vehicle_id', NEW.id,
    'vehicle_name', NEW.name,
    'plate_number', v_plate_number,
    'garage_id', v_garage_id,
    'garage_name', v_garage_name,
    'employee_ids', v_employee_ids,
    'employee_names', v_employee_names,
    'event_type', CASE WHEN v_is_departure THEN 'departure' ELSE 'arrival' END,
    'timestamp', NOW()
  );

  -- Insert notifications for all SUPERADMIN employees (level = 3)
  INSERT INTO public.main_notifications (
    recipient_id,
    type,
    title,
    message,
    metadata,
    created_at
  )
  SELECT
    e.id,
    v_notification_type,
    v_title,
    v_message,
    v_metadata,
    NOW()
  FROM public.main_employees e
  JOIN public.main_org_roles r ON r.id = e.role_id
  WHERE r.level = 3;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_fleet_status_change"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."notify_fleet_status_change"() IS 'Trigger function to send notifications to superadmins (level 3) when vehicle status changes (departure/arrival at garage)';



CREATE OR REPLACE FUNCTION "public"."receive_stock"("p_location_id" "uuid", "p_model_id" "uuid", "p_quantity" integer, "p_performed_by" "uuid", "p_notes" "text" DEFAULT NULL::"text") RETURNS TABLE("success" boolean, "stock_item_id" "uuid", "new_quantity" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_stock_id UUID;
  v_current_quantity INTEGER;
BEGIN
  SELECT id, quantity INTO v_stock_id, v_current_quantity
  FROM main_stock_items
  WHERE location_id = p_location_id AND model_id = p_model_id
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO main_stock_items (location_id, model_id, quantity)
    VALUES (p_location_id, p_model_id, p_quantity)
    RETURNING id, quantity INTO v_stock_id, v_current_quantity;

    INSERT INTO child_stock_movements (stock_item_id, movement_type, quantity, quantity_before, quantity_after, notes, performed_by)
    VALUES (v_stock_id, 'receive', p_quantity, 0, p_quantity, p_notes, p_performed_by);

    RETURN QUERY SELECT true, v_stock_id, p_quantity;
    RETURN;
  END IF;

  UPDATE main_stock_items
  SET quantity = quantity + p_quantity, updated_at = NOW()
  WHERE id = v_stock_id;

  INSERT INTO child_stock_movements (stock_item_id, movement_type, quantity, quantity_before, quantity_after, notes, performed_by)
  VALUES (v_stock_id, 'receive', p_quantity, v_current_quantity, v_current_quantity + p_quantity, p_notes, p_performed_by);

  RETURN QUERY SELECT true, v_stock_id, (v_current_quantity + p_quantity);
END;
$$;


ALTER FUNCTION "public"."receive_stock"("p_location_id" "uuid", "p_model_id" "uuid", "p_quantity" integer, "p_performed_by" "uuid", "p_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_sites_with_ticket_count"("p_query" "text" DEFAULT NULL::"text", "p_company_id" "uuid" DEFAULT NULL::"uuid", "p_min_ticket_count" integer DEFAULT NULL::integer, "p_max_ticket_count" integer DEFAULT NULL::integer, "p_page" integer DEFAULT 1, "p_limit" integer DEFAULT 20) RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_offset integer;
  v_total bigint;
  v_safe_query text;
  v_result json;
BEGIN
  v_offset := (p_page - 1) * p_limit;
  v_safe_query := COALESCE(REPLACE(p_query, ',', ' '), '');

  -- Get total count
  SELECT COUNT(*) INTO v_total
  FROM (
    SELECT s.id
    FROM main_sites s
    LEFT JOIN main_companies c ON s.company_id = c.id
    LEFT JOIN main_tickets t ON t.site_id = s.id
    WHERE (
      p_query IS NULL
      OR p_query = ''
      OR s.name ILIKE '%' || v_safe_query || '%'
      OR s.address_detail ILIKE '%' || v_safe_query || '%'
      OR c.name_th ILIKE '%' || v_safe_query || '%'
      OR c.name_en ILIKE '%' || v_safe_query || '%'
    )
    AND (p_company_id IS NULL OR s.company_id = p_company_id)
    GROUP BY s.id
    HAVING (
      (p_min_ticket_count IS NULL OR COUNT(t.id) >= p_min_ticket_count)
      AND (p_max_ticket_count IS NULL OR COUNT(t.id) <= p_max_ticket_count)
    )
  ) filtered;

  -- Get results as JSON
  SELECT json_build_object(
    'total', v_total,
    'data', COALESCE(json_agg(row_to_json(t)), '[]'::json)
  ) INTO v_result
  FROM (
    SELECT
      s.id,
      s.name,
      s.address_detail,
      s.company_id,
      s.is_main_branch,
      c.name_th AS company_name_th,
      c.name_en AS company_name_en,
      COUNT(t.id)::integer AS ticket_count
    FROM main_sites s
    LEFT JOIN main_companies c ON s.company_id = c.id
    LEFT JOIN main_tickets t ON t.site_id = s.id
    WHERE (
      p_query IS NULL
      OR p_query = ''
      OR s.name ILIKE '%' || v_safe_query || '%'
      OR s.address_detail ILIKE '%' || v_safe_query || '%'
      OR c.name_th ILIKE '%' || v_safe_query || '%'
      OR c.name_en ILIKE '%' || v_safe_query || '%'
    )
    AND (p_company_id IS NULL OR s.company_id = p_company_id)
    GROUP BY s.id, s.name, s.address_detail, s.company_id, s.is_main_branch, c.name_th, c.name_en
    HAVING (
      (p_min_ticket_count IS NULL OR COUNT(t.id) >= p_min_ticket_count)
      AND (p_max_ticket_count IS NULL OR COUNT(t.id) <= p_max_ticket_count)
    )
    ORDER BY s.name
    LIMIT p_limit
    OFFSET v_offset
  ) t;

  RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."search_sites_with_ticket_count"("p_query" "text", "p_company_id" "uuid", "p_min_ticket_count" integer, "p_max_ticket_count" integer, "p_page" integer, "p_limit" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."search_sites_with_ticket_count"("p_query" "text", "p_company_id" "uuid", "p_min_ticket_count" integer, "p_max_ticket_count" integer, "p_page" integer, "p_limit" integer) IS 'Search sites with ticket count filtering. Returns JSON with total and data array.';



CREATE OR REPLACE FUNCTION "public"."search_tickets"("p_page" integer DEFAULT 1, "p_limit" integer DEFAULT 20, "p_sort" "text" DEFAULT 'created_at'::"text", "p_order" "text" DEFAULT 'desc'::"text", "p_start_date" "date" DEFAULT NULL::"date", "p_end_date" "date" DEFAULT NULL::"date", "p_date_type" "text" DEFAULT 'appointed'::"text", "p_site_id" "uuid" DEFAULT NULL::"uuid", "p_status_id" "uuid" DEFAULT NULL::"uuid", "p_work_type_id" "uuid" DEFAULT NULL::"uuid", "p_assigner_id" "uuid" DEFAULT NULL::"uuid", "p_contact_id" "uuid" DEFAULT NULL::"uuid", "p_details" "text" DEFAULT NULL::"text", "p_exclude_backlog" boolean DEFAULT false, "p_only_backlog" boolean DEFAULT false, "p_employee_id" "uuid" DEFAULT NULL::"uuid", "p_department_id" "uuid" DEFAULT NULL::"uuid", "p_appointment_is_approved" boolean DEFAULT NULL::boolean) RETURNS TABLE("ticket_id" "uuid", "total_count" bigint)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_offset INTEGER;
BEGIN
  -- Calculate offset
  v_offset := (p_page - 1) * p_limit;

  RETURN QUERY
  WITH filtered_tickets AS (
    SELECT DISTINCT t.id, t.created_at, t.updated_at, a.appointment_date
    FROM main_tickets t
    LEFT JOIN main_appointments a ON t.appointment_id = a.id
    LEFT JOIN main_sites s ON t.site_id = s.id
    LEFT JOIN main_companies c ON s.company_id = c.id
    -- Use confirmed employees table
    LEFT JOIN jct_ticket_employees_cf jtec ON t.id = jtec.ticket_id
    LEFT JOIN main_employees e ON jtec.employee_id = e.id
    LEFT JOIN main_org_roles r ON e.role_id = r.id
    WHERE
      -- Date filter based on type
      (p_start_date IS NULL OR p_end_date IS NULL OR
        CASE p_date_type
          WHEN 'appointed' THEN a.appointment_date BETWEEN p_start_date AND p_end_date
          WHEN 'created' THEN t.created_at::date BETWEEN p_start_date AND p_end_date
          WHEN 'updated' THEN t.updated_at::date BETWEEN p_start_date AND p_end_date
          ELSE TRUE
        END
      )
      -- Entity filters
      AND (p_site_id IS NULL OR t.site_id = p_site_id)
      AND (p_status_id IS NULL OR t.status_id = p_status_id)
      AND (p_work_type_id IS NULL OR t.work_type_id = p_work_type_id)
      AND (p_assigner_id IS NULL OR t.assigner_id = p_assigner_id)
      AND (p_contact_id IS NULL OR t.contact_id = p_contact_id)
      -- Text search across multiple fields including ticket_code and ticket ID
      AND (p_details IS NULL OR (
        t.ticket_code ILIKE '%' || p_details || '%'
        OR t.id::text ILIKE '%' || p_details || '%'
        OR t.details ILIKE '%' || p_details || '%'
        OR s.name ILIKE '%' || p_details || '%'
        OR c.name_th ILIKE '%' || p_details || '%'
        OR c.name_en ILIKE '%' || p_details || '%'
      ))
      -- Backlog flags
      AND (NOT p_exclude_backlog OR t.appointment_id IS NOT NULL)
      AND (NOT p_only_backlog OR t.appointment_id IS NULL)
      -- Employee filter (uses confirmed employees)
      AND (p_employee_id IS NULL OR jtec.employee_id = p_employee_id)
      -- Department filter (via role)
      AND (p_department_id IS NULL OR r.department_id = p_department_id)
      -- Appointment approval filter
      AND (p_appointment_is_approved IS NULL OR a.is_approved = p_appointment_is_approved)
  ),
  counted AS (
    SELECT COUNT(DISTINCT id) AS cnt FROM filtered_tickets
  ),
  sorted_tickets AS (
    SELECT ft.id
    FROM filtered_tickets ft
    ORDER BY
      CASE WHEN p_order = 'asc' AND p_sort = 'created_at' THEN ft.created_at END ASC NULLS LAST,
      CASE WHEN p_order = 'asc' AND p_sort = 'updated_at' THEN ft.updated_at END ASC NULLS LAST,
      CASE WHEN p_order = 'asc' AND p_sort = 'appointment_date' THEN ft.appointment_date END ASC NULLS LAST,
      CASE WHEN p_order = 'desc' AND p_sort = 'created_at' THEN ft.created_at END DESC NULLS LAST,
      CASE WHEN p_order = 'desc' AND p_sort = 'updated_at' THEN ft.updated_at END DESC NULLS LAST,
      CASE WHEN p_order = 'desc' AND p_sort = 'appointment_date' THEN ft.appointment_date END DESC NULLS LAST,
      ft.created_at DESC NULLS LAST
    LIMIT p_limit
    OFFSET v_offset
  )
  SELECT
    st.id AS ticket_id,
    c.cnt AS total_count
  FROM sorted_tickets st
  CROSS JOIN counted c;
END;
$$;


ALTER FUNCTION "public"."search_tickets"("p_page" integer, "p_limit" integer, "p_sort" "text", "p_order" "text", "p_start_date" "date", "p_end_date" "date", "p_date_type" "text", "p_site_id" "uuid", "p_status_id" "uuid", "p_work_type_id" "uuid", "p_assigner_id" "uuid", "p_contact_id" "uuid", "p_details" "text", "p_exclude_backlog" boolean, "p_only_backlog" boolean, "p_employee_id" "uuid", "p_department_id" "uuid", "p_appointment_is_approved" boolean) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."search_tickets"("p_page" integer, "p_limit" integer, "p_sort" "text", "p_order" "text", "p_start_date" "date", "p_end_date" "date", "p_date_type" "text", "p_site_id" "uuid", "p_status_id" "uuid", "p_work_type_id" "uuid", "p_assigner_id" "uuid", "p_contact_id" "uuid", "p_details" "text", "p_exclude_backlog" boolean, "p_only_backlog" boolean, "p_employee_id" "uuid", "p_department_id" "uuid", "p_appointment_is_approved" boolean) IS 'Comprehensive ticket search. Text search (p_details) searches: ticket_code, ticket ID, ticket details, site name, company names (Thai/English).';



CREATE OR REPLACE FUNCTION "public"."search_tickets_fast"("p_page" integer DEFAULT 1, "p_limit" integer DEFAULT 20, "p_sort" "text" DEFAULT 'created_at'::"text", "p_order" "text" DEFAULT 'desc'::"text", "p_start_date" "date" DEFAULT NULL::"date", "p_end_date" "date" DEFAULT NULL::"date", "p_date_type" "text" DEFAULT 'appointed'::"text", "p_site_id" "uuid" DEFAULT NULL::"uuid", "p_status_id" "uuid" DEFAULT NULL::"uuid", "p_work_type_id" "uuid" DEFAULT NULL::"uuid", "p_assigner_id" "uuid" DEFAULT NULL::"uuid", "p_contact_id" "uuid" DEFAULT NULL::"uuid", "p_details" "text" DEFAULT NULL::"text", "p_exclude_backlog" boolean DEFAULT false, "p_only_backlog" boolean DEFAULT false, "p_employee_id" "uuid" DEFAULT NULL::"uuid", "p_department_id" "uuid" DEFAULT NULL::"uuid", "p_appointment_is_approved" boolean DEFAULT NULL::boolean) RETURNS TABLE("id" "uuid", "ticket_code" "text", "ticket_number" integer, "details" "text", "details_summary" "text", "additional" "text", "created_at" timestamp with time zone, "updated_at" timestamp with time zone, "site_id" "uuid", "site_name" "text", "company_name" "text", "province_code" integer, "province_name" "text", "district_code" integer, "district_name" "text", "work_type_code" "text", "work_type_name" "text", "status_code" "text", "status_name" "text", "assigner_name" "text", "creator_name" "text", "appointment_id" "uuid", "appointment_date" "date", "appointment_time_start" time without time zone, "appointment_time_end" time without time zone, "appointment_type" "text", "appointment_is_approved" boolean, "work_giver_code" "text", "work_giver_name" "text", "employees" "jsonb", "cf_employees" "jsonb", "employee_count" bigint, "cf_employee_count" bigint, "total_count" bigint)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_offset INTEGER;
BEGIN
  v_offset := (p_page - 1) * p_limit;

  RETURN QUERY
  WITH
  -- Pre-aggregate employees per ticket
  emp_agg AS (
    SELECT
      jte.ticket_id,
      jsonb_agg(jsonb_build_object(
        'id', e.id,
        'name', e.name,
        'code', e.code,
        'is_key', jte.is_key_employee,
        'profile_image_url', e.profile_image_url
      )) as employees,
      COUNT(*) as cnt
    FROM jct_ticket_employees jte
    JOIN main_employees e ON jte.employee_id = e.id
    GROUP BY jte.ticket_id
  ),
  -- Pre-aggregate cf_employees per ticket
  cf_agg AS (
    SELECT
      jtc.ticket_id,
      jsonb_agg(jsonb_build_object(
        'id', e.id,
        'name', e.name,
        'code', e.code,
        'is_key', false,
        'profile_image_url', e.profile_image_url
      )) as cf_employees,
      COUNT(*) as cnt
    FROM jct_ticket_employees_cf jtc
    JOIN main_employees e ON jtc.employee_id = e.id
    GROUP BY jtc.ticket_id
  ),
  -- Filtered tickets
  filtered AS (
    SELECT DISTINCT ON (t.id)
      t.id as tid,
      t.created_at as t_created,
      t.updated_at as t_updated,
      a.appointment_date as a_date
    FROM main_tickets t
    LEFT JOIN main_appointments a ON t.appointment_id = a.id
    LEFT JOIN main_sites s ON t.site_id = s.id
    LEFT JOIN main_companies c ON s.company_id = c.id
    LEFT JOIN jct_ticket_employees_cf jtec ON t.id = jtec.ticket_id
    LEFT JOIN main_employees e ON jtec.employee_id = e.id
    LEFT JOIN main_org_roles r ON e.role_id = r.id
    WHERE
      (p_start_date IS NULL OR p_end_date IS NULL OR
        CASE p_date_type
          WHEN 'appointed' THEN a.appointment_date BETWEEN p_start_date AND p_end_date
          WHEN 'created' THEN t.created_at::date BETWEEN p_start_date AND p_end_date
          WHEN 'updated' THEN t.updated_at::date BETWEEN p_start_date AND p_end_date
          ELSE TRUE
        END
      )
      AND (p_site_id IS NULL OR t.site_id = p_site_id)
      AND (p_status_id IS NULL OR t.status_id = p_status_id)
      AND (p_work_type_id IS NULL OR t.work_type_id = p_work_type_id)
      AND (p_assigner_id IS NULL OR t.assigner_id = p_assigner_id)
      AND (p_contact_id IS NULL OR t.contact_id = p_contact_id)
      AND (p_details IS NULL OR (
        t.ticket_code ILIKE '%' || p_details || '%'
        OR t.id::text ILIKE '%' || p_details || '%'
        OR t.details ILIKE '%' || p_details || '%'
        OR s.name ILIKE '%' || p_details || '%'
        OR c.name_th ILIKE '%' || p_details || '%'
        OR c.name_en ILIKE '%' || p_details || '%'
      ))
      AND (NOT p_exclude_backlog OR t.appointment_id IS NOT NULL)
      AND (NOT p_only_backlog OR t.appointment_id IS NULL)
      AND (p_employee_id IS NULL OR jtec.employee_id = p_employee_id)
      AND (p_department_id IS NULL OR r.department_id = p_department_id)
      AND (p_appointment_is_approved IS NULL OR a.is_approved = p_appointment_is_approved)
    ORDER BY t.id
  ),
  total AS (
    SELECT COUNT(*) as cnt FROM filtered
  ),
  sorted AS (
    SELECT tid
    FROM filtered
    ORDER BY
      CASE WHEN p_order = 'desc' AND p_sort = 'created_at' THEN t_created END DESC NULLS LAST,
      CASE WHEN p_order = 'asc' AND p_sort = 'created_at' THEN t_created END ASC NULLS LAST,
      CASE WHEN p_order = 'desc' AND p_sort = 'updated_at' THEN t_updated END DESC NULLS LAST,
      CASE WHEN p_order = 'asc' AND p_sort = 'updated_at' THEN t_updated END ASC NULLS LAST,
      CASE WHEN p_order = 'desc' AND p_sort = 'appointment_date' THEN a_date END DESC NULLS LAST,
      CASE WHEN p_order = 'asc' AND p_sort = 'appointment_date' THEN a_date END ASC NULLS LAST,
      t_created DESC NULLS LAST
    LIMIT p_limit OFFSET v_offset
  )
  SELECT
    t.id,
    t.ticket_code::TEXT,
    t.ticket_number,
    t.details,
    t.details_summary,
    t.additional,
    t.created_at,
    t.updated_at,
    t.site_id,
    s.name::TEXT as site_name,
    COALESCE(c.name_th, c.name_en)::TEXT as company_name,
    s.province_code,
    prov.name_th::TEXT as province_name,
    s.district_code,
    dist.name_th::TEXT as district_name,
    wt.code::TEXT as work_type_code,
    wt.name::TEXT as work_type_name,
    st.code::TEXT as status_code,
    st.name::TEXT as status_name,
    ea.name::TEXT as assigner_name,
    ec.name::TEXT as creator_name,
    a.id as appointment_id,
    a.appointment_date,
    a.appointment_time_start,
    a.appointment_time_end,
    a.appointment_type::TEXT,
    a.is_approved as appointment_is_approved,
    wg.code::TEXT as work_giver_code,
    wg.name::TEXT as work_giver_name,
    COALESCE(emp.employees, '[]'::jsonb) as employees,
    COALESCE(cf.cf_employees, '[]'::jsonb) as cf_employees,
    COALESCE(emp.cnt, 0) as employee_count,
    COALESCE(cf.cnt, 0) as cf_employee_count,
    (SELECT cnt FROM total) as total_count
  FROM sorted
  JOIN main_tickets t ON t.id = sorted.tid
  LEFT JOIN main_sites s ON t.site_id = s.id
  LEFT JOIN main_companies c ON s.company_id = c.id
  LEFT JOIN ref_provinces prov ON s.province_code = prov.id
  LEFT JOIN ref_districts dist ON s.district_code = dist.id
  LEFT JOIN ref_ticket_work_types wt ON t.work_type_id = wt.id
  LEFT JOIN ref_ticket_statuses st ON t.status_id = st.id
  LEFT JOIN main_employees ea ON t.assigner_id = ea.id
  LEFT JOIN main_employees ec ON t.created_by = ec.id
  LEFT JOIN main_appointments a ON t.appointment_id = a.id
  LEFT JOIN child_ticket_work_givers twg ON t.id = twg.ticket_id
  LEFT JOIN ref_work_givers wg ON twg.work_giver_id = wg.id
  LEFT JOIN emp_agg emp ON t.id = emp.ticket_id
  LEFT JOIN cf_agg cf ON t.id = cf.ticket_id;
END;
$$;


ALTER FUNCTION "public"."search_tickets_fast"("p_page" integer, "p_limit" integer, "p_sort" "text", "p_order" "text", "p_start_date" "date", "p_end_date" "date", "p_date_type" "text", "p_site_id" "uuid", "p_status_id" "uuid", "p_work_type_id" "uuid", "p_assigner_id" "uuid", "p_contact_id" "uuid", "p_details" "text", "p_exclude_backlog" boolean, "p_only_backlog" boolean, "p_employee_id" "uuid", "p_department_id" "uuid", "p_appointment_is_approved" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_company_name"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
  IF NEW.name_th IS DISTINCT FROM OLD.name_th OR NEW.name_en IS DISTINCT FROM OLD.name_en THEN
    -- Update sites
    UPDATE public.main_sites
    SET company_name_th = NEW.name_th, company_name_en = NEW.name_en
    WHERE company_id = NEW.tax_id;

    -- Update tickets
    UPDATE public.main_tickets t
    SET company_name = COALESCE(NEW.name_th, NEW.name_en)
    FROM public.main_sites s
    WHERE t.site_id = s.id AND s.company_id = NEW.tax_id;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_company_name"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_employee_department"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
  IF NEW.role_id IS NOT NULL THEN
    SELECT department_id INTO NEW.department_id FROM public.main_org_roles WHERE id = NEW.role_id;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_employee_department"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_site_company_on_change"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
  -- Populate company names from companies table
  IF NEW.company_id IS NOT NULL THEN
    SELECT name_th, name_en INTO NEW.company_name_th, NEW.company_name_en
    FROM public.main_companies WHERE tax_id = NEW.company_id;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_site_company_on_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_ticket_appointment"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
  UPDATE public.main_tickets
  SET
    appointment_date = NEW.appointment_date,
    appointment_time_start = NEW.appointment_time_start,
    appointment_time_end = NEW.appointment_time_end,
    appointment_is_approved = NEW.is_approved,
    appointment_type = NEW.appointment_type
  WHERE appointment_id = NEW.id;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_ticket_appointment"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_ticket_denorm_on_change"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
  -- Populate site_name and company_name from site
  IF NEW.site_id IS NOT NULL AND (NEW.site_id IS DISTINCT FROM OLD.site_id OR NEW.site_name IS NULL) THEN
    SELECT s.name, COALESCE(c.name_th, c.name_en)
    INTO NEW.site_name, NEW.company_name
    FROM public.main_sites s
    LEFT JOIN public.main_companies c ON s.company_id = c.tax_id
    WHERE s.id = NEW.site_id;
  END IF;

  -- Populate appointment fields from appointment
  IF NEW.appointment_id IS NOT NULL AND (NEW.appointment_id IS DISTINCT FROM OLD.appointment_id OR NEW.appointment_date IS NULL) THEN
    SELECT appointment_date, appointment_time_start, appointment_time_end, is_approved, appointment_type
    INTO NEW.appointment_date, NEW.appointment_time_start, NEW.appointment_time_end, NEW.appointment_is_approved, NEW.appointment_type
    FROM public.main_appointments WHERE id = NEW.appointment_id;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_ticket_denorm_on_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_ticket_site"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
  IF NEW.name IS DISTINCT FROM OLD.name THEN
    UPDATE public.main_tickets SET site_name = NEW.name WHERE site_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_ticket_site"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."transfer_stock"("p_from_location_id" "uuid", "p_to_location_id" "uuid", "p_model_id" "uuid", "p_quantity" integer, "p_performed_by" "uuid", "p_notes" "text" DEFAULT NULL::"text") RETURNS TABLE("success" boolean, "message" "text", "from_remaining" integer, "to_new_quantity" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_from_stock_id UUID;
  v_to_stock_id UUID;
  v_from_quantity INTEGER;
  v_from_reserved INTEGER;
  v_to_quantity INTEGER;
  v_available INTEGER;
  v_transfer_id UUID;
BEGIN
  v_transfer_id := gen_random_uuid();

  SELECT id, quantity, reserved_quantity
  INTO v_from_stock_id, v_from_quantity, v_from_reserved
  FROM main_stock_items
  WHERE location_id = p_from_location_id AND model_id = p_model_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Source stock not found'::TEXT, 0, 0;
    RETURN;
  END IF;

  v_available := v_from_quantity - v_from_reserved;

  IF p_quantity > v_available THEN
    RETURN QUERY SELECT false, format('Insufficient stock at source (available: %s)', v_available)::TEXT, v_available, 0;
    RETURN;
  END IF;

  SELECT id, quantity INTO v_to_stock_id, v_to_quantity
  FROM main_stock_items
  WHERE location_id = p_to_location_id AND model_id = p_model_id
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO main_stock_items (location_id, model_id, quantity)
    VALUES (p_to_location_id, p_model_id, 0)
    RETURNING id, quantity INTO v_to_stock_id, v_to_quantity;
  END IF;

  UPDATE main_stock_items
  SET quantity = quantity - p_quantity, updated_at = NOW()
  WHERE id = v_from_stock_id;

  UPDATE main_stock_items
  SET quantity = quantity + p_quantity, updated_at = NOW()
  WHERE id = v_to_stock_id;

  INSERT INTO child_stock_movements (stock_item_id, movement_type, quantity, quantity_before, quantity_after, reference_id, reference_type, related_location_id, notes, performed_by)
  VALUES (v_from_stock_id, 'transfer_out', -p_quantity, v_from_quantity, v_from_quantity - p_quantity, v_transfer_id, 'transfer', p_to_location_id, p_notes, p_performed_by);

  INSERT INTO child_stock_movements (stock_item_id, movement_type, quantity, quantity_before, quantity_after, reference_id, reference_type, related_location_id, notes, performed_by)
  VALUES (v_to_stock_id, 'transfer_in', p_quantity, v_to_quantity, v_to_quantity + p_quantity, v_transfer_id, 'transfer', p_from_location_id, p_notes, p_performed_by);

  RETURN QUERY SELECT true, 'Transfer completed'::TEXT, (v_from_quantity - p_quantity), (v_to_quantity + p_quantity);
END;
$$;


ALTER FUNCTION "public"."transfer_stock"("p_from_location_id" "uuid", "p_to_location_id" "uuid", "p_model_id" "uuid", "p_quantity" integer, "p_performed_by" "uuid", "p_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_fleet_sync"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'net'
    AS $$
DECLARE
  project_url TEXT := 'https://ogzyihacqbasolfxymgo.supabase.co';
  service_key TEXT;
BEGIN
  -- Get the service role key from vault
  SELECT decrypted_secret INTO service_key
  FROM vault.decrypted_secrets
  WHERE name = 'service_role_key'
  LIMIT 1;

  -- Call the fleet sync edge function using pg_net
  PERFORM net.http_post(
    url := project_url || '/functions/v1/api-fleet-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(service_key, '')
    ),
    body := '{}'::jsonb
  );
END;
$$;


ALTER FUNCTION "public"."trigger_fleet_sync"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."trigger_fleet_sync"() IS 'Triggers fleet sync edge function to pull data from external GPS system';



CREATE OR REPLACE FUNCTION "public"."update_ai_session_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_ai_session_timestamp"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_ai_session_tokens"("p_session_id" "uuid", "p_input_tokens" integer, "p_output_tokens" integer) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  UPDATE main_ai_sessions
  SET
    total_input_tokens = total_input_tokens + p_input_tokens,
    total_output_tokens = total_output_tokens + p_output_tokens,
    message_count = message_count + 1,
    last_message_at = NOW()
  WHERE id = p_session_id;
END;
$$;


ALTER FUNCTION "public"."update_ai_session_tokens"("p_session_id" "uuid", "p_input_tokens" integer, "p_output_tokens" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."update_ai_session_tokens"("p_session_id" "uuid", "p_input_tokens" integer, "p_output_tokens" integer) IS 'Atomically update AI session token counts and message count';



CREATE OR REPLACE FUNCTION "public"."user_has_min_level"("min_level" integer) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  user_level INTEGER;
BEGIN
  SELECT r.level INTO user_level
  FROM public.main_employees e
  JOIN public.main_org_roles r ON e.role_id = r.id
  WHERE e.auth_user_id = auth.uid();

  IF user_level IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN user_level >= min_level;
END;
$$;


ALTER FUNCTION "public"."user_has_min_level"("min_level" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_ticket_merchandise_site"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
DECLARE
  ticket_site_id UUID;
  merchandise_site_id UUID;
BEGIN
  -- Get the site_id from the ticket
  SELECT site_id INTO ticket_site_id FROM public.main_tickets WHERE id = NEW.ticket_id;

  -- Get the site_id from the merchandise
  SELECT site_id INTO merchandise_site_id FROM public.main_merchandise WHERE id = NEW.merchandise_id;

  -- Validate that merchandise belongs to the same site as the ticket
  IF ticket_site_id IS NOT NULL AND merchandise_site_id IS NOT NULL AND ticket_site_id != merchandise_site_id THEN
    RAISE EXCEPTION 'Merchandise must belong to the same site as the ticket';
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."validate_ticket_merchandise_site"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."addon_achievement_goals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "action_type" "text" DEFAULT 'ticket_create'::"text" NOT NULL,
    "period_type" "text" NOT NULL,
    "target_count" integer NOT NULL,
    "reward_type" "text" DEFAULT 'drink_coupon'::"text" NOT NULL,
    "reward_description" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "addon_achievement_goals_period_type_check" CHECK (("period_type" = ANY (ARRAY['daily'::"text", 'weekly'::"text", 'monthly'::"text"]))),
    CONSTRAINT "addon_achievement_goals_target_count_check" CHECK (("target_count" > 0))
);


ALTER TABLE "public"."addon_achievement_goals" OWNER TO "postgres";


COMMENT ON TABLE "public"."addon_achievement_goals" IS 'Achievement goals - admin manages directly in DB';



COMMENT ON COLUMN "public"."addon_achievement_goals"."action_type" IS 'Type of action to track: ticket_create';



COMMENT ON COLUMN "public"."addon_achievement_goals"."period_type" IS 'Period for goal: daily, weekly, monthly';



COMMENT ON COLUMN "public"."addon_achievement_goals"."target_count" IS 'Number of actions required to complete goal';



CREATE TABLE IF NOT EXISTS "public"."addon_employee_achievements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "goal_id" "uuid" NOT NULL,
    "period_start" "date" NOT NULL,
    "period_end" "date" NOT NULL,
    "current_count" integer DEFAULT 0 NOT NULL,
    "status" "text" DEFAULT 'in_progress'::"text" NOT NULL,
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "addon_employee_achievements_status_check" CHECK (("status" = ANY (ARRAY['in_progress'::"text", 'completed'::"text"])))
);


ALTER TABLE "public"."addon_employee_achievements" OWNER TO "postgres";


COMMENT ON TABLE "public"."addon_employee_achievements" IS 'Employee achievement progress tracking';



COMMENT ON COLUMN "public"."addon_employee_achievements"."employee_id" IS 'References main_employees.id (no FK for loose coupling)';



CREATE TABLE IF NOT EXISTS "public"."addon_employee_coupons" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "achievement_id" "uuid",
    "coupon_type" "text" DEFAULT 'drink_coupon'::"text" NOT NULL,
    "coupon_description" "text",
    "status" "text" DEFAULT 'available'::"text" NOT NULL,
    "issued_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '30 days'::interval) NOT NULL,
    "redeemed_at" timestamp with time zone,
    "redeemed_by" "uuid",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "addon_employee_coupons_status_check" CHECK (("status" = ANY (ARRAY['available'::"text", 'redeemed'::"text", 'expired'::"text"])))
);


ALTER TABLE "public"."addon_employee_coupons" OWNER TO "postgres";


COMMENT ON TABLE "public"."addon_employee_coupons" IS 'Employee coupons earned from achievements';



COMMENT ON COLUMN "public"."addon_employee_coupons"."employee_id" IS 'References main_employees.id (no FK for loose coupling)';



COMMENT ON COLUMN "public"."addon_employee_coupons"."redeemed_by" IS 'Admin who approved redemption (set directly in DB)';



CREATE TABLE IF NOT EXISTS "public"."child_ai_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "sequence_number" integer NOT NULL,
    "role" "text" NOT NULL,
    "content" "text",
    "tool_calls" "jsonb",
    "tool_call_id" "text",
    "input_tokens" integer DEFAULT 0,
    "output_tokens" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "child_ai_messages_role_check" CHECK (("role" = ANY (ARRAY['user'::"text", 'assistant'::"text", 'system'::"text", 'tool'::"text"])))
);


ALTER TABLE "public"."child_ai_messages" OWNER TO "postgres";


COMMENT ON TABLE "public"."child_ai_messages" IS 'Stores complete AI conversation message history for each session';



CREATE TABLE IF NOT EXISTS "public"."child_announcement_files" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "announcement_id" "uuid" NOT NULL,
    "file_url" "text" NOT NULL,
    "file_name" "text" NOT NULL,
    "file_size" integer,
    "mime_type" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."child_announcement_files" OWNER TO "postgres";


COMMENT ON TABLE "public"."child_announcement_files" IS 'Child of main_announcements: File attachments';



COMMENT ON COLUMN "public"."child_announcement_files"."file_url" IS 'URL to the file in storage';



COMMENT ON COLUMN "public"."child_announcement_files"."file_name" IS 'Original filename';



COMMENT ON COLUMN "public"."child_announcement_files"."file_size" IS 'File size in bytes';



COMMENT ON COLUMN "public"."child_announcement_files"."mime_type" IS 'MIME type of the file';



CREATE TABLE IF NOT EXISTS "public"."child_announcement_photos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "announcement_id" "uuid" NOT NULL,
    "image_url" "text" NOT NULL,
    "display_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."child_announcement_photos" OWNER TO "postgres";


COMMENT ON TABLE "public"."child_announcement_photos" IS 'Child of main_announcements: Photo attachments';



COMMENT ON COLUMN "public"."child_announcement_photos"."image_url" IS 'URL to the photo in storage';



COMMENT ON COLUMN "public"."child_announcement_photos"."display_order" IS 'Display order for photos';



CREATE TABLE IF NOT EXISTS "public"."child_comment_files" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "comment_id" "uuid" NOT NULL,
    "file_url" "text" NOT NULL,
    "file_name" "text" NOT NULL,
    "file_size" integer,
    "mime_type" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."child_comment_files" OWNER TO "postgres";


COMMENT ON TABLE "public"."child_comment_files" IS 'Child of child_ticket_comments: File attachments for comments';



COMMENT ON COLUMN "public"."child_comment_files"."file_url" IS 'URL to the file in storage';



COMMENT ON COLUMN "public"."child_comment_files"."file_name" IS 'Original filename';



COMMENT ON COLUMN "public"."child_comment_files"."file_size" IS 'File size in bytes';



COMMENT ON COLUMN "public"."child_comment_files"."mime_type" IS 'MIME type of the file';



CREATE TABLE IF NOT EXISTS "public"."child_comment_photos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "comment_id" "uuid" NOT NULL,
    "image_url" "text" NOT NULL,
    "display_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."child_comment_photos" OWNER TO "postgres";


COMMENT ON TABLE "public"."child_comment_photos" IS 'Child of child_ticket_comments: Photo attachments for comments';



COMMENT ON COLUMN "public"."child_comment_photos"."image_url" IS 'URL to the photo in storage';



COMMENT ON COLUMN "public"."child_comment_photos"."display_order" IS 'Display order for photos';



CREATE TABLE IF NOT EXISTS "public"."child_company_comment_files" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "comment_id" "uuid" NOT NULL,
    "file_url" "text" NOT NULL,
    "file_name" "text" NOT NULL,
    "file_size" integer,
    "mime_type" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."child_company_comment_files" OWNER TO "postgres";


COMMENT ON TABLE "public"."child_company_comment_files" IS 'Child of child_company_comments: File attachments for comments';



COMMENT ON COLUMN "public"."child_company_comment_files"."file_url" IS 'URL to the file in storage';



COMMENT ON COLUMN "public"."child_company_comment_files"."file_name" IS 'Original filename';



COMMENT ON COLUMN "public"."child_company_comment_files"."file_size" IS 'File size in bytes';



COMMENT ON COLUMN "public"."child_company_comment_files"."mime_type" IS 'MIME type of the file';



CREATE TABLE IF NOT EXISTS "public"."child_company_comment_photos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "comment_id" "uuid" NOT NULL,
    "image_url" "text" NOT NULL,
    "display_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."child_company_comment_photos" OWNER TO "postgres";


COMMENT ON TABLE "public"."child_company_comment_photos" IS 'Child of child_company_comments: Photo attachments for comments';



COMMENT ON COLUMN "public"."child_company_comment_photos"."image_url" IS 'URL to the photo in storage';



COMMENT ON COLUMN "public"."child_company_comment_photos"."display_order" IS 'Display order for photos';



CREATE TABLE IF NOT EXISTS "public"."child_company_comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "author_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "mentioned_employee_ids" "uuid"[] DEFAULT '{}'::"uuid"[],
    "is_edited" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."child_company_comments" OWNER TO "postgres";


COMMENT ON TABLE "public"."child_company_comments" IS 'Child of main_companies: Comments on companies with @mention support';



COMMENT ON COLUMN "public"."child_company_comments"."id" IS 'Primary key';



COMMENT ON COLUMN "public"."child_company_comments"."company_id" IS 'FK to main_companies';



COMMENT ON COLUMN "public"."child_company_comments"."author_id" IS 'FK to main_employees - who wrote the comment';



COMMENT ON COLUMN "public"."child_company_comments"."content" IS 'Comment text content (may contain @mentions in format @[employee_id])';



COMMENT ON COLUMN "public"."child_company_comments"."mentioned_employee_ids" IS 'Array of employee IDs mentioned in this comment';



COMMENT ON COLUMN "public"."child_company_comments"."is_edited" IS 'Whether this comment has been edited';



COMMENT ON COLUMN "public"."child_company_comments"."created_at" IS 'Created timestamp';



COMMENT ON COLUMN "public"."child_company_comments"."updated_at" IS 'Updated timestamp';



CREATE TABLE IF NOT EXISTS "public"."child_employee_leave_balances" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "leave_type_id" "uuid" NOT NULL,
    "year" integer NOT NULL,
    "total_days" numeric DEFAULT 0 NOT NULL,
    "used_days" numeric DEFAULT 0 NOT NULL,
    "remaining_days" numeric GENERATED ALWAYS AS (("total_days" - "used_days")) STORED,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."child_employee_leave_balances" OWNER TO "postgres";


COMMENT ON TABLE "public"."child_employee_leave_balances" IS 'Child of main_employees: Leave balance per year';



CREATE TABLE IF NOT EXISTS "public"."child_employee_leave_requests" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "leave_type_id" "uuid" NOT NULL,
    "start_date" "date" NOT NULL,
    "end_date" "date" NOT NULL,
    "total_days" numeric NOT NULL,
    "reason" "text",
    "status" character varying DEFAULT 'pending'::character varying NOT NULL,
    "approved_by" "uuid",
    "approved_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "half_day_type" "public"."half_day_type_enum"
);


ALTER TABLE "public"."child_employee_leave_requests" OWNER TO "postgres";


COMMENT ON TABLE "public"."child_employee_leave_requests" IS 'Child of main_employees: Leave requests';



COMMENT ON COLUMN "public"."child_employee_leave_requests"."half_day_type" IS 'Type of half-day leave: morning or afternoon. NULL means full day.';



CREATE TABLE IF NOT EXISTS "public"."child_employee_line_accounts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "line_user_id" "text" NOT NULL,
    "display_name" "text",
    "profile_picture_url" "text",
    "linked_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "active_ticket_id" "uuid"
);


ALTER TABLE "public"."child_employee_line_accounts" OWNER TO "postgres";


COMMENT ON TABLE "public"."child_employee_line_accounts" IS 'Child of main_employees: Maps LINE user IDs to employees for n8n integration';



COMMENT ON COLUMN "public"."child_employee_line_accounts"."id" IS 'Primary key';



COMMENT ON COLUMN "public"."child_employee_line_accounts"."employee_id" IS 'FK to main_employees (unique - one LINE account per employee)';



COMMENT ON COLUMN "public"."child_employee_line_accounts"."line_user_id" IS 'LINE user ID (unique - one employee per LINE account)';



COMMENT ON COLUMN "public"."child_employee_line_accounts"."display_name" IS 'LINE display name for reference';



COMMENT ON COLUMN "public"."child_employee_line_accounts"."profile_picture_url" IS 'LINE profile picture URL';



COMMENT ON COLUMN "public"."child_employee_line_accounts"."linked_at" IS 'When the LINE account was linked';



COMMENT ON COLUMN "public"."child_employee_line_accounts"."created_at" IS 'Created timestamp';



COMMENT ON COLUMN "public"."child_employee_line_accounts"."updated_at" IS 'Updated timestamp';



COMMENT ON COLUMN "public"."child_employee_line_accounts"."active_ticket_id" IS 'Active ticket for technician submit work flow - files uploaded auto-link to this ticket';



CREATE TABLE IF NOT EXISTS "public"."child_merchandise_location" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "merchandise_id" "uuid" NOT NULL,
    "building" "text",
    "floor" "text",
    "room" "text",
    "zone" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."child_merchandise_location" OWNER TO "postgres";


COMMENT ON TABLE "public"."child_merchandise_location" IS 'Child of main_merchandise: Tracks specific location within a site (building, floor, room, zone)';



COMMENT ON COLUMN "public"."child_merchandise_location"."id" IS 'Primary key';



COMMENT ON COLUMN "public"."child_merchandise_location"."merchandise_id" IS 'FK to main_merchandise';



COMMENT ON COLUMN "public"."child_merchandise_location"."building" IS 'Building name or number';



COMMENT ON COLUMN "public"."child_merchandise_location"."floor" IS 'Floor number or name';



COMMENT ON COLUMN "public"."child_merchandise_location"."room" IS 'Room number or name';



COMMENT ON COLUMN "public"."child_merchandise_location"."zone" IS 'Zone or area within the room/floor';



COMMENT ON COLUMN "public"."child_merchandise_location"."notes" IS 'Additional location notes or directions';



COMMENT ON COLUMN "public"."child_merchandise_location"."created_at" IS 'Created timestamp';



COMMENT ON COLUMN "public"."child_merchandise_location"."updated_at" IS 'Updated timestamp';



CREATE TABLE IF NOT EXISTS "public"."child_site_comment_files" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "comment_id" "uuid" NOT NULL,
    "file_url" "text" NOT NULL,
    "file_name" "text" NOT NULL,
    "file_size" integer,
    "mime_type" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."child_site_comment_files" OWNER TO "postgres";


COMMENT ON TABLE "public"."child_site_comment_files" IS 'Child of child_site_comments: File attachments for comments';



COMMENT ON COLUMN "public"."child_site_comment_files"."file_url" IS 'URL to the file in storage';



COMMENT ON COLUMN "public"."child_site_comment_files"."file_name" IS 'Original filename';



COMMENT ON COLUMN "public"."child_site_comment_files"."file_size" IS 'File size in bytes';



COMMENT ON COLUMN "public"."child_site_comment_files"."mime_type" IS 'MIME type of the file';



CREATE TABLE IF NOT EXISTS "public"."child_site_comment_photos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "comment_id" "uuid" NOT NULL,
    "image_url" "text" NOT NULL,
    "display_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."child_site_comment_photos" OWNER TO "postgres";


COMMENT ON TABLE "public"."child_site_comment_photos" IS 'Child of child_site_comments: Photo attachments for comments';



COMMENT ON COLUMN "public"."child_site_comment_photos"."image_url" IS 'URL to the photo in storage';



COMMENT ON COLUMN "public"."child_site_comment_photos"."display_order" IS 'Display order for photos';



CREATE TABLE IF NOT EXISTS "public"."child_site_comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "site_id" "uuid" NOT NULL,
    "author_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "mentioned_employee_ids" "uuid"[] DEFAULT '{}'::"uuid"[],
    "is_edited" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."child_site_comments" OWNER TO "postgres";


COMMENT ON TABLE "public"."child_site_comments" IS 'Child of main_sites: Comments on sites with @mention support';



COMMENT ON COLUMN "public"."child_site_comments"."id" IS 'Primary key';



COMMENT ON COLUMN "public"."child_site_comments"."site_id" IS 'FK to main_sites';



COMMENT ON COLUMN "public"."child_site_comments"."author_id" IS 'FK to main_employees - who wrote the comment';



COMMENT ON COLUMN "public"."child_site_comments"."content" IS 'Comment text content (may contain @mentions in format @[employee_id])';



COMMENT ON COLUMN "public"."child_site_comments"."mentioned_employee_ids" IS 'Array of employee IDs mentioned in this comment';



COMMENT ON COLUMN "public"."child_site_comments"."is_edited" IS 'Whether this comment has been edited';



COMMENT ON COLUMN "public"."child_site_comments"."created_at" IS 'Created timestamp';



COMMENT ON COLUMN "public"."child_site_comments"."updated_at" IS 'Updated timestamp';



CREATE TABLE IF NOT EXISTS "public"."child_site_contacts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "site_id" "uuid",
    "person_name" character varying NOT NULL,
    "nickname" character varying,
    "phone" "text"[],
    "email" "text"[],
    "line_id" character varying,
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."child_site_contacts" OWNER TO "postgres";


COMMENT ON TABLE "public"."child_site_contacts" IS 'Child of main_sites: Contact persons at sites';



CREATE TABLE IF NOT EXISTS "public"."child_stock_movements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "stock_item_id" "uuid" NOT NULL,
    "movement_type" "public"."stock_movement_type" NOT NULL,
    "quantity" integer NOT NULL,
    "quantity_before" integer NOT NULL,
    "quantity_after" integer NOT NULL,
    "reference_id" "uuid",
    "reference_type" character varying(50),
    "related_location_id" "uuid",
    "notes" "text",
    "performed_by" "uuid" NOT NULL,
    "performed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."child_stock_movements" OWNER TO "postgres";


COMMENT ON TABLE "public"."child_stock_movements" IS 'Stock movement history and audit trail';



CREATE TABLE IF NOT EXISTS "public"."child_stock_serial_movements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "serial_item_id" "uuid" NOT NULL,
    "movement_type" "public"."stock_serial_movement_type" NOT NULL,
    "from_location_id" "uuid",
    "to_location_id" "uuid",
    "from_status" "public"."stock_serial_status",
    "to_status" "public"."stock_serial_status" NOT NULL,
    "ticket_id" "uuid",
    "performed_by" "uuid" NOT NULL,
    "performed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."child_stock_serial_movements" OWNER TO "postgres";


COMMENT ON TABLE "public"."child_stock_serial_movements" IS 'Complete audit trail for serialized item movements';



COMMENT ON COLUMN "public"."child_stock_serial_movements"."movement_type" IS 'Type of movement: receive, transfer, deploy, return, etc.';



COMMENT ON COLUMN "public"."child_stock_serial_movements"."from_location_id" IS 'Source location (null for receive)';



COMMENT ON COLUMN "public"."child_stock_serial_movements"."to_location_id" IS 'Destination location (null for deploy/scrap)';



CREATE TABLE IF NOT EXISTS "public"."child_ticket_audit" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ticket_id" "uuid",
    "action" character varying NOT NULL,
    "changed_by" "uuid" NOT NULL,
    "old_values" "jsonb",
    "new_values" "jsonb",
    "changed_fields" "text"[],
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ticket_audit_action_check" CHECK ((("action")::"text" = ANY ((ARRAY['created'::character varying, 'updated'::character varying, 'deleted'::character varying, 'approved'::character varying, 'unapproved'::character varying, 'technician_confirmed'::character varying, 'technician_unconfirmed'::character varying, 'technician_changed'::character varying, 'employee_assigned'::character varying, 'employee_removed'::character varying, 'work_giver_set'::character varying, 'work_giver_changed'::character varying, 'comment_added'::character varying])::"text"[])))
);


ALTER TABLE "public"."child_ticket_audit" OWNER TO "postgres";


COMMENT ON TABLE "public"."child_ticket_audit" IS 'Child of main_tickets: Audit trail for tickets';



COMMENT ON COLUMN "public"."child_ticket_audit"."ticket_id" IS 'ID of the ticket being audited (NULL if ticket was deleted - audit preserved for history)';



COMMENT ON COLUMN "public"."child_ticket_audit"."action" IS 'Action performed: created, updated, or deleted';



COMMENT ON COLUMN "public"."child_ticket_audit"."changed_by" IS 'Employee ID who performed the action';



COMMENT ON COLUMN "public"."child_ticket_audit"."old_values" IS 'Previous values of changed fields (JSONB object)';



COMMENT ON COLUMN "public"."child_ticket_audit"."new_values" IS 'New values of changed fields (JSONB object)';



COMMENT ON COLUMN "public"."child_ticket_audit"."changed_fields" IS 'Array of field names that were changed (for updates)';



COMMENT ON COLUMN "public"."child_ticket_audit"."metadata" IS 'Additional metadata about the change (e.g., related entity changes, IP address, user agent)';



CREATE TABLE IF NOT EXISTS "public"."child_ticket_comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ticket_id" "uuid" NOT NULL,
    "author_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "mentioned_employee_ids" "uuid"[] DEFAULT '{}'::"uuid"[],
    "is_edited" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."child_ticket_comments" OWNER TO "postgres";


COMMENT ON TABLE "public"."child_ticket_comments" IS 'Child of main_tickets: Comments on tickets with @mention support';



COMMENT ON COLUMN "public"."child_ticket_comments"."id" IS 'Primary key';



COMMENT ON COLUMN "public"."child_ticket_comments"."ticket_id" IS 'FK to main_tickets';



COMMENT ON COLUMN "public"."child_ticket_comments"."author_id" IS 'FK to main_employees - who wrote the comment';



COMMENT ON COLUMN "public"."child_ticket_comments"."content" IS 'Comment text content (may contain @mentions in format @[employee_id])';



COMMENT ON COLUMN "public"."child_ticket_comments"."mentioned_employee_ids" IS 'Array of employee IDs mentioned in this comment';



COMMENT ON COLUMN "public"."child_ticket_comments"."is_edited" IS 'Whether this comment has been edited';



COMMENT ON COLUMN "public"."child_ticket_comments"."created_at" IS 'Created timestamp';



COMMENT ON COLUMN "public"."child_ticket_comments"."updated_at" IS 'Updated timestamp';



CREATE TABLE IF NOT EXISTS "public"."child_ticket_extra_fields" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ticket_id" "uuid" NOT NULL,
    "field_key" character varying(100) NOT NULL,
    "field_value" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."child_ticket_extra_fields" OWNER TO "postgres";


COMMENT ON TABLE "public"."child_ticket_extra_fields" IS 'Child: Custom key-value extra fields for tickets';



CREATE TABLE IF NOT EXISTS "public"."child_ticket_files" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ticket_id" "uuid" NOT NULL,
    "uploaded_by" "uuid" NOT NULL,
    "file_url" "text" NOT NULL,
    "file_name" "text" NOT NULL,
    "file_size" integer,
    "mime_type" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."child_ticket_files" OWNER TO "postgres";


COMMENT ON TABLE "public"."child_ticket_files" IS 'File attachments for tickets';



CREATE TABLE IF NOT EXISTS "public"."child_ticket_photos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ticket_id" "uuid" NOT NULL,
    "uploaded_by" "uuid" NOT NULL,
    "image_url" "text" NOT NULL,
    "caption" "text",
    "display_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."child_ticket_photos" OWNER TO "postgres";


COMMENT ON TABLE "public"."child_ticket_photos" IS 'Photo attachments for tickets';



CREATE TABLE IF NOT EXISTS "public"."child_ticket_ratings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ticket_id" "uuid" NOT NULL,
    "rated_by_employee_id" "uuid" NOT NULL,
    "service_quality_rating" smallint NOT NULL,
    "response_time_rating" smallint NOT NULL,
    "professionalism_rating" smallint NOT NULL,
    "customer_comment" "text",
    "call_notes" "text",
    "rated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "child_ticket_ratings_professionalism_rating_check" CHECK ((("professionalism_rating" >= 1) AND ("professionalism_rating" <= 5))),
    CONSTRAINT "child_ticket_ratings_response_time_rating_check" CHECK ((("response_time_rating" >= 1) AND ("response_time_rating" <= 5))),
    CONSTRAINT "child_ticket_ratings_service_quality_rating_check" CHECK ((("service_quality_rating" >= 1) AND ("service_quality_rating" <= 5)))
);


ALTER TABLE "public"."child_ticket_ratings" OWNER TO "postgres";


COMMENT ON TABLE "public"."child_ticket_ratings" IS 'Customer ratings collected by employees via phone call at ticket completion';



COMMENT ON COLUMN "public"."child_ticket_ratings"."service_quality_rating" IS 'Rating for overall service quality (1-5)';



COMMENT ON COLUMN "public"."child_ticket_ratings"."response_time_rating" IS 'Rating for response time (1-5)';



COMMENT ON COLUMN "public"."child_ticket_ratings"."professionalism_rating" IS 'Rating for technician professionalism (1-5)';



COMMENT ON COLUMN "public"."child_ticket_ratings"."customer_comment" IS 'Optional feedback from customer';



COMMENT ON COLUMN "public"."child_ticket_ratings"."call_notes" IS 'Internal notes from employee who made the call';



CREATE TABLE IF NOT EXISTS "public"."child_ticket_work_estimates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ticket_id" "uuid" NOT NULL,
    "estimated_minutes" integer DEFAULT 60 NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    CONSTRAINT "child_ticket_work_estimates_estimated_minutes_check" CHECK ((("estimated_minutes" > 0) AND ("estimated_minutes" <= 480)))
);


ALTER TABLE "public"."child_ticket_work_estimates" OWNER TO "postgres";


COMMENT ON TABLE "public"."child_ticket_work_estimates" IS 'Stores estimated work duration for tickets, used in route optimization calculations';



COMMENT ON COLUMN "public"."child_ticket_work_estimates"."estimated_minutes" IS 'Estimated work duration in minutes (1-480)';



CREATE TABLE IF NOT EXISTS "public"."child_ticket_work_givers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ticket_id" "uuid" NOT NULL,
    "work_giver_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."child_ticket_work_givers" OWNER TO "postgres";


COMMENT ON TABLE "public"."child_ticket_work_givers" IS 'Child of main_tickets: Work giver assignment for tickets (1:1 relationship)';



COMMENT ON COLUMN "public"."child_ticket_work_givers"."id" IS 'Primary key';



COMMENT ON COLUMN "public"."child_ticket_work_givers"."ticket_id" IS 'FK → main_tickets (unique - one work giver per ticket)';



COMMENT ON COLUMN "public"."child_ticket_work_givers"."work_giver_id" IS 'FK → ref_work_givers';



COMMENT ON COLUMN "public"."child_ticket_work_givers"."created_at" IS 'Created timestamp';



COMMENT ON COLUMN "public"."child_ticket_work_givers"."updated_at" IS 'Updated timestamp';



CREATE TABLE IF NOT EXISTS "public"."fleet_garages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "latitude" double precision NOT NULL,
    "longitude" double precision NOT NULL,
    "radius_meters" integer DEFAULT 100 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."fleet_garages" OWNER TO "postgres";


COMMENT ON TABLE "public"."fleet_garages" IS 'Garage/base locations for fleet vehicles';



COMMENT ON COLUMN "public"."fleet_garages"."radius_meters" IS 'Detection radius - vehicle within this distance is considered parked at base';



CREATE TABLE IF NOT EXISTS "public"."fleet_vehicle_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "vehicle_id" "text" NOT NULL,
    "latitude" double precision NOT NULL,
    "longitude" double precision NOT NULL,
    "speed" double precision DEFAULT 0 NOT NULL,
    "heading" integer DEFAULT 0 NOT NULL,
    "status" "public"."vehicle_status" NOT NULL,
    "address" "text",
    "garage_id" "uuid",
    "recorded_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."fleet_vehicle_history" OWNER TO "postgres";


COMMENT ON TABLE "public"."fleet_vehicle_history" IS 'Historical tracking data for vehicles';



CREATE TABLE IF NOT EXISTS "public"."fleet_vehicles" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "plate_number" "text",
    "driver_name" "text",
    "status" "public"."vehicle_status" DEFAULT 'stopped'::"public"."vehicle_status" NOT NULL,
    "latitude" double precision NOT NULL,
    "longitude" double precision NOT NULL,
    "speed" double precision DEFAULT 0 NOT NULL,
    "heading" integer DEFAULT 0 NOT NULL,
    "signal_strength" integer DEFAULT 0 NOT NULL,
    "address" "text",
    "current_garage_id" "uuid",
    "last_sync_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "driver_name_override" "text",
    "plate_number_override" "text"
);


ALTER TABLE "public"."fleet_vehicles" OWNER TO "postgres";


COMMENT ON TABLE "public"."fleet_vehicles" IS 'Real-time vehicle tracking data synced from external GPS system';



COMMENT ON COLUMN "public"."fleet_vehicles"."current_garage_id" IS 'Garage where vehicle is currently parked (NULL if not at any garage)';



COMMENT ON COLUMN "public"."fleet_vehicles"."driver_name_override" IS 'Manually set driver name that overrides the one from GPS system';



COMMENT ON COLUMN "public"."fleet_vehicles"."plate_number_override" IS 'Manually set plate number that overrides the one from GPS system';



CREATE TABLE IF NOT EXISTS "public"."jct_appointment_approvers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."jct_appointment_approvers" OWNER TO "postgres";


COMMENT ON TABLE "public"."jct_appointment_approvers" IS 'Junction: Appointment approval permissions';



COMMENT ON COLUMN "public"."jct_appointment_approvers"."employee_id" IS 'Reference to the employee that can approve appointments';



COMMENT ON COLUMN "public"."jct_appointment_approvers"."created_at" IS 'Timestamp when this user was granted approval permission';



COMMENT ON COLUMN "public"."jct_appointment_approvers"."updated_at" IS 'Timestamp when this record was last updated';



CREATE TABLE IF NOT EXISTS "public"."jct_fleet_vehicle_employees" (
    "vehicle_id" "text" NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."jct_fleet_vehicle_employees" OWNER TO "postgres";


COMMENT ON TABLE "public"."jct_fleet_vehicle_employees" IS 'พนักงานที่ประจำรถแต่ละคัน (หลายคนต่อรถได้)';



CREATE TABLE IF NOT EXISTS "public"."jct_model_components" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "model_id" "uuid" NOT NULL,
    "component_model_id" "uuid" NOT NULL,
    "quantity" integer DEFAULT 1 NOT NULL,
    "note" "text",
    "display_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."jct_model_components" OWNER TO "postgres";


COMMENT ON TABLE "public"."jct_model_components" IS 'Junction table linking parent models to their component models';



COMMENT ON COLUMN "public"."jct_model_components"."model_id" IS 'The parent model (e.g., UPS system)';



COMMENT ON COLUMN "public"."jct_model_components"."component_model_id" IS 'The component model (e.g., battery, accessory)';



COMMENT ON COLUMN "public"."jct_model_components"."quantity" IS 'Quantity of this item included in the package';



COMMENT ON COLUMN "public"."jct_model_components"."note" IS 'Additional notes for this item in the package';



COMMENT ON COLUMN "public"."jct_model_components"."display_order" IS 'Display order for UI sorting';



CREATE TABLE IF NOT EXISTS "public"."jct_model_package_services" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "model_id" "uuid" NOT NULL,
    "service_id" "uuid" NOT NULL,
    "terms" "text",
    "note" "text",
    "display_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."jct_model_package_services" OWNER TO "postgres";


COMMENT ON TABLE "public"."jct_model_package_services" IS 'Junction: Models <-> Package services';



COMMENT ON COLUMN "public"."jct_model_package_services"."model_id" IS 'Reference to the model';



COMMENT ON COLUMN "public"."jct_model_package_services"."service_id" IS 'Reference to the package service';



COMMENT ON COLUMN "public"."jct_model_package_services"."terms" IS 'Service terms and conditions specific to this model';



COMMENT ON COLUMN "public"."jct_model_package_services"."note" IS 'Additional notes for this service in the package';



COMMENT ON COLUMN "public"."jct_model_package_services"."display_order" IS 'Display order for UI sorting';



CREATE TABLE IF NOT EXISTS "public"."jct_site_employee_trainings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "site_id" "uuid" NOT NULL,
    "trained_at" "date" DEFAULT CURRENT_DATE NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."jct_site_employee_trainings" OWNER TO "postgres";


COMMENT ON TABLE "public"."jct_site_employee_trainings" IS 'Junction: Sites <-> Employees training';



COMMENT ON COLUMN "public"."jct_site_employee_trainings"."employee_id" IS 'Reference to the trained employee';



COMMENT ON COLUMN "public"."jct_site_employee_trainings"."site_id" IS 'Reference to the site where the employee is trained';



COMMENT ON COLUMN "public"."jct_site_employee_trainings"."trained_at" IS 'Date the employee completed training for the site';



COMMENT ON COLUMN "public"."jct_site_employee_trainings"."created_at" IS 'Timestamp when the training record was created';



CREATE TABLE IF NOT EXISTS "public"."jct_ticket_employees" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ticket_id" "uuid" NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "date" "date" NOT NULL,
    "is_key_employee" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."jct_ticket_employees" OWNER TO "postgres";


COMMENT ON TABLE "public"."jct_ticket_employees" IS 'Junction: Tickets <-> Employees assignment';



COMMENT ON COLUMN "public"."jct_ticket_employees"."date" IS 'Date of assignment - used with employee_id and ticket_id for unique constraint';



COMMENT ON COLUMN "public"."jct_ticket_employees"."is_key_employee" IS 'Whether this employee is a key employee for this ticket assignment';



CREATE TABLE IF NOT EXISTS "public"."jct_ticket_employees_cf" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ticket_id" "uuid" NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "confirmed_by" "uuid" NOT NULL,
    "confirmed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "date" "date" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."jct_ticket_employees_cf" OWNER TO "postgres";


COMMENT ON TABLE "public"."jct_ticket_employees_cf" IS 'Junction table for confirmed technicians on tickets. Tracks which technicians are confirmed to work on approved tickets.';



COMMENT ON COLUMN "public"."jct_ticket_employees_cf"."ticket_id" IS 'Reference to the ticket';



COMMENT ON COLUMN "public"."jct_ticket_employees_cf"."employee_id" IS 'Reference to the confirmed technician';



COMMENT ON COLUMN "public"."jct_ticket_employees_cf"."confirmed_by" IS 'Employee who confirmed this technician';



COMMENT ON COLUMN "public"."jct_ticket_employees_cf"."confirmed_at" IS 'Timestamp when confirmation was made';



COMMENT ON COLUMN "public"."jct_ticket_employees_cf"."date" IS 'Appointment date for this confirmation (used for unique constraint)';



COMMENT ON COLUMN "public"."jct_ticket_employees_cf"."notes" IS 'Optional notes about this confirmation';



CREATE TABLE IF NOT EXISTS "public"."jct_ticket_merchandise" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ticket_id" "uuid" NOT NULL,
    "merchandise_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."jct_ticket_merchandise" OWNER TO "postgres";


COMMENT ON TABLE "public"."jct_ticket_merchandise" IS 'Junction: Tickets <-> Merchandise';



COMMENT ON COLUMN "public"."jct_ticket_merchandise"."ticket_id" IS 'Reference to the ticket';



COMMENT ON COLUMN "public"."jct_ticket_merchandise"."merchandise_id" IS 'Reference to the merchandise';



CREATE TABLE IF NOT EXISTS "public"."jct_ticket_stock_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ticket_id" "uuid" NOT NULL,
    "stock_item_id" "uuid" NOT NULL,
    "model_id" "uuid" NOT NULL,
    "quantity" integer NOT NULL,
    "status" character varying(20) DEFAULT 'consumed'::character varying NOT NULL,
    "consumed_by" "uuid" NOT NULL,
    "consumed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "chk_quantity_positive" CHECK (("quantity" > 0)),
    CONSTRAINT "chk_status_valid" CHECK ((("status")::"text" = ANY ((ARRAY['reserved'::character varying, 'consumed'::character varying, 'returned'::character varying])::"text"[])))
);


ALTER TABLE "public"."jct_ticket_stock_items" OWNER TO "postgres";


COMMENT ON TABLE "public"."jct_ticket_stock_items" IS 'Junction table linking tickets to consumed stock items';



CREATE TABLE IF NOT EXISTS "public"."jct_ticket_watchers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ticket_id" "uuid" NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "added_by" "uuid",
    "source" "public"."watcher_source" DEFAULT 'manual'::"public"."watcher_source" NOT NULL,
    "added_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."jct_ticket_watchers" OWNER TO "postgres";


COMMENT ON TABLE "public"."jct_ticket_watchers" IS 'Junction: Tickets <-> Employee watchers for notifications';



COMMENT ON COLUMN "public"."jct_ticket_watchers"."added_by" IS 'Employee who added this watcher (null if system/self)';



COMMENT ON COLUMN "public"."jct_ticket_watchers"."source" IS 'How the watch was added: manual, auto_creator, auto_assigner';



CREATE TABLE IF NOT EXISTS "public"."main_ai_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "entity_memory" "jsonb" DEFAULT '{"sites": {}, "tickets": {}, "companies": {}, "employees": {}, "preferences": {}}'::"jsonb" NOT NULL,
    "conversation_summary" "jsonb" DEFAULT '{"topics": [], "actions": [], "keyDecisions": [], "pendingTasks": [], "recentSummaries": []}'::"jsonb" NOT NULL,
    "recent_messages" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "title" "text",
    "message_count" integer DEFAULT 0 NOT NULL,
    "total_input_tokens" integer DEFAULT 0 NOT NULL,
    "total_output_tokens" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_message_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."main_ai_sessions" OWNER TO "postgres";


COMMENT ON TABLE "public"."main_ai_sessions" IS 'AI Assistant conversation sessions with entity memory (RAG-like) for context persistence';



CREATE TABLE IF NOT EXISTS "public"."main_announcements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "message" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."main_announcements" OWNER TO "postgres";


COMMENT ON TABLE "public"."main_announcements" IS 'Main: System announcements';



COMMENT ON COLUMN "public"."main_announcements"."message" IS 'Announcement message content';



CREATE TABLE IF NOT EXISTS "public"."main_appointments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "appointment_date" "date",
    "appointment_time_start" time without time zone,
    "appointment_time_end" time without time zone,
    "appointment_type" "public"."customer_appointment_type" DEFAULT 'call_to_schedule'::"public"."customer_appointment_type" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "is_approved" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."main_appointments" OWNER TO "postgres";


COMMENT ON TABLE "public"."main_appointments" IS 'Main: Appointment scheduling';



COMMENT ON COLUMN "public"."main_appointments"."is_approved" IS 'Indicates whether the appointment has been approved';



CREATE TABLE IF NOT EXISTS "public"."main_background_jobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_type" "text" NOT NULL,
    "status" "text" DEFAULT 'running'::"text" NOT NULL,
    "total" integer DEFAULT 0 NOT NULL,
    "processed" integer DEFAULT 0 NOT NULL,
    "succeeded" integer DEFAULT 0 NOT NULL,
    "failed" integer DEFAULT 0 NOT NULL,
    "skipped" integer DEFAULT 0 NOT NULL,
    "input_data" "jsonb",
    "errors" "jsonb" DEFAULT '[]'::"jsonb",
    "created_by" "uuid",
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "main_background_jobs_status_check" CHECK (("status" = ANY (ARRAY['running'::"text", 'completed'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."main_background_jobs" OWNER TO "postgres";


COMMENT ON TABLE "public"."main_background_jobs" IS 'Tracks background job status for async operations like backfill summaries';



CREATE TABLE IF NOT EXISTS "public"."main_companies" (
    "tax_id" character varying,
    "name_th" character varying NOT NULL,
    "name_en" character varying NOT NULL,
    "type" character varying,
    "status" character varying,
    "objective" "text",
    "objective_code" character varying,
    "register_date" "date",
    "register_capital" character varying,
    "branch_name" character varying,
    "address_full" "text",
    "address_no" character varying,
    "address_moo" character varying,
    "address_building" character varying,
    "address_floor" character varying,
    "address_room_no" character varying,
    "address_soi" character varying,
    "address_yaek" character varying,
    "address_trok" character varying,
    "address_village" character varying,
    "address_road" character varying,
    "address_tambon" character varying,
    "address_district" character varying,
    "address_province" character varying,
    "address_tambon_code" character varying,
    "address_district_code" character varying,
    "address_province_code" character varying,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "address_detail" "text",
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL
);


ALTER TABLE "public"."main_companies" OWNER TO "postgres";


COMMENT ON TABLE "public"."main_companies" IS 'Main: Company information from DBD API';



COMMENT ON COLUMN "public"."main_companies"."tax_id" IS 'Tax ID (optional)';



COMMENT ON COLUMN "public"."main_companies"."name_th" IS 'Company Thai name (required)';



COMMENT ON COLUMN "public"."main_companies"."name_en" IS 'Company English name (required)';



COMMENT ON COLUMN "public"."main_companies"."id" IS 'Primary key (UUID)';



CREATE TABLE IF NOT EXISTS "public"."main_employees" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying NOT NULL,
    "code" character varying NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "auth_user_id" "uuid",
    "nickname" character varying,
    "email" character varying,
    "role_id" "uuid",
    "profile_image_url" "text",
    "supervisor_id" "uuid",
    "cover_image_url" "text"
);


ALTER TABLE "public"."main_employees" OWNER TO "postgres";


COMMENT ON TABLE "public"."main_employees" IS 'Main: Employee records';



COMMENT ON COLUMN "public"."main_employees"."nickname" IS 'Optional nickname or preferred name for the employee';



COMMENT ON COLUMN "public"."main_employees"."email" IS 'Optional email address for the employee';



COMMENT ON COLUMN "public"."main_employees"."profile_image_url" IS 'URL to the employee profile image stored in Supabase Storage (profile-image bucket)';



COMMENT ON COLUMN "public"."main_employees"."supervisor_id" IS 'Reference to the employee who is the direct supervisor/manager of this employee';



COMMENT ON COLUMN "public"."main_employees"."cover_image_url" IS 'URL to the employee cover/banner image stored in Supabase Storage (employee-images bucket)';



CREATE TABLE IF NOT EXISTS "public"."main_features" (
    "id" character varying NOT NULL,
    "path" character varying,
    "display_name" character varying,
    "min_level" integer DEFAULT 0,
    "icon" "text",
    "group_label" character varying,
    "display_order" integer DEFAULT 0,
    "is_menu_item" boolean DEFAULT false,
    "allowed_roles" "text"[],
    "category_order" integer DEFAULT 0,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."main_features" OWNER TO "postgres";


COMMENT ON TABLE "public"."main_features" IS 'Main: Feature flags and permissions';



COMMENT ON COLUMN "public"."main_features"."is_active" IS 'Whether this feature is currently active and usable. Only active features are returned by the API.';



CREATE TABLE IF NOT EXISTS "public"."main_merchandise" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "serial_no" "text" NOT NULL,
    "model_id" "uuid" NOT NULL,
    "site_id" "uuid" NOT NULL,
    "pm_count" integer,
    "replaced_by_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "distributor_id" "uuid",
    "dealer_id" "uuid"
);


ALTER TABLE "public"."main_merchandise" OWNER TO "postgres";


COMMENT ON TABLE "public"."main_merchandise" IS 'Main: Merchandise/equipment at sites';



COMMENT ON COLUMN "public"."main_merchandise"."serial_no" IS 'Serial number of the merchandise';



COMMENT ON COLUMN "public"."main_merchandise"."model_id" IS 'Reference to the model';



COMMENT ON COLUMN "public"."main_merchandise"."site_id" IS 'Site where merchandise is located';



COMMENT ON COLUMN "public"."main_merchandise"."pm_count" IS 'Maximum PM count before warranty renewal needed';



COMMENT ON COLUMN "public"."main_merchandise"."replaced_by_id" IS 'Reference to the merchandise that replaced this one';



COMMENT ON COLUMN "public"."main_merchandise"."distributor_id" IS 'FK to main_companies.id (UUID)';



COMMENT ON COLUMN "public"."main_merchandise"."dealer_id" IS 'FK to main_companies.id (UUID)';



CREATE TABLE IF NOT EXISTS "public"."main_models" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "model" "text" NOT NULL,
    "name" "text",
    "website_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "name_th" character varying,
    "name_en" character varying,
    "description" "text",
    "category" character varying,
    "unit" character varying DEFAULT 'piece'::character varying,
    "is_active" boolean DEFAULT true,
    "has_serial" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."main_models" OWNER TO "postgres";


COMMENT ON TABLE "public"."main_models" IS 'Main: Product model catalog';



COMMENT ON COLUMN "public"."main_models"."model" IS 'Unique model identifier';



COMMENT ON COLUMN "public"."main_models"."name" IS 'Display name of the model';



COMMENT ON COLUMN "public"."main_models"."website_url" IS 'URL to model information/documentation';



COMMENT ON COLUMN "public"."main_models"."name_th" IS 'Thai name for the model/item';



COMMENT ON COLUMN "public"."main_models"."name_en" IS 'English name for the model/item';



COMMENT ON COLUMN "public"."main_models"."description" IS 'Detailed description';



COMMENT ON COLUMN "public"."main_models"."category" IS 'Category for filtering (ups, battery, cable, accessory)';



COMMENT ON COLUMN "public"."main_models"."unit" IS 'Unit of measurement (default: piece)';



COMMENT ON COLUMN "public"."main_models"."is_active" IS 'Whether this model/item is active';



COMMENT ON COLUMN "public"."main_models"."has_serial" IS 'Whether this model requires serial number tracking (true=individual units, false=quantity-based)';



CREATE TABLE IF NOT EXISTS "public"."main_notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "recipient_id" "uuid" NOT NULL,
    "type" "public"."notification_type" NOT NULL,
    "title" character varying(255) NOT NULL,
    "message" "text" NOT NULL,
    "ticket_id" "uuid",
    "comment_id" "uuid",
    "audit_id" "uuid",
    "actor_id" "uuid",
    "is_read" boolean DEFAULT false NOT NULL,
    "read_at" timestamp with time zone,
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."main_notifications" OWNER TO "postgres";


COMMENT ON TABLE "public"."main_notifications" IS 'Main: In-app notifications for employees';



COMMENT ON COLUMN "public"."main_notifications"."id" IS 'Primary key';



COMMENT ON COLUMN "public"."main_notifications"."recipient_id" IS 'Employee who should receive this notification';



COMMENT ON COLUMN "public"."main_notifications"."type" IS 'Type of notification';



COMMENT ON COLUMN "public"."main_notifications"."title" IS 'Notification title (Thai)';



COMMENT ON COLUMN "public"."main_notifications"."message" IS 'Notification message body (Thai)';



COMMENT ON COLUMN "public"."main_notifications"."ticket_id" IS 'Related ticket (if applicable)';



COMMENT ON COLUMN "public"."main_notifications"."comment_id" IS 'Related comment (if applicable)';



COMMENT ON COLUMN "public"."main_notifications"."audit_id" IS 'Related audit log entry (if applicable)';



COMMENT ON COLUMN "public"."main_notifications"."actor_id" IS 'Employee who triggered the notification';



COMMENT ON COLUMN "public"."main_notifications"."is_read" IS 'Whether notification has been read';



COMMENT ON COLUMN "public"."main_notifications"."read_at" IS 'When notification was read';



COMMENT ON COLUMN "public"."main_notifications"."metadata" IS 'Additional context data';



COMMENT ON COLUMN "public"."main_notifications"."created_at" IS 'Created timestamp';



CREATE TABLE IF NOT EXISTS "public"."main_org_departments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" character varying NOT NULL,
    "name_th" character varying NOT NULL,
    "name_en" character varying,
    "description" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "head_id" "uuid"
);


ALTER TABLE "public"."main_org_departments" OWNER TO "postgres";


COMMENT ON TABLE "public"."main_org_departments" IS 'Main: Organizational departments';



CREATE TABLE IF NOT EXISTS "public"."main_org_roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" character varying NOT NULL,
    "name_th" character varying NOT NULL,
    "name_en" character varying,
    "description" "text",
    "name" character varying,
    "level" integer,
    "department_id" "uuid",
    "is_active" boolean DEFAULT true,
    "requires_auth" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."main_org_roles" OWNER TO "postgres";


COMMENT ON TABLE "public"."main_org_roles" IS 'Main: Employee roles with permissions';



CREATE TABLE IF NOT EXISTS "public"."main_route_optimization_jobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "request_payload" "jsonb" NOT NULL,
    "result_payload" "jsonb",
    "error_message" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    CONSTRAINT "main_route_optimization_jobs_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'completed'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."main_route_optimization_jobs" OWNER TO "postgres";


COMMENT ON TABLE "public"."main_route_optimization_jobs" IS 'Stores route optimization jobs for async polling';



CREATE TABLE IF NOT EXISTS "public"."main_sites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying NOT NULL,
    "address_detail" "text",
    "subdistrict_code" integer,
    "postal_code" integer,
    "contact_ids" "uuid"[] DEFAULT ARRAY[]::"uuid"[],
    "map_url" "text",
    "district_code" integer,
    "province_code" integer,
    "is_main_branch" boolean DEFAULT false,
    "safety_standard" "public"."safety_standard_type"[],
    "company_id" "uuid",
    "latitude" double precision,
    "longitude" double precision,
    "map_embed_url" "text"
);


ALTER TABLE "public"."main_sites" OWNER TO "postgres";


COMMENT ON TABLE "public"."main_sites" IS 'Main: Customer sites/locations';



COMMENT ON COLUMN "public"."main_sites"."contact_ids" IS 'Array of contact IDs associated with this site';



COMMENT ON COLUMN "public"."main_sites"."map_url" IS 'Optional Google Maps URL for the site location';



COMMENT ON COLUMN "public"."main_sites"."is_main_branch" IS 'Indicates if this site is the main branch/head office for the company';



COMMENT ON COLUMN "public"."main_sites"."safety_standard" IS 'Array of required safety standards for this site (safety_shoes, safety_vest, safety_helmet, training)';



COMMENT ON COLUMN "public"."main_sites"."company_id" IS 'FK to main_companies.id (UUID)';



COMMENT ON COLUMN "public"."main_sites"."latitude" IS 'ละติจูดของสถานที่ (WGS84)';



COMMENT ON COLUMN "public"."main_sites"."longitude" IS 'ลองจิจูดของสถานที่ (WGS84)';



COMMENT ON COLUMN "public"."main_sites"."map_embed_url" IS 'Google Maps embed URL สำหรับแสดงแผนที่ใน iframe';



CREATE TABLE IF NOT EXISTS "public"."main_staged_files" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "file_url" "text" NOT NULL,
    "file_name" "text" NOT NULL,
    "file_size" integer,
    "mime_type" "text",
    "ticket_id" "uuid",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "approved_by" "uuid",
    "approved_at" timestamp with time zone,
    "rejection_reason" "text",
    "result_comment_id" "uuid",
    "expires_at" timestamp with time zone DEFAULT ("now"() + '30 days'::interval) NOT NULL,
    "source" "text" DEFAULT 'line'::"text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "main_staged_files_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'linked'::"text", 'approved'::"text", 'rejected'::"text", 'expired'::"text"])))
);


ALTER TABLE "public"."main_staged_files" OWNER TO "postgres";


COMMENT ON TABLE "public"."main_staged_files" IS 'Staging area for files uploaded via LINE/n8n before approval';



COMMENT ON COLUMN "public"."main_staged_files"."id" IS 'Primary key';



COMMENT ON COLUMN "public"."main_staged_files"."employee_id" IS 'FK to main_employees - who uploaded the file';



COMMENT ON COLUMN "public"."main_staged_files"."file_url" IS 'URL to file in staging-files bucket';



COMMENT ON COLUMN "public"."main_staged_files"."file_name" IS 'Original filename';



COMMENT ON COLUMN "public"."main_staged_files"."file_size" IS 'File size in bytes';



COMMENT ON COLUMN "public"."main_staged_files"."mime_type" IS 'MIME type of the file';



COMMENT ON COLUMN "public"."main_staged_files"."ticket_id" IS 'FK to main_tickets - linked after technician selects';



COMMENT ON COLUMN "public"."main_staged_files"."status" IS 'Workflow status: pending, linked, approved, rejected, expired';



COMMENT ON COLUMN "public"."main_staged_files"."approved_by" IS 'FK to main_employees - who approved the file';



COMMENT ON COLUMN "public"."main_staged_files"."approved_at" IS 'When the file was approved';



COMMENT ON COLUMN "public"."main_staged_files"."rejection_reason" IS 'Reason for rejection if rejected';



COMMENT ON COLUMN "public"."main_staged_files"."result_comment_id" IS 'FK to child_ticket_comments - created on approval';



COMMENT ON COLUMN "public"."main_staged_files"."expires_at" IS 'When the file expires if not linked (30 days)';



COMMENT ON COLUMN "public"."main_staged_files"."source" IS 'Source of upload: line, web, etc.';



COMMENT ON COLUMN "public"."main_staged_files"."metadata" IS 'Additional metadata from n8n';



CREATE TABLE IF NOT EXISTS "public"."main_stock_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "location_id" "uuid" NOT NULL,
    "model_id" "uuid" NOT NULL,
    "quantity" integer DEFAULT 0 NOT NULL,
    "minimum_quantity" integer DEFAULT 0 NOT NULL,
    "reserved_quantity" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "chk_available_non_negative" CHECK (("quantity" >= "reserved_quantity")),
    CONSTRAINT "chk_minimum_non_negative" CHECK (("minimum_quantity" >= 0)),
    CONSTRAINT "chk_quantity_non_negative" CHECK (("quantity" >= 0)),
    CONSTRAINT "chk_reserved_non_negative" CHECK (("reserved_quantity" >= 0))
);


ALTER TABLE "public"."main_stock_items" OWNER TO "postgres";


COMMENT ON TABLE "public"."main_stock_items" IS 'Stock quantity per location per package item';



CREATE TABLE IF NOT EXISTS "public"."main_stock_locations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying NOT NULL,
    "code" character varying NOT NULL,
    "location_type_id" "uuid" NOT NULL,
    "site_id" "uuid",
    "employee_id" "uuid",
    "address" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."main_stock_locations" OWNER TO "postgres";


COMMENT ON TABLE "public"."main_stock_locations" IS 'Stock storage locations (warehouses, vehicles, technician allocations)';



CREATE TABLE IF NOT EXISTS "public"."main_stock_serial_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "model_id" "uuid" NOT NULL,
    "serial_no" "text" NOT NULL,
    "location_id" "uuid",
    "status" "public"."stock_serial_status" DEFAULT 'in_stock'::"public"."stock_serial_status" NOT NULL,
    "ticket_id" "uuid",
    "site_id" "uuid",
    "received_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "received_by" "uuid",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."main_stock_serial_items" OWNER TO "postgres";


COMMENT ON TABLE "public"."main_stock_serial_items" IS 'Individual serialized inventory items with full tracking';



COMMENT ON COLUMN "public"."main_stock_serial_items"."serial_no" IS 'Unique serial number for this item';



COMMENT ON COLUMN "public"."main_stock_serial_items"."location_id" IS 'Current storage location (null if deployed or scrapped)';



COMMENT ON COLUMN "public"."main_stock_serial_items"."status" IS 'Current status: in_stock, reserved, deployed, defective, returned, scrapped';



COMMENT ON COLUMN "public"."main_stock_serial_items"."ticket_id" IS 'Associated ticket when deployed or reserved';



CREATE TABLE IF NOT EXISTS "public"."main_tickets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "details" "text",
    "work_type_id" "uuid" NOT NULL,
    "assigner_id" "uuid" NOT NULL,
    "status_id" "uuid" NOT NULL,
    "additional" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "site_id" "uuid",
    "contact_id" "uuid",
    "appointment_id" "uuid",
    "created_by" "uuid",
    "details_summary" "text",
    "ticket_number" integer NOT NULL,
    "ticket_code" character varying(20) NOT NULL
);


ALTER TABLE "public"."main_tickets" OWNER TO "postgres";


COMMENT ON TABLE "public"."main_tickets" IS 'Main: Work tickets';



COMMENT ON COLUMN "public"."main_tickets"."created_by" IS 'Employee ID of the user who created the ticket';



COMMENT ON COLUMN "public"."main_tickets"."details_summary" IS 'AI-generated summary of ticket details (auto-generated when summarize flag is true)';



CREATE TABLE IF NOT EXISTS "public"."main_todos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "deadline" timestamp with time zone NOT NULL,
    "ticket_id" "uuid",
    "creator_id" "uuid" NOT NULL,
    "assignee_id" "uuid" NOT NULL,
    "is_completed" boolean DEFAULT false NOT NULL,
    "completed_at" timestamp with time zone,
    "notified_at" timestamp with time zone,
    "priority" "public"."todo_priority" DEFAULT 'normal'::"public"."todo_priority" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."main_todos" OWNER TO "postgres";


COMMENT ON TABLE "public"."main_todos" IS 'Todo/reminder tasks with deadlines, assignable to employees';



COMMENT ON COLUMN "public"."main_todos"."notified_at" IS 'Timestamp when deadline notification was sent (NULL = not yet notified)';



COMMENT ON COLUMN "public"."main_todos"."priority" IS 'Task priority: low, normal, high, urgent';



CREATE TABLE IF NOT EXISTS "public"."ref_districts" (
    "id" integer NOT NULL,
    "name_th" character varying(100) NOT NULL,
    "name_en" character varying(100),
    "province_id" integer,
    "latitude" numeric(10,7),
    "longitude" numeric(10,7)
);


ALTER TABLE "public"."ref_districts" OWNER TO "postgres";


COMMENT ON TABLE "public"."ref_districts" IS 'Reference: Thai districts (amphoe)';



COMMENT ON COLUMN "public"."ref_districts"."latitude" IS 'District centroid latitude (WGS84)';



COMMENT ON COLUMN "public"."ref_districts"."longitude" IS 'District centroid longitude (WGS84)';



CREATE TABLE IF NOT EXISTS "public"."ref_leave_types" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" character varying NOT NULL,
    "days_per_year" integer,
    "requires_approval" boolean DEFAULT true,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "code" character varying,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ref_leave_types" OWNER TO "postgres";


COMMENT ON TABLE "public"."ref_leave_types" IS 'Reference: Leave type lookup values';



COMMENT ON COLUMN "public"."ref_leave_types"."code" IS 'Unique code identifier for the leave type (e.g., sick_leave, personal_leave)';



CREATE TABLE IF NOT EXISTS "public"."ref_package_services" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" character varying(50) NOT NULL,
    "name_th" character varying(255) NOT NULL,
    "name_en" character varying(255),
    "description" "text",
    "category" character varying(100),
    "duration_months" integer,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."ref_package_services" OWNER TO "postgres";


COMMENT ON TABLE "public"."ref_package_services" IS 'Reference: Package service catalog';



COMMENT ON COLUMN "public"."ref_package_services"."code" IS 'Unique service code (e.g., SVC-INSTALL, SVC-WARRANTY-1Y)';



COMMENT ON COLUMN "public"."ref_package_services"."name_th" IS 'Thai name of the service';



COMMENT ON COLUMN "public"."ref_package_services"."name_en" IS 'English name of the service';



COMMENT ON COLUMN "public"."ref_package_services"."category" IS 'Service category (e.g., installation, warranty, maintenance)';



COMMENT ON COLUMN "public"."ref_package_services"."duration_months" IS 'Service duration in months if applicable';



CREATE TABLE IF NOT EXISTS "public"."ref_provinces" (
    "id" integer NOT NULL,
    "name_th" character varying(100) NOT NULL,
    "name_en" character varying(100),
    "geography_id" integer
);


ALTER TABLE "public"."ref_provinces" OWNER TO "postgres";


COMMENT ON TABLE "public"."ref_provinces" IS 'Reference: Thai provinces';



CREATE TABLE IF NOT EXISTS "public"."ref_stock_location_types" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" character varying NOT NULL,
    "name_th" character varying NOT NULL,
    "name_en" character varying,
    "description" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ref_stock_location_types" OWNER TO "postgres";


COMMENT ON TABLE "public"."ref_stock_location_types" IS 'Reference table for stock location types (warehouse, vehicle, technician)';



CREATE TABLE IF NOT EXISTS "public"."ref_sub_districts" (
    "id" integer NOT NULL,
    "name_th" character varying(100) NOT NULL,
    "name_en" character varying(100),
    "district_id" integer,
    "zip_code" integer
);


ALTER TABLE "public"."ref_sub_districts" OWNER TO "postgres";


COMMENT ON TABLE "public"."ref_sub_districts" IS 'Reference: Thai sub-districts (tambon)';



CREATE TABLE IF NOT EXISTS "public"."ref_ticket_statuses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying NOT NULL,
    "code" character varying NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."ref_ticket_statuses" OWNER TO "postgres";


COMMENT ON TABLE "public"."ref_ticket_statuses" IS 'Reference: Ticket status lookup values';



CREATE TABLE IF NOT EXISTS "public"."ref_ticket_work_types" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying NOT NULL,
    "code" character varying NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."ref_ticket_work_types" OWNER TO "postgres";


COMMENT ON TABLE "public"."ref_ticket_work_types" IS 'Reference: Ticket work type lookup values';



CREATE TABLE IF NOT EXISTS "public"."ref_work_givers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" character varying NOT NULL,
    "name" character varying NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ref_work_givers" OWNER TO "postgres";


COMMENT ON TABLE "public"."ref_work_givers" IS 'Reference: Work giver options for tickets';



COMMENT ON COLUMN "public"."ref_work_givers"."id" IS 'Primary key';



COMMENT ON COLUMN "public"."ref_work_givers"."code" IS 'Unique work giver code';



COMMENT ON COLUMN "public"."ref_work_givers"."name" IS 'Display name';



COMMENT ON COLUMN "public"."ref_work_givers"."is_active" IS 'Whether this work giver is active';



COMMENT ON COLUMN "public"."ref_work_givers"."created_at" IS 'Created timestamp';



COMMENT ON COLUMN "public"."ref_work_givers"."updated_at" IS 'Updated timestamp';



CREATE TABLE IF NOT EXISTS "public"."sys_idempotency_keys" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "idempotency_key" "text" NOT NULL,
    "operation_type" "text" NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "request_payload" "jsonb" NOT NULL,
    "response_data" "jsonb",
    "status_code" integer,
    "is_completed" boolean DEFAULT false NOT NULL,
    "is_failed" boolean DEFAULT false NOT NULL,
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '24:00:00'::interval) NOT NULL
);


ALTER TABLE "public"."sys_idempotency_keys" OWNER TO "postgres";


COMMENT ON TABLE "public"."sys_idempotency_keys" IS 'System: Idempotency keys for duplicate prevention';



COMMENT ON COLUMN "public"."sys_idempotency_keys"."idempotency_key" IS 'Unique key provided by client (e.g., UUID v4)';



COMMENT ON COLUMN "public"."sys_idempotency_keys"."operation_type" IS 'Type of operation being idempotent (e.g., create_ticket)';



COMMENT ON COLUMN "public"."sys_idempotency_keys"."request_payload" IS 'Original request payload for verification';



COMMENT ON COLUMN "public"."sys_idempotency_keys"."response_data" IS 'Response data to return for duplicate requests';



COMMENT ON COLUMN "public"."sys_idempotency_keys"."expires_at" IS 'When this key expires (default 24 hours)';



CREATE SEQUENCE IF NOT EXISTS "public"."ticket_number_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."ticket_number_seq" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_employees" AS
 SELECT "e"."id",
    "e"."code",
    "e"."name",
    "e"."nickname",
    "e"."email",
    "e"."is_active",
    "e"."auth_user_id",
    "e"."profile_image_url",
    "e"."cover_image_url",
    "e"."supervisor_id",
    "e"."created_at",
    "e"."updated_at",
    "e"."role_id",
    "r"."code" AS "role_code",
    "r"."name_th" AS "role_name_th",
    "r"."name_en" AS "role_name_en",
    "r"."level" AS "role_level",
    "r"."department_id",
    "d"."code" AS "department_code",
    "d"."name_th" AS "department_name_th",
    "d"."name_en" AS "department_name_en"
   FROM (("public"."main_employees" "e"
     LEFT JOIN "public"."main_org_roles" "r" ON (("e"."role_id" = "r"."id")))
     LEFT JOIN "public"."main_org_departments" "d" ON (("r"."department_id" = "d"."id")));


ALTER VIEW "public"."v_employees" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_leave_balances" WITH ("security_barrier"='true') AS
 SELECT "lb"."id",
    "lb"."employee_id",
    "lb"."leave_type_id",
    "lb"."year",
    "lb"."total_days",
    "lb"."used_days",
    "lb"."remaining_days",
    "lb"."created_at",
    "lb"."updated_at",
    "e"."name" AS "employee_name",
    "e"."code" AS "employee_code",
    "lt"."name" AS "leave_type_name",
    "lt"."code" AS "leave_type_code"
   FROM (("public"."child_employee_leave_balances" "lb"
     LEFT JOIN "public"."main_employees" "e" ON (("lb"."employee_id" = "e"."id")))
     LEFT JOIN "public"."ref_leave_types" "lt" ON (("lb"."leave_type_id" = "lt"."id")));


ALTER VIEW "public"."v_leave_balances" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_leave_requests" WITH ("security_barrier"='true') AS
 SELECT "lr"."id",
    "lr"."employee_id",
    "lr"."leave_type_id",
    "lr"."start_date",
    "lr"."end_date",
    "lr"."total_days",
    "lr"."reason",
    "lr"."status",
    "lr"."approved_by",
    "lr"."approved_at",
    "lr"."created_at",
    "lr"."updated_at",
    "lr"."half_day_type",
    "e"."name" AS "employee_name",
    "e"."code" AS "employee_code",
    "lt"."name" AS "leave_type_name",
    "lt"."code" AS "leave_type_code",
    "approver"."name" AS "approved_by_name",
    "approver"."code" AS "approved_by_code"
   FROM ((("public"."child_employee_leave_requests" "lr"
     LEFT JOIN "public"."main_employees" "e" ON (("lr"."employee_id" = "e"."id")))
     LEFT JOIN "public"."ref_leave_types" "lt" ON (("lr"."leave_type_id" = "lt"."id")))
     LEFT JOIN "public"."main_employees" "approver" ON (("lr"."approved_by" = "approver"."id")));


ALTER VIEW "public"."v_leave_requests" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_merchandise" WITH ("security_barrier"='true') AS
 SELECT "m"."id",
    "m"."serial_no",
    "m"."model_id",
    "m"."site_id",
    "m"."pm_count",
    "m"."distributor_id",
    "m"."dealer_id",
    "m"."replaced_by_id",
    "m"."created_at",
    "m"."updated_at",
    "mo"."model" AS "model_name",
    "mo"."name" AS "model_display_name",
    "mo"."website_url" AS "model_website_url",
    "s"."name" AS "site_name",
    "c"."name_th" AS "company_name",
    "c"."name_en" AS "company_name_en",
    "c"."tax_id" AS "company_tax_id",
    "dist"."name_th" AS "distributor_name",
    "dist"."tax_id" AS "distributor_tax_id",
    "deal"."name_th" AS "dealer_name",
    "deal"."tax_id" AS "dealer_tax_id"
   FROM ((((("public"."main_merchandise" "m"
     LEFT JOIN "public"."main_models" "mo" ON (("m"."model_id" = "mo"."id")))
     LEFT JOIN "public"."main_sites" "s" ON (("m"."site_id" = "s"."id")))
     LEFT JOIN "public"."main_companies" "c" ON (("s"."company_id" = "c"."id")))
     LEFT JOIN "public"."main_companies" "dist" ON (("m"."distributor_id" = "dist"."id")))
     LEFT JOIN "public"."main_companies" "deal" ON (("m"."dealer_id" = "deal"."id")));


ALTER VIEW "public"."v_merchandise" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_sites" WITH ("security_barrier"='true') AS
 SELECT "s"."id",
    "s"."name",
    "s"."address_detail",
    "s"."subdistrict_code",
    "s"."postal_code",
    "s"."contact_ids",
    "s"."map_url",
    "s"."company_id",
    "s"."district_code",
    "s"."province_code",
    "s"."is_main_branch",
    "s"."safety_standard",
    "c"."tax_id" AS "company_tax_id",
    "c"."name_th" AS "company_name_th",
    "c"."name_en" AS "company_name_en"
   FROM ("public"."main_sites" "s"
     LEFT JOIN "public"."main_companies" "c" ON (("s"."company_id" = "c"."id")));


ALTER VIEW "public"."v_sites" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_ticket_audit_readable" AS
 SELECT "a"."id",
    "a"."ticket_id",
    "a"."action",
    "a"."changed_by",
    "e"."name" AS "changed_by_name",
    "e"."nickname" AS "changed_by_nickname",
    "public"."generate_ticket_audit_summary"("a"."action", "a"."changed_fields", "a"."old_values", "a"."new_values", "a"."metadata") AS "summary",
    "a"."changed_fields",
    "a"."old_values",
    "a"."new_values",
    "a"."metadata",
    "a"."created_at",
    "wt"."name" AS "work_type_name",
    "s"."name" AS "site_name",
    "c"."name_th" AS "company_name"
   FROM ((((("public"."child_ticket_audit" "a"
     LEFT JOIN "public"."main_tickets" "t" ON (("a"."ticket_id" = "t"."id")))
     LEFT JOIN "public"."main_employees" "e" ON (("a"."changed_by" = "e"."auth_user_id")))
     LEFT JOIN "public"."ref_ticket_work_types" "wt" ON (("t"."work_type_id" = "wt"."id")))
     LEFT JOIN "public"."main_sites" "s" ON (("t"."site_id" = "s"."id")))
     LEFT JOIN "public"."main_companies" "c" ON (("s"."company_id" = "c"."id")))
  ORDER BY "a"."created_at" DESC;


ALTER VIEW "public"."v_ticket_audit_readable" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_ticket_audit_readable" IS 'Readable audit logs with natural language Thai summaries';



CREATE OR REPLACE VIEW "public"."v_tickets" AS
 SELECT "t"."id",
    "t"."details",
    "t"."work_type_id",
    "t"."assigner_id",
    "t"."status_id",
    "t"."additional",
    "t"."created_at",
    "t"."updated_at",
    "t"."site_id",
    "t"."contact_id",
    "t"."appointment_id",
    "t"."created_by",
    "a"."appointment_date",
    "a"."appointment_time_start",
    "a"."appointment_time_end",
    "a"."is_approved" AS "appointment_is_approved",
    "a"."appointment_type",
    "s"."name" AS "site_name",
    "s"."company_id",
    "c"."tax_id" AS "company_tax_id",
    "c"."name_th" AS "company_name",
    "c"."name_en" AS "company_name_en",
    "wt"."name" AS "work_type_name",
    "wt"."code" AS "work_type_code",
    "ts"."name" AS "status_name",
    "ts"."code" AS "status_code",
    "assigner"."name" AS "assigner_name",
    "assigner"."code" AS "assigner_code",
    "creator"."name" AS "creator_name",
    "creator"."code" AS "creator_code",
    "con"."person_name" AS "contact_name",
    "wg"."id" AS "work_giver_id",
    "rwg"."code" AS "work_giver_code",
    "rwg"."name" AS "work_giver_name"
   FROM (((((((((("public"."main_tickets" "t"
     LEFT JOIN "public"."main_appointments" "a" ON (("t"."appointment_id" = "a"."id")))
     LEFT JOIN "public"."main_sites" "s" ON (("t"."site_id" = "s"."id")))
     LEFT JOIN "public"."main_companies" "c" ON (("s"."company_id" = "c"."id")))
     LEFT JOIN "public"."ref_ticket_work_types" "wt" ON (("t"."work_type_id" = "wt"."id")))
     LEFT JOIN "public"."ref_ticket_statuses" "ts" ON (("t"."status_id" = "ts"."id")))
     LEFT JOIN "public"."main_employees" "assigner" ON (("t"."assigner_id" = "assigner"."id")))
     LEFT JOIN "public"."main_employees" "creator" ON (("t"."created_by" = "creator"."id")))
     LEFT JOIN "public"."child_site_contacts" "con" ON (("t"."contact_id" = "con"."id")))
     LEFT JOIN "public"."child_ticket_work_givers" "wg" ON (("t"."id" = "wg"."ticket_id")))
     LEFT JOIN "public"."ref_work_givers" "rwg" ON (("wg"."work_giver_id" = "rwg"."id")));


ALTER VIEW "public"."v_tickets" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_tickets" IS 'View: Complete ticket information with all related data including work giver';



ALTER TABLE ONLY "public"."addon_achievement_goals"
    ADD CONSTRAINT "addon_achievement_goals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."addon_employee_achievements"
    ADD CONSTRAINT "addon_employee_achievements_employee_id_goal_id_period_star_key" UNIQUE ("employee_id", "goal_id", "period_start");



ALTER TABLE ONLY "public"."addon_employee_achievements"
    ADD CONSTRAINT "addon_employee_achievements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."addon_employee_coupons"
    ADD CONSTRAINT "addon_employee_coupons_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."child_announcement_files"
    ADD CONSTRAINT "announcement_files_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."child_announcement_photos"
    ADD CONSTRAINT "announcement_photos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."main_announcements"
    ADD CONSTRAINT "announcements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."jct_appointment_approvers"
    ADD CONSTRAINT "appointment_approval_users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."main_appointments"
    ADD CONSTRAINT "appointments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."child_ai_messages"
    ADD CONSTRAINT "child_ai_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."child_comment_files"
    ADD CONSTRAINT "child_comment_files_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."child_comment_photos"
    ADD CONSTRAINT "child_comment_photos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."child_company_comment_files"
    ADD CONSTRAINT "child_company_comment_files_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."child_company_comment_photos"
    ADD CONSTRAINT "child_company_comment_photos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."child_company_comments"
    ADD CONSTRAINT "child_company_comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."child_employee_line_accounts"
    ADD CONSTRAINT "child_employee_line_accounts_employee_id_key" UNIQUE ("employee_id");



ALTER TABLE ONLY "public"."child_employee_line_accounts"
    ADD CONSTRAINT "child_employee_line_accounts_line_user_id_key" UNIQUE ("line_user_id");



ALTER TABLE ONLY "public"."child_employee_line_accounts"
    ADD CONSTRAINT "child_employee_line_accounts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."child_merchandise_location"
    ADD CONSTRAINT "child_merchandise_location_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."child_site_comment_files"
    ADD CONSTRAINT "child_site_comment_files_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."child_site_comment_photos"
    ADD CONSTRAINT "child_site_comment_photos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."child_site_comments"
    ADD CONSTRAINT "child_site_comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."child_stock_movements"
    ADD CONSTRAINT "child_stock_movements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."child_stock_serial_movements"
    ADD CONSTRAINT "child_stock_serial_movements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."child_ticket_comments"
    ADD CONSTRAINT "child_ticket_comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."child_ticket_extra_fields"
    ADD CONSTRAINT "child_ticket_extra_fields_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."child_ticket_files"
    ADD CONSTRAINT "child_ticket_files_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."child_ticket_photos"
    ADD CONSTRAINT "child_ticket_photos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."child_ticket_ratings"
    ADD CONSTRAINT "child_ticket_ratings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."child_ticket_ratings"
    ADD CONSTRAINT "child_ticket_ratings_ticket_id_key" UNIQUE ("ticket_id");



ALTER TABLE ONLY "public"."child_ticket_work_estimates"
    ADD CONSTRAINT "child_ticket_work_estimates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."child_ticket_work_givers"
    ADD CONSTRAINT "child_ticket_work_givers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."child_ticket_work_givers"
    ADD CONSTRAINT "child_ticket_work_givers_ticket_id_unique" UNIQUE ("ticket_id");



ALTER TABLE ONLY "public"."child_site_contacts"
    ADD CONSTRAINT "contacts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."main_org_departments"
    ADD CONSTRAINT "departments_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."main_org_departments"
    ADD CONSTRAINT "departments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."jct_site_employee_trainings"
    ADD CONSTRAINT "employee_site_trainings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."main_employees"
    ADD CONSTRAINT "employees_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."main_employees"
    ADD CONSTRAINT "employees_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."main_features"
    ADD CONSTRAINT "feature_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."fleet_garages"
    ADD CONSTRAINT "fleet_garages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."fleet_vehicle_history"
    ADD CONSTRAINT "fleet_vehicle_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."fleet_vehicles"
    ADD CONSTRAINT "fleet_vehicles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sys_idempotency_keys"
    ADD CONSTRAINT "idempotency_keys_idempotency_key_key" UNIQUE ("idempotency_key");



ALTER TABLE ONLY "public"."sys_idempotency_keys"
    ADD CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."jct_fleet_vehicle_employees"
    ADD CONSTRAINT "jct_fleet_vehicle_employees_pkey" PRIMARY KEY ("vehicle_id", "employee_id");



ALTER TABLE ONLY "public"."jct_ticket_employees_cf"
    ADD CONSTRAINT "jct_ticket_employees_cf_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."jct_ticket_stock_items"
    ADD CONSTRAINT "jct_ticket_stock_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."jct_ticket_watchers"
    ADD CONSTRAINT "jct_ticket_watchers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."child_employee_leave_balances"
    ADD CONSTRAINT "leave_balances_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."child_employee_leave_requests"
    ADD CONSTRAINT "leave_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ref_leave_types"
    ADD CONSTRAINT "leave_types_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."ref_leave_types"
    ADD CONSTRAINT "leave_types_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."ref_leave_types"
    ADD CONSTRAINT "leave_types_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."main_ai_sessions"
    ADD CONSTRAINT "main_ai_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."main_background_jobs"
    ADD CONSTRAINT "main_background_jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."main_companies"
    ADD CONSTRAINT "main_companies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."main_notifications"
    ADD CONSTRAINT "main_notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."main_route_optimization_jobs"
    ADD CONSTRAINT "main_route_optimization_jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."main_staged_files"
    ADD CONSTRAINT "main_staged_files_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."main_stock_items"
    ADD CONSTRAINT "main_stock_items_location_model_unique" UNIQUE ("location_id", "model_id");



ALTER TABLE ONLY "public"."main_stock_items"
    ADD CONSTRAINT "main_stock_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."main_stock_locations"
    ADD CONSTRAINT "main_stock_locations_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."main_stock_locations"
    ADD CONSTRAINT "main_stock_locations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."main_stock_serial_items"
    ADD CONSTRAINT "main_stock_serial_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."main_tickets"
    ADD CONSTRAINT "main_tickets_ticket_code_key" UNIQUE ("ticket_code");



ALTER TABLE ONLY "public"."main_tickets"
    ADD CONSTRAINT "main_tickets_ticket_number_key" UNIQUE ("ticket_number");



ALTER TABLE ONLY "public"."main_todos"
    ADD CONSTRAINT "main_todos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."main_merchandise"
    ADD CONSTRAINT "merchandise_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."jct_model_components"
    ADD CONSTRAINT "model_package_items_model_id_item_id_key" UNIQUE ("model_id", "component_model_id");



ALTER TABLE ONLY "public"."jct_model_components"
    ADD CONSTRAINT "model_package_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."jct_model_package_services"
    ADD CONSTRAINT "model_package_services_model_id_service_id_key" UNIQUE ("model_id", "service_id");



ALTER TABLE ONLY "public"."jct_model_package_services"
    ADD CONSTRAINT "model_package_services_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."main_models"
    ADD CONSTRAINT "models_model_key" UNIQUE ("model");



ALTER TABLE ONLY "public"."main_models"
    ADD CONSTRAINT "models_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ref_package_services"
    ADD CONSTRAINT "package_services_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."ref_package_services"
    ADD CONSTRAINT "package_services_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ref_districts"
    ADD CONSTRAINT "ref_districts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ref_provinces"
    ADD CONSTRAINT "ref_provinces_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ref_stock_location_types"
    ADD CONSTRAINT "ref_stock_location_types_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."ref_stock_location_types"
    ADD CONSTRAINT "ref_stock_location_types_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ref_sub_districts"
    ADD CONSTRAINT "ref_sub_districts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ref_work_givers"
    ADD CONSTRAINT "ref_work_givers_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."ref_work_givers"
    ADD CONSTRAINT "ref_work_givers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."main_org_roles"
    ADD CONSTRAINT "roles_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."main_org_roles"
    ADD CONSTRAINT "roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."main_sites"
    ADD CONSTRAINT "sites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."child_ticket_audit"
    ADD CONSTRAINT "ticket_audit_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."jct_ticket_employees"
    ADD CONSTRAINT "ticket_employees_date_employee_ticket_unique" UNIQUE ("date", "employee_id", "ticket_id");



ALTER TABLE ONLY "public"."jct_ticket_employees"
    ADD CONSTRAINT "ticket_employees_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."jct_ticket_merchandise"
    ADD CONSTRAINT "ticket_merchandise_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ref_ticket_statuses"
    ADD CONSTRAINT "ticket_statuses_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."ref_ticket_statuses"
    ADD CONSTRAINT "ticket_statuses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."main_tickets"
    ADD CONSTRAINT "tickets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."main_stock_serial_items"
    ADD CONSTRAINT "unique_serial_per_item" UNIQUE ("model_id", "serial_no");



ALTER TABLE ONLY "public"."child_ai_messages"
    ADD CONSTRAINT "unique_session_sequence" UNIQUE ("session_id", "sequence_number");



ALTER TABLE ONLY "public"."child_ticket_extra_fields"
    ADD CONSTRAINT "unique_ticket_field_key" UNIQUE ("ticket_id", "field_key");



ALTER TABLE ONLY "public"."child_ticket_work_estimates"
    ADD CONSTRAINT "unique_ticket_work_estimate" UNIQUE ("ticket_id");



ALTER TABLE ONLY "public"."main_stock_items"
    ADD CONSTRAINT "uq_stock_location_item" UNIQUE ("location_id", "model_id");



ALTER TABLE ONLY "public"."ref_ticket_work_types"
    ADD CONSTRAINT "work_types_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."ref_ticket_work_types"
    ADD CONSTRAINT "work_types_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_addon_achievements_employee" ON "public"."addon_employee_achievements" USING "btree" ("employee_id");



CREATE INDEX "idx_addon_achievements_period" ON "public"."addon_employee_achievements" USING "btree" ("period_start", "period_end");



CREATE INDEX "idx_addon_achievements_status" ON "public"."addon_employee_achievements" USING "btree" ("status");



CREATE INDEX "idx_addon_coupons_employee" ON "public"."addon_employee_coupons" USING "btree" ("employee_id");



CREATE INDEX "idx_addon_coupons_expires" ON "public"."addon_employee_coupons" USING "btree" ("expires_at");



CREATE INDEX "idx_addon_coupons_status" ON "public"."addon_employee_coupons" USING "btree" ("status");



CREATE INDEX "idx_ai_messages_session_id" ON "public"."child_ai_messages" USING "btree" ("session_id");



CREATE INDEX "idx_ai_messages_session_sequence" ON "public"."child_ai_messages" USING "btree" ("session_id", "sequence_number");



CREATE INDEX "idx_ai_sessions_employee_id" ON "public"."main_ai_sessions" USING "btree" ("employee_id");



CREATE INDEX "idx_ai_sessions_last_message" ON "public"."main_ai_sessions" USING "btree" ("last_message_at" DESC);



CREATE INDEX "idx_ai_sessions_updated_at" ON "public"."main_ai_sessions" USING "btree" ("updated_at" DESC);



CREATE INDEX "idx_announcement_files_announcement_id" ON "public"."child_announcement_files" USING "btree" ("announcement_id");



CREATE INDEX "idx_announcement_photos_announcement_id" ON "public"."child_announcement_photos" USING "btree" ("announcement_id");



CREATE INDEX "idx_announcements_created_at" ON "public"."main_announcements" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_appointment_approval_users_employee_id" ON "public"."jct_appointment_approvers" USING "btree" ("employee_id");



CREATE UNIQUE INDEX "idx_appointment_approval_users_employee_id_unique" ON "public"."jct_appointment_approvers" USING "btree" ("employee_id");



CREATE INDEX "idx_appointments_date" ON "public"."main_appointments" USING "btree" ("appointment_date");



CREATE INDEX "idx_appointments_date_approved" ON "public"."main_appointments" USING "btree" ("appointment_date", "is_approved");



CREATE INDEX "idx_background_jobs_created_by" ON "public"."main_background_jobs" USING "btree" ("created_by");



CREATE INDEX "idx_background_jobs_type_status" ON "public"."main_background_jobs" USING "btree" ("job_type", "status");



CREATE INDEX "idx_child_company_comments_author_id" ON "public"."child_company_comments" USING "btree" ("author_id");



CREATE INDEX "idx_child_company_comments_company_id" ON "public"."child_company_comments" USING "btree" ("company_id");



CREATE INDEX "idx_child_company_comments_created_at" ON "public"."child_company_comments" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_child_company_comments_mentioned" ON "public"."child_company_comments" USING "gin" ("mentioned_employee_ids");



CREATE INDEX "idx_child_merchandise_location_building" ON "public"."child_merchandise_location" USING "btree" ("building") WHERE ("building" IS NOT NULL);



CREATE INDEX "idx_child_merchandise_location_floor" ON "public"."child_merchandise_location" USING "btree" ("floor") WHERE ("floor" IS NOT NULL);



CREATE INDEX "idx_child_merchandise_location_merchandise_id" ON "public"."child_merchandise_location" USING "btree" ("merchandise_id");



CREATE UNIQUE INDEX "idx_child_merchandise_location_unique" ON "public"."child_merchandise_location" USING "btree" ("merchandise_id");



CREATE INDEX "idx_child_site_comments_author_id" ON "public"."child_site_comments" USING "btree" ("author_id");



CREATE INDEX "idx_child_site_comments_created_at" ON "public"."child_site_comments" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_child_site_comments_mentioned" ON "public"."child_site_comments" USING "gin" ("mentioned_employee_ids");



CREATE INDEX "idx_child_site_comments_site_id" ON "public"."child_site_comments" USING "btree" ("site_id");



CREATE INDEX "idx_child_ticket_comments_author_id" ON "public"."child_ticket_comments" USING "btree" ("author_id");



CREATE INDEX "idx_child_ticket_comments_created_at" ON "public"."child_ticket_comments" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_child_ticket_comments_mentioned" ON "public"."child_ticket_comments" USING "gin" ("mentioned_employee_ids");



CREATE INDEX "idx_child_ticket_comments_ticket_id" ON "public"."child_ticket_comments" USING "btree" ("ticket_id");



CREATE INDEX "idx_child_ticket_ratings_rated_at" ON "public"."child_ticket_ratings" USING "btree" ("rated_at" DESC);



CREATE INDEX "idx_child_ticket_ratings_rated_by" ON "public"."child_ticket_ratings" USING "btree" ("rated_by_employee_id");



CREATE INDEX "idx_child_ticket_ratings_ticket_id" ON "public"."child_ticket_ratings" USING "btree" ("ticket_id");



CREATE INDEX "idx_child_ticket_work_givers_ticket_id" ON "public"."child_ticket_work_givers" USING "btree" ("ticket_id");



CREATE INDEX "idx_child_ticket_work_givers_work_giver_id" ON "public"."child_ticket_work_givers" USING "btree" ("work_giver_id");



CREATE INDEX "idx_comment_files_comment_id" ON "public"."child_comment_files" USING "btree" ("comment_id");



CREATE INDEX "idx_comment_photos_comment_id" ON "public"."child_comment_photos" USING "btree" ("comment_id");



CREATE INDEX "idx_companies_name_en" ON "public"."main_companies" USING "btree" ("name_en");



COMMENT ON INDEX "public"."idx_companies_name_en" IS 'B-tree index for exact and prefix searches on English company name';



CREATE INDEX "idx_companies_name_en_trgm" ON "public"."main_companies" USING "gin" ("name_en" "extensions"."gin_trgm_ops");



CREATE INDEX "idx_companies_name_th" ON "public"."main_companies" USING "btree" ("name_th");



COMMENT ON INDEX "public"."idx_companies_name_th" IS 'B-tree index for exact and prefix searches on Thai company name';



CREATE INDEX "idx_companies_name_th_trgm" ON "public"."main_companies" USING "gin" ("name_th" "extensions"."gin_trgm_ops");



CREATE INDEX "idx_companies_tax_id" ON "public"."main_companies" USING "btree" ("tax_id");



COMMENT ON INDEX "public"."idx_companies_tax_id" IS 'B-tree index for exact and prefix searches on tax ID';



CREATE INDEX "idx_companies_tax_id_trgm" ON "public"."main_companies" USING "gin" ("tax_id" "extensions"."gin_trgm_ops");



CREATE INDEX "idx_company_comment_files_comment_id" ON "public"."child_company_comment_files" USING "btree" ("comment_id");



CREATE INDEX "idx_company_comment_photos_comment_id" ON "public"."child_company_comment_photos" USING "btree" ("comment_id");



CREATE INDEX "idx_contacts_site_id" ON "public"."child_site_contacts" USING "btree" ("site_id");



CREATE INDEX "idx_districts_coordinates" ON "public"."ref_districts" USING "btree" ("latitude", "longitude") WHERE ("latitude" IS NOT NULL);



CREATE INDEX "idx_districts_province_id" ON "public"."ref_districts" USING "btree" ("province_id");



CREATE UNIQUE INDEX "idx_employee_line_accounts_employee" ON "public"."child_employee_line_accounts" USING "btree" ("employee_id");



CREATE UNIQUE INDEX "idx_employee_line_accounts_line_user" ON "public"."child_employee_line_accounts" USING "btree" ("line_user_id");



CREATE INDEX "idx_employee_site_trainings_employee_id" ON "public"."jct_site_employee_trainings" USING "btree" ("employee_id");



CREATE INDEX "idx_employee_site_trainings_site_id" ON "public"."jct_site_employee_trainings" USING "btree" ("site_id");



CREATE UNIQUE INDEX "idx_employee_site_trainings_unique" ON "public"."jct_site_employee_trainings" USING "btree" ("employee_id", "site_id");



CREATE INDEX "idx_employees_active_role" ON "public"."main_employees" USING "btree" ("is_active", "role_id") WHERE ("is_active" = true);



CREATE INDEX "idx_employees_auth_user_id" ON "public"."main_employees" USING "btree" ("auth_user_id");



CREATE INDEX "idx_employees_code" ON "public"."main_employees" USING "btree" ("code");



CREATE INDEX "idx_employees_email_trgm" ON "public"."main_employees" USING "gin" ("email" "extensions"."gin_trgm_ops");



CREATE INDEX "idx_employees_is_active" ON "public"."main_employees" USING "btree" ("is_active");



CREATE INDEX "idx_employees_name_trgm" ON "public"."main_employees" USING "gin" ("name" "extensions"."gin_trgm_ops");



CREATE INDEX "idx_employees_nickname_trgm" ON "public"."main_employees" USING "gin" ("nickname" "extensions"."gin_trgm_ops");



CREATE INDEX "idx_employees_role_id" ON "public"."main_employees" USING "btree" ("role_id");



CREATE INDEX "idx_feature_is_active" ON "public"."main_features" USING "btree" ("is_active");



CREATE INDEX "idx_fleet_garages_active" ON "public"."fleet_garages" USING "btree" ("is_active") WHERE ("is_active" = true);



CREATE INDEX "idx_fleet_history_recorded" ON "public"."fleet_vehicle_history" USING "btree" ("recorded_at");



CREATE INDEX "idx_fleet_history_vehicle" ON "public"."fleet_vehicle_history" USING "btree" ("vehicle_id");



CREATE INDEX "idx_fleet_vehicles_garage" ON "public"."fleet_vehicles" USING "btree" ("current_garage_id") WHERE ("current_garage_id" IS NOT NULL);



CREATE INDEX "idx_fleet_vehicles_last_sync" ON "public"."fleet_vehicles" USING "btree" ("last_sync_at");



CREATE INDEX "idx_fleet_vehicles_plate" ON "public"."fleet_vehicles" USING "btree" ("plate_number");



CREATE INDEX "idx_fleet_vehicles_status" ON "public"."fleet_vehicles" USING "btree" ("status");



CREATE INDEX "idx_idempotency_keys_created_at" ON "public"."sys_idempotency_keys" USING "btree" ("created_at");



CREATE INDEX "idx_idempotency_keys_employee" ON "public"."sys_idempotency_keys" USING "btree" ("employee_id");



CREATE INDEX "idx_idempotency_keys_expires_at" ON "public"."sys_idempotency_keys" USING "btree" ("expires_at");



CREATE INDEX "idx_idempotency_keys_key" ON "public"."sys_idempotency_keys" USING "btree" ("idempotency_key");



CREATE INDEX "idx_idempotency_keys_key_operation" ON "public"."sys_idempotency_keys" USING "btree" ("idempotency_key", "operation_type");



CREATE INDEX "idx_jct_fleet_vehicle_employees_employee" ON "public"."jct_fleet_vehicle_employees" USING "btree" ("employee_id");



CREATE INDEX "idx_jct_fleet_vehicle_employees_vehicle" ON "public"."jct_fleet_vehicle_employees" USING "btree" ("vehicle_id");



CREATE INDEX "idx_jct_ticket_watchers_employee_id" ON "public"."jct_ticket_watchers" USING "btree" ("employee_id");



CREATE INDEX "idx_jct_ticket_watchers_ticket_id" ON "public"."jct_ticket_watchers" USING "btree" ("ticket_id");



CREATE UNIQUE INDEX "idx_jct_ticket_watchers_unique" ON "public"."jct_ticket_watchers" USING "btree" ("ticket_id", "employee_id");



CREATE INDEX "idx_leave_balances_employee_id" ON "public"."child_employee_leave_balances" USING "btree" ("employee_id");



CREATE INDEX "idx_leave_requests_employee_id" ON "public"."child_employee_leave_requests" USING "btree" ("employee_id");



CREATE INDEX "idx_leave_requests_status" ON "public"."child_employee_leave_requests" USING "btree" ("status");



CREATE INDEX "idx_leave_types_code" ON "public"."ref_leave_types" USING "btree" ("code");



CREATE UNIQUE INDEX "idx_main_companies_tax_id" ON "public"."main_companies" USING "btree" ("tax_id");



CREATE INDEX "idx_main_merchandise_dealer_id" ON "public"."main_merchandise" USING "btree" ("dealer_id");



CREATE INDEX "idx_main_merchandise_distributor_id" ON "public"."main_merchandise" USING "btree" ("distributor_id");



CREATE INDEX "idx_main_models_category" ON "public"."main_models" USING "btree" ("category");



CREATE INDEX "idx_main_models_has_serial" ON "public"."main_models" USING "btree" ("has_serial");



CREATE INDEX "idx_main_models_is_active" ON "public"."main_models" USING "btree" ("is_active");



CREATE INDEX "idx_main_notifications_created_at" ON "public"."main_notifications" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_main_notifications_dedup" ON "public"."main_notifications" USING "btree" ("recipient_id", "ticket_id", "type", "created_at" DESC);



CREATE INDEX "idx_main_notifications_recipient_id" ON "public"."main_notifications" USING "btree" ("recipient_id");



CREATE INDEX "idx_main_notifications_recipient_unread" ON "public"."main_notifications" USING "btree" ("recipient_id") WHERE ("is_read" = false);



CREATE INDEX "idx_main_notifications_ticket_id" ON "public"."main_notifications" USING "btree" ("ticket_id");



CREATE INDEX "idx_main_notifications_type" ON "public"."main_notifications" USING "btree" ("type");



CREATE INDEX "idx_main_sites_company_id" ON "public"."main_sites" USING "btree" ("company_id");



CREATE INDEX "idx_main_todos_assignee_id" ON "public"."main_todos" USING "btree" ("assignee_id");



CREATE INDEX "idx_main_todos_creator_id" ON "public"."main_todos" USING "btree" ("creator_id");



CREATE INDEX "idx_main_todos_deadline" ON "public"."main_todos" USING "btree" ("deadline");



CREATE INDEX "idx_main_todos_is_completed" ON "public"."main_todos" USING "btree" ("is_completed");



CREATE INDEX "idx_main_todos_pending_notification" ON "public"."main_todos" USING "btree" ("deadline") WHERE (("notified_at" IS NULL) AND ("is_completed" = false));



CREATE INDEX "idx_main_todos_ticket_id" ON "public"."main_todos" USING "btree" ("ticket_id") WHERE ("ticket_id" IS NOT NULL);



CREATE INDEX "idx_merchandise_model_id" ON "public"."main_merchandise" USING "btree" ("model_id");



CREATE INDEX "idx_merchandise_replaced_by_id" ON "public"."main_merchandise" USING "btree" ("replaced_by_id");



CREATE INDEX "idx_merchandise_serial_no" ON "public"."main_merchandise" USING "btree" ("serial_no");



CREATE INDEX "idx_merchandise_site_id" ON "public"."main_merchandise" USING "btree" ("site_id");



CREATE INDEX "idx_model_package_items_item_id" ON "public"."jct_model_components" USING "btree" ("component_model_id");



CREATE INDEX "idx_model_package_items_model_id" ON "public"."jct_model_components" USING "btree" ("model_id");



CREATE INDEX "idx_model_package_services_model_id" ON "public"."jct_model_package_services" USING "btree" ("model_id");



CREATE INDEX "idx_model_package_services_service_id" ON "public"."jct_model_package_services" USING "btree" ("service_id");



CREATE INDEX "idx_models_model" ON "public"."main_models" USING "btree" ("model");



CREATE INDEX "idx_package_services_category" ON "public"."ref_package_services" USING "btree" ("category");



CREATE INDEX "idx_package_services_is_active" ON "public"."ref_package_services" USING "btree" ("is_active");



CREATE INDEX "idx_ref_stock_location_types_active" ON "public"."ref_stock_location_types" USING "btree" ("is_active") WHERE ("is_active" = true);



CREATE INDEX "idx_ref_stock_location_types_code" ON "public"."ref_stock_location_types" USING "btree" ("code");



CREATE INDEX "idx_ref_work_givers_code" ON "public"."ref_work_givers" USING "btree" ("code");



CREATE INDEX "idx_ref_work_givers_is_active" ON "public"."ref_work_givers" USING "btree" ("is_active");



CREATE INDEX "idx_roles_code" ON "public"."main_org_roles" USING "btree" ("code");



CREATE INDEX "idx_roles_department_id" ON "public"."main_org_roles" USING "btree" ("department_id");



CREATE INDEX "idx_route_optimization_jobs_created_by" ON "public"."main_route_optimization_jobs" USING "btree" ("created_by", "created_at" DESC);



CREATE INDEX "idx_route_optimization_jobs_status" ON "public"."main_route_optimization_jobs" USING "btree" ("status", "created_at");



CREATE INDEX "idx_serial_items_location" ON "public"."main_stock_serial_items" USING "btree" ("location_id") WHERE ("location_id" IS NOT NULL);



CREATE INDEX "idx_serial_items_package_item" ON "public"."main_stock_serial_items" USING "btree" ("model_id");



CREATE INDEX "idx_serial_items_serial_no" ON "public"."main_stock_serial_items" USING "btree" ("serial_no");



CREATE INDEX "idx_serial_items_status" ON "public"."main_stock_serial_items" USING "btree" ("status");



CREATE INDEX "idx_serial_items_ticket" ON "public"."main_stock_serial_items" USING "btree" ("ticket_id") WHERE ("ticket_id" IS NOT NULL);



CREATE INDEX "idx_serial_movements_date" ON "public"."child_stock_serial_movements" USING "btree" ("performed_at" DESC);



CREATE INDEX "idx_serial_movements_item" ON "public"."child_stock_serial_movements" USING "btree" ("serial_item_id");



CREATE INDEX "idx_serial_movements_ticket" ON "public"."child_stock_serial_movements" USING "btree" ("ticket_id") WHERE ("ticket_id" IS NOT NULL);



CREATE INDEX "idx_serial_movements_type" ON "public"."child_stock_serial_movements" USING "btree" ("movement_type");



CREATE INDEX "idx_site_comment_files_comment_id" ON "public"."child_site_comment_files" USING "btree" ("comment_id");



CREATE INDEX "idx_site_comment_photos_comment_id" ON "public"."child_site_comment_photos" USING "btree" ("comment_id");



CREATE INDEX "idx_sites_address_detail_trgm" ON "public"."main_sites" USING "gin" ("address_detail" "extensions"."gin_trgm_ops");



CREATE INDEX "idx_sites_is_main_branch" ON "public"."main_sites" USING "btree" ("is_main_branch");



CREATE INDEX "idx_sites_name_trgm" ON "public"."main_sites" USING "gin" ("name" "extensions"."gin_trgm_ops");



CREATE INDEX "idx_staged_files_employee" ON "public"."main_staged_files" USING "btree" ("employee_id");



CREATE INDEX "idx_staged_files_expires" ON "public"."main_staged_files" USING "btree" ("expires_at") WHERE ("status" = ANY (ARRAY['pending'::"text", 'linked'::"text"]));



CREATE INDEX "idx_staged_files_pending_approval" ON "public"."main_staged_files" USING "btree" ("status", "created_at") WHERE ("status" = 'linked'::"text");



CREATE INDEX "idx_staged_files_status" ON "public"."main_staged_files" USING "btree" ("status");



CREATE INDEX "idx_staged_files_ticket" ON "public"."main_staged_files" USING "btree" ("ticket_id") WHERE ("ticket_id" IS NOT NULL);



CREATE INDEX "idx_stock_items_has_stock" ON "public"."main_stock_items" USING "btree" ("location_id") WHERE ("quantity" > 0);



CREATE INDEX "idx_stock_items_location" ON "public"."main_stock_items" USING "btree" ("location_id");



CREATE INDEX "idx_stock_items_location_model" ON "public"."main_stock_items" USING "btree" ("location_id", "model_id");



CREATE INDEX "idx_stock_items_low_stock" ON "public"."main_stock_items" USING "btree" ("location_id", "quantity") WHERE ("quantity" <= "minimum_quantity");



CREATE INDEX "idx_stock_items_package_item" ON "public"."main_stock_items" USING "btree" ("model_id");



CREATE INDEX "idx_stock_locations_active" ON "public"."main_stock_locations" USING "btree" ("is_active") WHERE ("is_active" = true);



CREATE INDEX "idx_stock_locations_code" ON "public"."main_stock_locations" USING "btree" ("code");



CREATE INDEX "idx_stock_locations_employee" ON "public"."main_stock_locations" USING "btree" ("employee_id") WHERE ("employee_id" IS NOT NULL);



CREATE INDEX "idx_stock_locations_site" ON "public"."main_stock_locations" USING "btree" ("site_id") WHERE ("site_id" IS NOT NULL);



CREATE INDEX "idx_stock_locations_type" ON "public"."main_stock_locations" USING "btree" ("location_type_id");



CREATE INDEX "idx_stock_movements_date" ON "public"."child_stock_movements" USING "btree" ("performed_at" DESC);



CREATE INDEX "idx_stock_movements_item" ON "public"."child_stock_movements" USING "btree" ("stock_item_id");



CREATE INDEX "idx_stock_movements_item_date" ON "public"."child_stock_movements" USING "btree" ("stock_item_id", "performed_at" DESC);



CREATE INDEX "idx_stock_movements_performed_by" ON "public"."child_stock_movements" USING "btree" ("performed_by");



CREATE INDEX "idx_stock_movements_reference" ON "public"."child_stock_movements" USING "btree" ("reference_id", "reference_type") WHERE ("reference_id" IS NOT NULL);



CREATE INDEX "idx_stock_movements_type" ON "public"."child_stock_movements" USING "btree" ("movement_type");



CREATE INDEX "idx_sub_districts_district_id" ON "public"."ref_sub_districts" USING "btree" ("district_id");



CREATE INDEX "idx_sub_districts_zip_code" ON "public"."ref_sub_districts" USING "btree" ("zip_code");



CREATE INDEX "idx_ticket_audit_action" ON "public"."child_ticket_audit" USING "btree" ("action");



CREATE INDEX "idx_ticket_audit_changed_by" ON "public"."child_ticket_audit" USING "btree" ("changed_by");



CREATE INDEX "idx_ticket_audit_created_at" ON "public"."child_ticket_audit" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_ticket_audit_ticket_created" ON "public"."child_ticket_audit" USING "btree" ("ticket_id", "created_at" DESC);



CREATE INDEX "idx_ticket_audit_ticket_id" ON "public"."child_ticket_audit" USING "btree" ("ticket_id");



CREATE INDEX "idx_ticket_employees_cf_confirmed_by" ON "public"."jct_ticket_employees_cf" USING "btree" ("confirmed_by");



CREATE INDEX "idx_ticket_employees_cf_date" ON "public"."jct_ticket_employees_cf" USING "btree" ("date");



CREATE INDEX "idx_ticket_employees_cf_employee_id" ON "public"."jct_ticket_employees_cf" USING "btree" ("employee_id");



CREATE INDEX "idx_ticket_employees_cf_employee_ticket" ON "public"."jct_ticket_employees_cf" USING "btree" ("employee_id", "ticket_id");



CREATE INDEX "idx_ticket_employees_cf_ticket_id" ON "public"."jct_ticket_employees_cf" USING "btree" ("ticket_id");



CREATE UNIQUE INDEX "idx_ticket_employees_cf_unique" ON "public"."jct_ticket_employees_cf" USING "btree" ("ticket_id", "employee_id", "date");



CREATE INDEX "idx_ticket_employees_date" ON "public"."jct_ticket_employees" USING "btree" ("date");



CREATE INDEX "idx_ticket_employees_employee_id" ON "public"."jct_ticket_employees" USING "btree" ("employee_id");



CREATE INDEX "idx_ticket_employees_is_key_employee" ON "public"."jct_ticket_employees" USING "btree" ("is_key_employee");



CREATE INDEX "idx_ticket_employees_ticket_id" ON "public"."jct_ticket_employees" USING "btree" ("ticket_id");



CREATE INDEX "idx_ticket_extra_fields_key" ON "public"."child_ticket_extra_fields" USING "btree" ("field_key");



CREATE INDEX "idx_ticket_extra_fields_ticket_id" ON "public"."child_ticket_extra_fields" USING "btree" ("ticket_id");



CREATE INDEX "idx_ticket_files_ticket_id" ON "public"."child_ticket_files" USING "btree" ("ticket_id");



CREATE INDEX "idx_ticket_files_uploaded_by" ON "public"."child_ticket_files" USING "btree" ("uploaded_by");



CREATE INDEX "idx_ticket_merchandise_merchandise_id" ON "public"."jct_ticket_merchandise" USING "btree" ("merchandise_id");



CREATE INDEX "idx_ticket_merchandise_ticket_id" ON "public"."jct_ticket_merchandise" USING "btree" ("ticket_id");



CREATE UNIQUE INDEX "idx_ticket_merchandise_unique" ON "public"."jct_ticket_merchandise" USING "btree" ("ticket_id", "merchandise_id");



CREATE INDEX "idx_ticket_photos_ticket_id" ON "public"."child_ticket_photos" USING "btree" ("ticket_id");



CREATE INDEX "idx_ticket_photos_uploaded_by" ON "public"."child_ticket_photos" USING "btree" ("uploaded_by");



CREATE INDEX "idx_ticket_stock_items_consumed_by" ON "public"."jct_ticket_stock_items" USING "btree" ("consumed_by");



CREATE INDEX "idx_ticket_stock_items_package" ON "public"."jct_ticket_stock_items" USING "btree" ("model_id");



CREATE INDEX "idx_ticket_stock_items_status" ON "public"."jct_ticket_stock_items" USING "btree" ("status");



CREATE INDEX "idx_ticket_stock_items_stock" ON "public"."jct_ticket_stock_items" USING "btree" ("stock_item_id");



CREATE INDEX "idx_ticket_stock_items_ticket" ON "public"."jct_ticket_stock_items" USING "btree" ("ticket_id");



CREATE INDEX "idx_ticket_work_estimates_ticket_id" ON "public"."child_ticket_work_estimates" USING "btree" ("ticket_id");



CREATE INDEX "idx_ticket_work_givers_ticket" ON "public"."child_ticket_work_givers" USING "btree" ("ticket_id");



CREATE INDEX "idx_tickets_appointment_id" ON "public"."main_tickets" USING "btree" ("appointment_id");



CREATE INDEX "idx_tickets_assigner_id" ON "public"."main_tickets" USING "btree" ("assigner_id");



CREATE INDEX "idx_tickets_created_at" ON "public"."main_tickets" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_tickets_created_by" ON "public"."main_tickets" USING "btree" ("created_by");



CREATE INDEX "idx_tickets_details_trgm" ON "public"."main_tickets" USING "gin" ("details" "extensions"."gin_trgm_ops");



CREATE INDEX "idx_tickets_site_id" ON "public"."main_tickets" USING "btree" ("site_id");



CREATE INDEX "idx_tickets_status_created" ON "public"."main_tickets" USING "btree" ("status_id", "created_at" DESC);



CREATE INDEX "idx_tickets_status_id" ON "public"."main_tickets" USING "btree" ("status_id");



CREATE INDEX "idx_tickets_ticket_code" ON "public"."main_tickets" USING "btree" ("ticket_code");



CREATE INDEX "idx_tickets_ticket_number" ON "public"."main_tickets" USING "btree" ("ticket_number");



CREATE INDEX "idx_tickets_work_type_id" ON "public"."main_tickets" USING "btree" ("work_type_id");



CREATE INDEX "idx_tickets_worktype_created" ON "public"."main_tickets" USING "btree" ("work_type_id", "created_at" DESC);



CREATE OR REPLACE TRIGGER "set_child_employee_line_accounts_updated_at" BEFORE UPDATE ON "public"."child_employee_line_accounts" FOR EACH ROW EXECUTE FUNCTION "public"."fn_trg_set_updated_at"();



CREATE OR REPLACE TRIGGER "set_child_merchandise_location_updated_at" BEFORE UPDATE ON "public"."child_merchandise_location" FOR EACH ROW EXECUTE FUNCTION "public"."fn_trg_set_updated_at"();



CREATE OR REPLACE TRIGGER "set_main_staged_files_updated_at" BEFORE UPDATE ON "public"."main_staged_files" FOR EACH ROW EXECUTE FUNCTION "public"."fn_trg_set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_child_employee_leave_balances_updated_at" BEFORE UPDATE ON "public"."child_employee_leave_balances" FOR EACH ROW EXECUTE FUNCTION "public"."fn_trg_set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_child_employee_leave_requests_updated_at" BEFORE UPDATE ON "public"."child_employee_leave_requests" FOR EACH ROW EXECUTE FUNCTION "public"."fn_trg_set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_child_site_contacts_updated_at" BEFORE UPDATE ON "public"."child_site_contacts" FOR EACH ROW EXECUTE FUNCTION "public"."fn_trg_set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_fleet_vehicle_status_change" AFTER UPDATE OF "status" ON "public"."fleet_vehicles" FOR EACH ROW WHEN (("old"."status" IS DISTINCT FROM "new"."status")) EXECUTE FUNCTION "public"."notify_fleet_status_change"();



CREATE OR REPLACE TRIGGER "trg_generate_ticket_code" BEFORE INSERT ON "public"."main_tickets" FOR EACH ROW EXECUTE FUNCTION "public"."generate_ticket_code"();



CREATE OR REPLACE TRIGGER "trg_jct_appointment_approvers_updated_at" BEFORE UPDATE ON "public"."jct_appointment_approvers" FOR EACH ROW EXECUTE FUNCTION "public"."fn_trg_set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_jct_ticket_merchandise_validate" BEFORE INSERT OR UPDATE ON "public"."jct_ticket_merchandise" FOR EACH ROW EXECUTE FUNCTION "public"."fn_trg_validate_ticket_merch"();



COMMENT ON TRIGGER "trg_jct_ticket_merchandise_validate" ON "public"."jct_ticket_merchandise" IS 'Validates that merchandise belongs to the same site as the ticket';



CREATE OR REPLACE TRIGGER "trg_main_announcements_updated_at" BEFORE UPDATE ON "public"."main_announcements" FOR EACH ROW EXECUTE FUNCTION "public"."fn_trg_set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_main_appointments_updated_at" BEFORE UPDATE ON "public"."main_appointments" FOR EACH ROW EXECUTE FUNCTION "public"."fn_trg_set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_main_companies_updated_at" BEFORE UPDATE ON "public"."main_companies" FOR EACH ROW EXECUTE FUNCTION "public"."fn_trg_set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_main_employees_updated_at" BEFORE UPDATE ON "public"."main_employees" FOR EACH ROW EXECUTE FUNCTION "public"."fn_trg_set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_main_features_updated_at" BEFORE UPDATE ON "public"."main_features" FOR EACH ROW EXECUTE FUNCTION "public"."fn_trg_set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_main_merchandise_updated_at" BEFORE UPDATE ON "public"."main_merchandise" FOR EACH ROW EXECUTE FUNCTION "public"."fn_trg_set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_main_models_updated_at" BEFORE UPDATE ON "public"."main_models" FOR EACH ROW EXECUTE FUNCTION "public"."fn_trg_set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_main_org_departments_updated_at" BEFORE UPDATE ON "public"."main_org_departments" FOR EACH ROW EXECUTE FUNCTION "public"."fn_trg_set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_main_org_roles_updated_at" BEFORE UPDATE ON "public"."main_org_roles" FOR EACH ROW EXECUTE FUNCTION "public"."fn_trg_set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_main_tickets_updated_at" BEFORE UPDATE ON "public"."main_tickets" FOR EACH ROW EXECUTE FUNCTION "public"."fn_trg_set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_ref_leave_types_updated_at" BEFORE UPDATE ON "public"."ref_leave_types" FOR EACH ROW EXECUTE FUNCTION "public"."fn_trg_set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_ref_package_services_updated_at" BEFORE UPDATE ON "public"."ref_package_services" FOR EACH ROW EXECUTE FUNCTION "public"."fn_trg_set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_ref_ticket_statuses_updated_at" BEFORE UPDATE ON "public"."ref_ticket_statuses" FOR EACH ROW EXECUTE FUNCTION "public"."fn_trg_set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_ref_ticket_work_types_updated_at" BEFORE UPDATE ON "public"."ref_ticket_work_types" FOR EACH ROW EXECUTE FUNCTION "public"."fn_trg_set_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_ai_sessions_updated_at" BEFORE UPDATE ON "public"."main_ai_sessions" FOR EACH ROW EXECUTE FUNCTION "public"."update_ai_session_timestamp"();



ALTER TABLE ONLY "public"."addon_employee_achievements"
    ADD CONSTRAINT "addon_employee_achievements_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "public"."addon_achievement_goals"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."addon_employee_coupons"
    ADD CONSTRAINT "addon_employee_coupons_achievement_id_fkey" FOREIGN KEY ("achievement_id") REFERENCES "public"."addon_employee_achievements"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."child_ai_messages"
    ADD CONSTRAINT "child_ai_messages_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."main_ai_sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."child_announcement_files"
    ADD CONSTRAINT "child_announcement_files_ann_id_fkey" FOREIGN KEY ("announcement_id") REFERENCES "public"."main_announcements"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."child_announcement_photos"
    ADD CONSTRAINT "child_announcement_photos_ann_id_fkey" FOREIGN KEY ("announcement_id") REFERENCES "public"."main_announcements"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."child_comment_files"
    ADD CONSTRAINT "child_comment_files_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "public"."child_ticket_comments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."child_comment_photos"
    ADD CONSTRAINT "child_comment_photos_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "public"."child_ticket_comments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."child_company_comment_files"
    ADD CONSTRAINT "child_company_comment_files_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "public"."child_company_comments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."child_company_comment_photos"
    ADD CONSTRAINT "child_company_comment_photos_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "public"."child_company_comments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."child_company_comments"
    ADD CONSTRAINT "child_company_comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."main_employees"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."child_company_comments"
    ADD CONSTRAINT "child_company_comments_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."main_companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."child_employee_leave_balances"
    ADD CONSTRAINT "child_employee_leave_balances_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."main_employees"("id");



ALTER TABLE ONLY "public"."child_employee_leave_balances"
    ADD CONSTRAINT "child_employee_leave_balances_type_id_fkey" FOREIGN KEY ("leave_type_id") REFERENCES "public"."ref_leave_types"("id");



ALTER TABLE ONLY "public"."child_employee_leave_requests"
    ADD CONSTRAINT "child_employee_leave_requests_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "public"."main_employees"("id");



ALTER TABLE ONLY "public"."child_employee_leave_requests"
    ADD CONSTRAINT "child_employee_leave_requests_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."main_employees"("id");



ALTER TABLE ONLY "public"."child_employee_leave_requests"
    ADD CONSTRAINT "child_employee_leave_requests_type_id_fkey" FOREIGN KEY ("leave_type_id") REFERENCES "public"."ref_leave_types"("id");



ALTER TABLE ONLY "public"."child_employee_line_accounts"
    ADD CONSTRAINT "child_employee_line_accounts_active_ticket_id_fkey" FOREIGN KEY ("active_ticket_id") REFERENCES "public"."main_tickets"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."child_employee_line_accounts"
    ADD CONSTRAINT "child_employee_line_accounts_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."main_employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."child_merchandise_location"
    ADD CONSTRAINT "child_merchandise_location_merchandise_id_fkey" FOREIGN KEY ("merchandise_id") REFERENCES "public"."main_merchandise"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."child_site_comment_files"
    ADD CONSTRAINT "child_site_comment_files_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "public"."child_site_comments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."child_site_comment_photos"
    ADD CONSTRAINT "child_site_comment_photos_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "public"."child_site_comments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."child_site_comments"
    ADD CONSTRAINT "child_site_comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."main_employees"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."child_site_comments"
    ADD CONSTRAINT "child_site_comments_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."main_sites"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."child_site_contacts"
    ADD CONSTRAINT "child_site_contacts_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."main_sites"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."child_stock_movements"
    ADD CONSTRAINT "child_stock_movements_performed_by_fkey" FOREIGN KEY ("performed_by") REFERENCES "public"."main_employees"("id");



ALTER TABLE ONLY "public"."child_stock_movements"
    ADD CONSTRAINT "child_stock_movements_related_location_id_fkey" FOREIGN KEY ("related_location_id") REFERENCES "public"."main_stock_locations"("id");



ALTER TABLE ONLY "public"."child_stock_movements"
    ADD CONSTRAINT "child_stock_movements_stock_item_id_fkey" FOREIGN KEY ("stock_item_id") REFERENCES "public"."main_stock_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."child_stock_serial_movements"
    ADD CONSTRAINT "child_stock_serial_movements_from_location_id_fkey" FOREIGN KEY ("from_location_id") REFERENCES "public"."main_stock_locations"("id");



ALTER TABLE ONLY "public"."child_stock_serial_movements"
    ADD CONSTRAINT "child_stock_serial_movements_performed_by_fkey" FOREIGN KEY ("performed_by") REFERENCES "public"."main_employees"("id");



ALTER TABLE ONLY "public"."child_stock_serial_movements"
    ADD CONSTRAINT "child_stock_serial_movements_serial_item_id_fkey" FOREIGN KEY ("serial_item_id") REFERENCES "public"."main_stock_serial_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."child_stock_serial_movements"
    ADD CONSTRAINT "child_stock_serial_movements_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "public"."main_tickets"("id");



ALTER TABLE ONLY "public"."child_stock_serial_movements"
    ADD CONSTRAINT "child_stock_serial_movements_to_location_id_fkey" FOREIGN KEY ("to_location_id") REFERENCES "public"."main_stock_locations"("id");



ALTER TABLE ONLY "public"."child_ticket_audit"
    ADD CONSTRAINT "child_ticket_audit_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "public"."main_employees"("id");



ALTER TABLE ONLY "public"."child_ticket_audit"
    ADD CONSTRAINT "child_ticket_audit_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "public"."main_tickets"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."child_ticket_comments"
    ADD CONSTRAINT "child_ticket_comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."main_employees"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."child_ticket_comments"
    ADD CONSTRAINT "child_ticket_comments_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "public"."main_tickets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."child_ticket_extra_fields"
    ADD CONSTRAINT "child_ticket_extra_fields_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."main_employees"("id");



ALTER TABLE ONLY "public"."child_ticket_extra_fields"
    ADD CONSTRAINT "child_ticket_extra_fields_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "public"."main_tickets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."child_ticket_files"
    ADD CONSTRAINT "child_ticket_files_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "public"."main_tickets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."child_ticket_files"
    ADD CONSTRAINT "child_ticket_files_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "public"."main_employees"("id");



ALTER TABLE ONLY "public"."child_ticket_photos"
    ADD CONSTRAINT "child_ticket_photos_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "public"."main_tickets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."child_ticket_photos"
    ADD CONSTRAINT "child_ticket_photos_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "public"."main_employees"("id");



ALTER TABLE ONLY "public"."child_ticket_work_estimates"
    ADD CONSTRAINT "child_ticket_work_estimates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."main_employees"("id");



ALTER TABLE ONLY "public"."child_ticket_work_estimates"
    ADD CONSTRAINT "child_ticket_work_estimates_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "public"."main_tickets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."child_ticket_work_givers"
    ADD CONSTRAINT "child_ticket_work_givers_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "public"."main_tickets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."child_ticket_work_givers"
    ADD CONSTRAINT "child_ticket_work_givers_work_giver_id_fkey" FOREIGN KEY ("work_giver_id") REFERENCES "public"."ref_work_givers"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."child_ticket_ratings"
    ADD CONSTRAINT "fk_rated_by_employee" FOREIGN KEY ("rated_by_employee_id") REFERENCES "public"."main_employees"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."child_ticket_ratings"
    ADD CONSTRAINT "fk_ticket" FOREIGN KEY ("ticket_id") REFERENCES "public"."main_tickets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."main_todos"
    ADD CONSTRAINT "fk_todo_assignee" FOREIGN KEY ("assignee_id") REFERENCES "public"."main_employees"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."main_todos"
    ADD CONSTRAINT "fk_todo_creator" FOREIGN KEY ("creator_id") REFERENCES "public"."main_employees"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."main_todos"
    ADD CONSTRAINT "fk_todo_ticket" FOREIGN KEY ("ticket_id") REFERENCES "public"."main_tickets"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."fleet_vehicle_history"
    ADD CONSTRAINT "fleet_vehicle_history_garage_id_fkey" FOREIGN KEY ("garage_id") REFERENCES "public"."fleet_garages"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."fleet_vehicle_history"
    ADD CONSTRAINT "fleet_vehicle_history_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "public"."fleet_vehicles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."fleet_vehicles"
    ADD CONSTRAINT "fleet_vehicles_current_garage_id_fkey" FOREIGN KEY ("current_garage_id") REFERENCES "public"."fleet_garages"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."jct_appointment_approvers"
    ADD CONSTRAINT "jct_appointment_approvers_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."main_employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."jct_fleet_vehicle_employees"
    ADD CONSTRAINT "jct_fleet_vehicle_employees_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."main_employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."jct_fleet_vehicle_employees"
    ADD CONSTRAINT "jct_fleet_vehicle_employees_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "public"."fleet_vehicles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."jct_model_components"
    ADD CONSTRAINT "jct_model_package_items_component_model_id_fkey" FOREIGN KEY ("component_model_id") REFERENCES "public"."main_models"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."jct_model_components"
    ADD CONSTRAINT "jct_model_package_items_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "public"."main_models"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."jct_model_package_services"
    ADD CONSTRAINT "jct_model_package_services_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "public"."main_models"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."jct_model_package_services"
    ADD CONSTRAINT "jct_model_package_services_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."ref_package_services"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."jct_site_employee_trainings"
    ADD CONSTRAINT "jct_site_employee_trainings_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."main_employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."jct_site_employee_trainings"
    ADD CONSTRAINT "jct_site_employee_trainings_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."main_sites"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."jct_ticket_employees_cf"
    ADD CONSTRAINT "jct_ticket_employees_cf_confirmed_by_fkey" FOREIGN KEY ("confirmed_by") REFERENCES "public"."main_employees"("id");



ALTER TABLE ONLY "public"."jct_ticket_employees_cf"
    ADD CONSTRAINT "jct_ticket_employees_cf_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."main_employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."jct_ticket_employees_cf"
    ADD CONSTRAINT "jct_ticket_employees_cf_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "public"."main_tickets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."jct_ticket_employees"
    ADD CONSTRAINT "jct_ticket_employees_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."main_employees"("id");



ALTER TABLE ONLY "public"."jct_ticket_employees"
    ADD CONSTRAINT "jct_ticket_employees_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "public"."main_tickets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."jct_ticket_merchandise"
    ADD CONSTRAINT "jct_ticket_merchandise_merch_id_fkey" FOREIGN KEY ("merchandise_id") REFERENCES "public"."main_merchandise"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."jct_ticket_merchandise"
    ADD CONSTRAINT "jct_ticket_merchandise_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "public"."main_tickets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."jct_ticket_stock_items"
    ADD CONSTRAINT "jct_ticket_stock_items_consumed_by_fkey" FOREIGN KEY ("consumed_by") REFERENCES "public"."main_employees"("id");



ALTER TABLE ONLY "public"."jct_ticket_stock_items"
    ADD CONSTRAINT "jct_ticket_stock_items_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "public"."main_models"("id");



ALTER TABLE ONLY "public"."jct_ticket_stock_items"
    ADD CONSTRAINT "jct_ticket_stock_items_stock_item_id_fkey" FOREIGN KEY ("stock_item_id") REFERENCES "public"."main_stock_items"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."jct_ticket_stock_items"
    ADD CONSTRAINT "jct_ticket_stock_items_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "public"."main_tickets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."jct_ticket_watchers"
    ADD CONSTRAINT "jct_ticket_watchers_added_by_fkey" FOREIGN KEY ("added_by") REFERENCES "public"."main_employees"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."jct_ticket_watchers"
    ADD CONSTRAINT "jct_ticket_watchers_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."main_employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."jct_ticket_watchers"
    ADD CONSTRAINT "jct_ticket_watchers_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "public"."main_tickets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."main_ai_sessions"
    ADD CONSTRAINT "main_ai_sessions_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."main_employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."main_background_jobs"
    ADD CONSTRAINT "main_background_jobs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."main_employees"("id");



ALTER TABLE ONLY "public"."main_employees"
    ADD CONSTRAINT "main_employees_auth_user_id_fkey" FOREIGN KEY ("auth_user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."main_employees"
    ADD CONSTRAINT "main_employees_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."main_org_roles"("id");



ALTER TABLE ONLY "public"."main_employees"
    ADD CONSTRAINT "main_employees_supervisor_id_fkey" FOREIGN KEY ("supervisor_id") REFERENCES "public"."main_employees"("id");



ALTER TABLE ONLY "public"."main_merchandise"
    ADD CONSTRAINT "main_merchandise_dealer_id_fkey" FOREIGN KEY ("dealer_id") REFERENCES "public"."main_companies"("id");



ALTER TABLE ONLY "public"."main_merchandise"
    ADD CONSTRAINT "main_merchandise_distributor_id_fkey" FOREIGN KEY ("distributor_id") REFERENCES "public"."main_companies"("id");



ALTER TABLE ONLY "public"."main_merchandise"
    ADD CONSTRAINT "main_merchandise_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "public"."main_models"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."main_merchandise"
    ADD CONSTRAINT "main_merchandise_replaced_by_id_fkey" FOREIGN KEY ("replaced_by_id") REFERENCES "public"."main_merchandise"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."main_merchandise"
    ADD CONSTRAINT "main_merchandise_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."main_sites"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."main_notifications"
    ADD CONSTRAINT "main_notifications_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."main_employees"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."main_notifications"
    ADD CONSTRAINT "main_notifications_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "public"."child_ticket_comments"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."main_notifications"
    ADD CONSTRAINT "main_notifications_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "public"."main_employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."main_notifications"
    ADD CONSTRAINT "main_notifications_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "public"."main_tickets"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."main_org_departments"
    ADD CONSTRAINT "main_org_departments_head_id_fkey" FOREIGN KEY ("head_id") REFERENCES "public"."main_employees"("id");



ALTER TABLE ONLY "public"."main_org_roles"
    ADD CONSTRAINT "main_org_roles_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."main_org_departments"("id");



ALTER TABLE ONLY "public"."main_route_optimization_jobs"
    ADD CONSTRAINT "main_route_optimization_jobs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."main_employees"("id");



ALTER TABLE ONLY "public"."main_sites"
    ADD CONSTRAINT "main_sites_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."main_companies"("id");



ALTER TABLE ONLY "public"."main_staged_files"
    ADD CONSTRAINT "main_staged_files_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "public"."main_employees"("id");



ALTER TABLE ONLY "public"."main_staged_files"
    ADD CONSTRAINT "main_staged_files_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."main_employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."main_staged_files"
    ADD CONSTRAINT "main_staged_files_result_comment_id_fkey" FOREIGN KEY ("result_comment_id") REFERENCES "public"."child_ticket_comments"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."main_staged_files"
    ADD CONSTRAINT "main_staged_files_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "public"."main_tickets"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."main_stock_items"
    ADD CONSTRAINT "main_stock_items_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."main_stock_locations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."main_stock_items"
    ADD CONSTRAINT "main_stock_items_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "public"."main_models"("id");



ALTER TABLE ONLY "public"."main_stock_locations"
    ADD CONSTRAINT "main_stock_locations_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."main_employees"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."main_stock_locations"
    ADD CONSTRAINT "main_stock_locations_location_type_id_fkey" FOREIGN KEY ("location_type_id") REFERENCES "public"."ref_stock_location_types"("id");



ALTER TABLE ONLY "public"."main_stock_locations"
    ADD CONSTRAINT "main_stock_locations_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."main_sites"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."main_stock_serial_items"
    ADD CONSTRAINT "main_stock_serial_items_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."main_stock_locations"("id");



ALTER TABLE ONLY "public"."main_stock_serial_items"
    ADD CONSTRAINT "main_stock_serial_items_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "public"."main_models"("id");



ALTER TABLE ONLY "public"."main_stock_serial_items"
    ADD CONSTRAINT "main_stock_serial_items_received_by_fkey" FOREIGN KEY ("received_by") REFERENCES "public"."main_employees"("id");



ALTER TABLE ONLY "public"."main_stock_serial_items"
    ADD CONSTRAINT "main_stock_serial_items_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."main_sites"("id");



ALTER TABLE ONLY "public"."main_stock_serial_items"
    ADD CONSTRAINT "main_stock_serial_items_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "public"."main_tickets"("id");



ALTER TABLE ONLY "public"."main_tickets"
    ADD CONSTRAINT "main_tickets_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "public"."main_appointments"("id");



ALTER TABLE ONLY "public"."main_tickets"
    ADD CONSTRAINT "main_tickets_assigner_id_fkey" FOREIGN KEY ("assigner_id") REFERENCES "public"."main_employees"("id");



ALTER TABLE ONLY "public"."main_tickets"
    ADD CONSTRAINT "main_tickets_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."child_site_contacts"("id");



ALTER TABLE ONLY "public"."main_tickets"
    ADD CONSTRAINT "main_tickets_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."main_employees"("id");



ALTER TABLE ONLY "public"."main_tickets"
    ADD CONSTRAINT "main_tickets_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."main_sites"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."main_tickets"
    ADD CONSTRAINT "main_tickets_status_id_fkey" FOREIGN KEY ("status_id") REFERENCES "public"."ref_ticket_statuses"("id");



ALTER TABLE ONLY "public"."main_tickets"
    ADD CONSTRAINT "main_tickets_work_type_id_fkey" FOREIGN KEY ("work_type_id") REFERENCES "public"."ref_ticket_work_types"("id");



ALTER TABLE ONLY "public"."ref_districts"
    ADD CONSTRAINT "ref_districts_province_id_fkey" FOREIGN KEY ("province_id") REFERENCES "public"."ref_provinces"("id");



ALTER TABLE ONLY "public"."ref_sub_districts"
    ADD CONSTRAINT "ref_sub_districts_district_id_fkey" FOREIGN KEY ("district_id") REFERENCES "public"."ref_districts"("id");



ALTER TABLE ONLY "public"."sys_idempotency_keys"
    ADD CONSTRAINT "sys_idempotency_keys_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."main_employees"("id");



CREATE POLICY "Admins can delete confirmations" ON "public"."jct_ticket_employees_cf" FOR DELETE USING (true);



CREATE POLICY "Admins can delete departments" ON "public"."main_org_departments" FOR DELETE USING (( SELECT "public"."fn_user_has_min_level"(5) AS "user_has_min_level"));



CREATE POLICY "Admins can insert departments" ON "public"."main_org_departments" FOR INSERT WITH CHECK (( SELECT "public"."fn_user_has_min_level"(5) AS "user_has_min_level"));



CREATE POLICY "Admins can update confirmations" ON "public"."jct_ticket_employees_cf" FOR UPDATE USING (true);



CREATE POLICY "Admins can update departments" ON "public"."main_org_departments" FOR UPDATE USING (( SELECT "public"."fn_user_has_min_level"(5) AS "user_has_min_level"));



CREATE POLICY "Allow all users to read districts" ON "public"."ref_districts" FOR SELECT USING (true);



CREATE POLICY "Allow all users to read provinces" ON "public"."ref_provinces" FOR SELECT USING (true);



CREATE POLICY "Allow all users to read sub_districts" ON "public"."ref_sub_districts" FOR SELECT USING (true);



CREATE POLICY "Allow authenticated delete" ON "public"."child_ticket_extra_fields" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated delete for comment files" ON "public"."child_comment_files" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated delete for comment photos" ON "public"."child_comment_photos" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated delete for company comment files" ON "public"."child_company_comment_files" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated delete for company comment photos" ON "public"."child_company_comment_photos" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated delete for site comment files" ON "public"."child_site_comment_files" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated delete for site comment photos" ON "public"."child_site_comment_photos" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated insert" ON "public"."child_ticket_extra_fields" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Allow authenticated insert for comment files" ON "public"."child_comment_files" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Allow authenticated insert for comment photos" ON "public"."child_comment_photos" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Allow authenticated insert for company comment files" ON "public"."child_company_comment_files" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Allow authenticated insert for company comment photos" ON "public"."child_company_comment_photos" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Allow authenticated insert for site comment files" ON "public"."child_site_comment_files" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Allow authenticated insert for site comment photos" ON "public"."child_site_comment_photos" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Allow authenticated read" ON "public"."child_ticket_extra_fields" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated read for comment files" ON "public"."child_comment_files" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated read for comment photos" ON "public"."child_comment_photos" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated read for company comment files" ON "public"."child_company_comment_files" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated read for company comment photos" ON "public"."child_company_comment_photos" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated read for site comment files" ON "public"."child_site_comment_files" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated read for site comment photos" ON "public"."child_site_comment_photos" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated update" ON "public"."child_ticket_extra_fields" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Allow authenticated users to delete work estimates" ON "public"."child_ticket_work_estimates" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated users to insert work estimates" ON "public"."child_ticket_work_estimates" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Allow authenticated users to read work estimates" ON "public"."child_ticket_work_estimates" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated users to update work estimates" ON "public"."child_ticket_work_estimates" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Allow service role full access to comment files" ON "public"."child_comment_files" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Allow service role full access to comment photos" ON "public"."child_comment_photos" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Allow service role full access to company comment files" ON "public"."child_company_comment_files" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Allow service role full access to company comment photos" ON "public"."child_company_comment_photos" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Allow service role full access to site comment files" ON "public"."child_site_comment_files" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Allow service role full access to site comment photos" ON "public"."child_site_comment_photos" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Anyone can view departments" ON "public"."main_org_departments" FOR SELECT USING (true);



CREATE POLICY "Approvers can confirm technicians" ON "public"."jct_ticket_employees_cf" FOR INSERT WITH CHECK (true);



CREATE POLICY "Authenticated can delete model_package_items" ON "public"."jct_model_components" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") IS NOT NULL));



CREATE POLICY "Authenticated can delete model_package_services" ON "public"."jct_model_package_services" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") IS NOT NULL));



CREATE POLICY "Authenticated can delete package_services" ON "public"."ref_package_services" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") IS NOT NULL));



CREATE POLICY "Authenticated can insert model_package_items" ON "public"."jct_model_components" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") IS NOT NULL));



CREATE POLICY "Authenticated can insert model_package_services" ON "public"."jct_model_package_services" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") IS NOT NULL));



CREATE POLICY "Authenticated can insert package_services" ON "public"."ref_package_services" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") IS NOT NULL));



CREATE POLICY "Authenticated can read model_package_items" ON "public"."jct_model_components" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") IS NOT NULL));



CREATE POLICY "Authenticated can read model_package_services" ON "public"."jct_model_package_services" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") IS NOT NULL));



CREATE POLICY "Authenticated can read package_services" ON "public"."ref_package_services" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") IS NOT NULL));



CREATE POLICY "Authenticated can update model_package_items" ON "public"."jct_model_components" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") IS NOT NULL));



CREATE POLICY "Authenticated can update model_package_services" ON "public"."jct_model_package_services" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") IS NOT NULL));



CREATE POLICY "Authenticated can update package_services" ON "public"."ref_package_services" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") IS NOT NULL));



CREATE POLICY "Authenticated users can delete staged files" ON "public"."main_staged_files" FOR DELETE USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Authenticated users can insert staged files" ON "public"."main_staged_files" FOR INSERT WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Authenticated users can read LINE accounts" ON "public"."child_employee_line_accounts" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Authenticated users can read child_stock_movements" ON "public"."child_stock_movements" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Authenticated users can read company comments" ON "public"."child_company_comments" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Authenticated users can read jct_ticket_stock_items" ON "public"."jct_ticket_stock_items" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Authenticated users can read main_stock_items" ON "public"."main_stock_items" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Authenticated users can read main_stock_locations" ON "public"."main_stock_locations" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Authenticated users can read merchandise locations" ON "public"."child_merchandise_location" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Authenticated users can read ref_stock_location_types" ON "public"."ref_stock_location_types" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Authenticated users can read site comments" ON "public"."child_site_comments" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Authenticated users can read staged files" ON "public"."main_staged_files" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Authenticated users can read ticket comments" ON "public"."child_ticket_comments" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Authenticated users can update staged files" ON "public"."main_staged_files" FOR UPDATE USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Authenticated users can view garages" ON "public"."fleet_garages" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can view history" ON "public"."fleet_vehicle_history" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can view jobs" ON "public"."main_background_jobs" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can view serial items" ON "public"."main_stock_serial_items" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can view serial movements" ON "public"."child_stock_serial_movements" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can view vehicle employees" ON "public"."jct_fleet_vehicle_employees" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can view vehicles" ON "public"."fleet_vehicles" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Level 0+ can read work givers" ON "public"."ref_work_givers" FOR SELECT USING (("public"."get_employee_level"() >= 0));



CREATE POLICY "Level 0+ can view ratings" ON "public"."child_ticket_ratings" FOR SELECT USING (("public"."get_employee_level"() >= 0));



CREATE POLICY "Level 1+ can create ratings" ON "public"."child_ticket_ratings" FOR INSERT WITH CHECK (("public"."get_employee_level"() >= 1));



CREATE POLICY "Level 1+ can create todos" ON "public"."main_todos" FOR INSERT WITH CHECK (("public"."get_employee_level"() >= 1));



CREATE POLICY "Level 1+ can delete ticket work givers" ON "public"."child_ticket_work_givers" FOR DELETE USING (("public"."get_employee_level"() >= 1));



CREATE POLICY "Level 1+ can insert announcement files" ON "public"."child_announcement_files" FOR INSERT WITH CHECK (( SELECT "public"."fn_user_has_min_level"(1) AS "user_has_min_level"));



CREATE POLICY "Level 1+ can insert announcement photos" ON "public"."child_announcement_photos" FOR INSERT WITH CHECK (( SELECT "public"."fn_user_has_min_level"(1) AS "user_has_min_level"));



CREATE POLICY "Level 1+ can insert announcements" ON "public"."main_announcements" FOR INSERT WITH CHECK (( SELECT "public"."fn_user_has_min_level"(1) AS "user_has_min_level"));



CREATE POLICY "Level 1+ can insert ticket work givers" ON "public"."child_ticket_work_givers" FOR INSERT WITH CHECK (("public"."get_employee_level"() >= 1));



CREATE POLICY "Level 1+ can read ticket work givers" ON "public"."child_ticket_work_givers" FOR SELECT USING (("public"."get_employee_level"() >= 1));



CREATE POLICY "Level 1+ can update ratings" ON "public"."child_ticket_ratings" FOR UPDATE USING (("public"."get_employee_level"() >= 1));



CREATE POLICY "Level 1+ can update ticket work givers" ON "public"."child_ticket_work_givers" FOR UPDATE USING (("public"."get_employee_level"() >= 1)) WITH CHECK (("public"."get_employee_level"() >= 1));



CREATE POLICY "Level 2+ can delete announcement files" ON "public"."child_announcement_files" FOR DELETE USING (( SELECT "public"."fn_user_has_min_level"(2) AS "user_has_min_level"));



CREATE POLICY "Level 2+ can delete announcement photos" ON "public"."child_announcement_photos" FOR DELETE USING (( SELECT "public"."fn_user_has_min_level"(2) AS "user_has_min_level"));



CREATE POLICY "Level 2+ can delete announcements" ON "public"."main_announcements" FOR DELETE USING (( SELECT "public"."fn_user_has_min_level"(2) AS "user_has_min_level"));



CREATE POLICY "Level 2+ can delete appointment approval users" ON "public"."jct_appointment_approvers" FOR DELETE USING (( SELECT "public"."fn_user_has_min_level"(2) AS "user_has_min_level"));



CREATE POLICY "Level 2+ can delete ratings" ON "public"."child_ticket_ratings" FOR DELETE USING (("public"."get_employee_level"() >= 2));



CREATE POLICY "Level 2+ can insert appointment approval users" ON "public"."jct_appointment_approvers" FOR INSERT WITH CHECK (( SELECT "public"."fn_user_has_min_level"(2) AS "user_has_min_level"));



CREATE POLICY "Level 2+ can manage garages" ON "public"."fleet_garages" TO "authenticated" USING (("public"."get_employee_level"() >= 2)) WITH CHECK (("public"."get_employee_level"() >= 2));



CREATE POLICY "Level 2+ can manage vehicle employees" ON "public"."jct_fleet_vehicle_employees" TO "authenticated" USING (("public"."get_employee_level"() >= 2)) WITH CHECK (("public"."get_employee_level"() >= 2));



CREATE POLICY "Level 2+ can update announcement files" ON "public"."child_announcement_files" FOR UPDATE USING (( SELECT "public"."fn_user_has_min_level"(2) AS "user_has_min_level"));



CREATE POLICY "Level 2+ can update announcement photos" ON "public"."child_announcement_photos" FOR UPDATE USING (( SELECT "public"."fn_user_has_min_level"(2) AS "user_has_min_level"));



CREATE POLICY "Level 2+ can update announcements" ON "public"."main_announcements" FOR UPDATE USING (( SELECT "public"."fn_user_has_min_level"(2) AS "user_has_min_level"));



CREATE POLICY "Level 2+ can update appointment approval users" ON "public"."jct_appointment_approvers" FOR UPDATE USING (( SELECT "public"."fn_user_has_min_level"(2) AS "user_has_min_level"));



CREATE POLICY "No deletes on notifications" ON "public"."main_notifications" FOR DELETE USING (false);



CREATE POLICY "No deletes to ticket audit logs" ON "public"."child_ticket_audit" FOR DELETE USING (false);



CREATE POLICY "No updates to ticket audit logs" ON "public"."child_ticket_audit" FOR UPDATE USING (false);



CREATE POLICY "Service role can delete main_stock_locations" ON "public"."main_stock_locations" FOR DELETE USING (true);



CREATE POLICY "Service role can insert main_stock_locations" ON "public"."main_stock_locations" FOR INSERT WITH CHECK (true);



CREATE POLICY "Service role can insert notifications" ON "public"."main_notifications" FOR INSERT WITH CHECK (false);



CREATE POLICY "Service role can insert ticket audit logs" ON "public"."child_ticket_audit" FOR INSERT WITH CHECK (false);



CREATE POLICY "Service role can manage LINE accounts" ON "public"."child_employee_line_accounts" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role can manage staged files" ON "public"."main_staged_files" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role can modify company comments" ON "public"."child_company_comments" USING (false) WITH CHECK (false);



CREATE POLICY "Service role can modify merchandise locations" ON "public"."child_merchandise_location" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role can modify site comments" ON "public"."child_site_comments" USING (false) WITH CHECK (false);



CREATE POLICY "Service role can modify ticket comments" ON "public"."child_ticket_comments" USING (false) WITH CHECK (false);



CREATE POLICY "Service role can modify work givers" ON "public"."ref_work_givers" USING (false) WITH CHECK (false);



CREATE POLICY "Service role can update main_stock_locations" ON "public"."main_stock_locations" FOR UPDATE USING (true) WITH CHECK (true);



CREATE POLICY "Service role full access" ON "public"."child_ticket_extra_fields" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role full access" ON "public"."main_route_optimization_jobs" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role full access to garages" ON "public"."fleet_garages" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role full access to history" ON "public"."fleet_vehicle_history" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role full access to ratings" ON "public"."child_ticket_ratings" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role full access to todos" ON "public"."main_todos" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role full access to vehicle employees" ON "public"."jct_fleet_vehicle_employees" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role full access to vehicles" ON "public"."fleet_vehicles" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role has full access to jobs" ON "public"."main_background_jobs" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role has full access to messages" ON "public"."child_ai_messages" USING ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text")) WITH CHECK ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));



CREATE POLICY "Service role has full access to serial items" ON "public"."main_stock_serial_items" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role has full access to serial movements" ON "public"."child_stock_serial_movements" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Users can create jobs" ON "public"."main_route_optimization_jobs" FOR INSERT TO "authenticated" WITH CHECK (("created_by" = ( SELECT "main_employees"."id"
   FROM "public"."main_employees"
  WHERE ("main_employees"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "Users can delete own todos" ON "public"."main_todos" FOR DELETE USING ((("creator_id" IN ( SELECT "main_employees"."id"
   FROM "public"."main_employees"
  WHERE ("main_employees"."auth_user_id" = "auth"."uid"()))) OR ("public"."get_employee_level"() >= 2)));



CREATE POLICY "Users can mark own notifications as read" ON "public"."main_notifications" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."main_employees" "e"
  WHERE (("e"."auth_user_id" = "auth"."uid"()) AND ("e"."id" = "main_notifications"."recipient_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."main_employees" "e"
  WHERE (("e"."auth_user_id" = "auth"."uid"()) AND ("e"."id" = "main_notifications"."recipient_id")))));



CREATE POLICY "Users can read announcement files" ON "public"."child_announcement_files" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") IS NOT NULL));



CREATE POLICY "Users can read announcement photos" ON "public"."child_announcement_photos" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") IS NOT NULL));



CREATE POLICY "Users can read announcements" ON "public"."main_announcements" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") IS NOT NULL));



CREATE POLICY "Users can read appointment approval users" ON "public"."jct_appointment_approvers" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") IS NOT NULL));



CREATE POLICY "Users can read confirmed technicians" ON "public"."jct_ticket_employees_cf" FOR SELECT USING (true);



CREATE POLICY "Users can read own notifications" ON "public"."main_notifications" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."main_employees" "e"
  WHERE (("e"."auth_user_id" = "auth"."uid"()) AND ("e"."id" = "main_notifications"."recipient_id")))));



CREATE POLICY "Users can read ticket audit logs" ON "public"."child_ticket_audit" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") IS NOT NULL));



CREATE POLICY "Users can update own todos" ON "public"."main_todos" FOR UPDATE USING ((("creator_id" IN ( SELECT "main_employees"."id"
   FROM "public"."main_employees"
  WHERE ("main_employees"."auth_user_id" = "auth"."uid"()))) OR ("public"."get_employee_level"() >= 2)));



CREATE POLICY "Users can view own jobs" ON "public"."main_route_optimization_jobs" FOR SELECT TO "authenticated" USING (("created_by" = ( SELECT "main_employees"."id"
   FROM "public"."main_employees"
  WHERE ("main_employees"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "Users can view own session messages" ON "public"."child_ai_messages" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."main_ai_sessions" "s"
     JOIN "public"."main_employees" "e" ON (("s"."employee_id" = "e"."id")))
  WHERE (("s"."id" = "child_ai_messages"."session_id") AND ("e"."auth_user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view own todos" ON "public"."main_todos" FOR SELECT USING ((("creator_id" IN ( SELECT "main_employees"."id"
   FROM "public"."main_employees"
  WHERE ("main_employees"."auth_user_id" = "auth"."uid"()))) OR ("assignee_id" IN ( SELECT "main_employees"."id"
   FROM "public"."main_employees"
  WHERE ("main_employees"."auth_user_id" = "auth"."uid"()))) OR ("public"."get_employee_level"() >= 2)));



CREATE POLICY "ai_sessions_delete_own" ON "public"."main_ai_sessions" FOR DELETE USING (("employee_id" = "auth"."uid"()));



CREATE POLICY "ai_sessions_insert_own" ON "public"."main_ai_sessions" FOR INSERT WITH CHECK (("employee_id" = "auth"."uid"()));



CREATE POLICY "ai_sessions_select_own" ON "public"."main_ai_sessions" FOR SELECT USING (("employee_id" = "auth"."uid"()));



CREATE POLICY "ai_sessions_service_role" ON "public"."main_ai_sessions" USING ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));



CREATE POLICY "ai_sessions_update_own" ON "public"."main_ai_sessions" FOR UPDATE USING (("employee_id" = "auth"."uid"()));



ALTER TABLE "public"."child_ai_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."child_announcement_files" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."child_announcement_photos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."child_comment_files" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."child_comment_photos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."child_company_comment_files" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."child_company_comment_photos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."child_company_comments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."child_employee_leave_balances" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."child_employee_leave_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."child_employee_line_accounts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."child_merchandise_location" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."child_site_comment_files" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."child_site_comment_photos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."child_site_comments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."child_site_contacts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."child_stock_movements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."child_stock_serial_movements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."child_ticket_audit" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."child_ticket_comments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."child_ticket_extra_fields" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."child_ticket_files" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."child_ticket_photos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."child_ticket_ratings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."child_ticket_work_estimates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."child_ticket_work_givers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "delete_appointments" ON "public"."main_appointments" FOR DELETE TO "authenticated" USING ("public"."fn_user_has_min_level"(1));



CREATE POLICY "delete_companies" ON "public"."main_companies" FOR DELETE TO "authenticated" USING ("public"."fn_user_has_min_level"(1));



ALTER TABLE "public"."fleet_garages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."fleet_vehicle_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."fleet_vehicles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "insert_appointments" ON "public"."main_appointments" FOR INSERT TO "authenticated" WITH CHECK ("public"."fn_user_has_min_level"(1));



CREATE POLICY "insert_companies" ON "public"."main_companies" FOR INSERT TO "authenticated" WITH CHECK ("public"."fn_user_has_min_level"(1));



ALTER TABLE "public"."jct_appointment_approvers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."jct_fleet_vehicle_employees" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."jct_model_components" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."jct_model_package_services" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."jct_site_employee_trainings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."jct_ticket_employees" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."jct_ticket_employees_cf" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."jct_ticket_merchandise" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."jct_ticket_stock_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."jct_ticket_watchers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "jct_ticket_watchers_delete" ON "public"."jct_ticket_watchers" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "jct_ticket_watchers_insert" ON "public"."jct_ticket_watchers" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "jct_ticket_watchers_read" ON "public"."jct_ticket_watchers" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "jct_ticket_watchers_service" ON "public"."jct_ticket_watchers" TO "service_role" USING (true) WITH CHECK (true);



ALTER TABLE "public"."main_ai_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."main_announcements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."main_appointments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."main_background_jobs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."main_companies" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."main_employees" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."main_features" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."main_merchandise" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."main_models" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."main_notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."main_org_departments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."main_org_roles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."main_route_optimization_jobs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."main_sites" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."main_staged_files" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."main_stock_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."main_stock_locations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."main_stock_serial_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."main_tickets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."main_todos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ref_districts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ref_leave_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ref_package_services" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ref_provinces" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ref_stock_location_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ref_sub_districts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ref_ticket_statuses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ref_ticket_work_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ref_work_givers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "select_appointments" ON "public"."main_appointments" FOR SELECT TO "authenticated" USING ("public"."fn_user_has_min_level"(0));



CREATE POLICY "select_companies" ON "public"."main_companies" FOR SELECT TO "authenticated" USING ("public"."fn_user_has_min_level"(0));



ALTER TABLE "public"."sys_idempotency_keys" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ticket_files_delete" ON "public"."child_ticket_files" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "ticket_files_insert" ON "public"."child_ticket_files" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "ticket_files_select" ON "public"."child_ticket_files" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "ticket_files_service" ON "public"."child_ticket_files" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "ticket_photos_delete" ON "public"."child_ticket_photos" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "ticket_photos_insert" ON "public"."child_ticket_photos" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "ticket_photos_select" ON "public"."child_ticket_photos" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "ticket_photos_service" ON "public"."child_ticket_photos" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "update_appointments" ON "public"."main_appointments" FOR UPDATE TO "authenticated" USING ("public"."fn_user_has_min_level"(1)) WITH CHECK ("public"."fn_user_has_min_level"(1));



CREATE POLICY "update_companies" ON "public"."main_companies" FOR UPDATE TO "authenticated" USING ("public"."fn_user_has_min_level"(1)) WITH CHECK ("public"."fn_user_has_min_level"(1));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;






GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";











































































































































































































































































GRANT ALL ON FUNCTION "public"."adjust_stock"("p_stock_item_id" "uuid", "p_adjustment" integer, "p_performed_by" "uuid", "p_reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."adjust_stock"("p_stock_item_id" "uuid", "p_adjustment" integer, "p_performed_by" "uuid", "p_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."adjust_stock"("p_stock_item_id" "uuid", "p_adjustment" integer, "p_performed_by" "uuid", "p_reason" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_distance_meters"("lat1" double precision, "lon1" double precision, "lat2" double precision, "lon2" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_distance_meters"("lat1" double precision, "lon1" double precision, "lat2" double precision, "lon2" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_distance_meters"("lat1" double precision, "lon1" double precision, "lat2" double precision, "lon2" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."check_todo_deadlines"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_todo_deadlines"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_todo_deadlines"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_expired_idempotency_keys"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_expired_idempotency_keys"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_expired_idempotency_keys"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_expired_staged_files"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_expired_staged_files"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_expired_staged_files"() TO "service_role";



GRANT ALL ON FUNCTION "public"."consume_stock"("p_stock_item_id" "uuid", "p_quantity" integer, "p_ticket_id" "uuid", "p_performed_by" "uuid", "p_notes" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."consume_stock"("p_stock_item_id" "uuid", "p_quantity" integer, "p_ticket_id" "uuid", "p_performed_by" "uuid", "p_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."consume_stock"("p_stock_item_id" "uuid", "p_quantity" integer, "p_ticket_id" "uuid", "p_performed_by" "uuid", "p_notes" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."current_user_is_role_level_gt0"() TO "anon";
GRANT ALL ON FUNCTION "public"."current_user_is_role_level_gt0"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_user_is_role_level_gt0"() TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_expired_notifications"() TO "anon";
GRANT ALL ON FUNCTION "public"."delete_expired_notifications"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_expired_notifications"() TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_tickets_cascade"("p_ticket_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."delete_tickets_cascade"("p_ticket_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_tickets_cascade"("p_ticket_ids" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."find_nearest_garage"("p_latitude" double precision, "p_longitude" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."find_nearest_garage"("p_latitude" double precision, "p_longitude" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."find_nearest_garage"("p_latitude" double precision, "p_longitude" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_cleanup_idempotency_keys"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_cleanup_idempotency_keys"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_cleanup_idempotency_keys"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_create_policy_if_exists"("policy_name" "text", "table_name" "text", "policy_definition" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_create_policy_if_exists"("policy_name" "text", "table_name" "text", "policy_definition" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_create_policy_if_exists"("policy_name" "text", "table_name" "text", "policy_definition" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_create_policy_if_exists_v2"("table_name" "text", "policy_name" "text", "policy_command" "text", "policy_using" "text", "policy_with_check" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_create_policy_if_exists_v2"("table_name" "text", "policy_name" "text", "policy_command" "text", "policy_using" "text", "policy_with_check" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_create_policy_if_exists_v2"("table_name" "text", "policy_name" "text", "policy_command" "text", "policy_using" "text", "policy_with_check" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_delete_tickets_cascade"("p_ticket_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."fn_delete_tickets_cascade"("p_ticket_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_delete_tickets_cascade"("p_ticket_ids" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_drop_policies_if_exists"("table_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_drop_policies_if_exists"("table_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_drop_policies_if_exists"("table_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_drop_policies_if_exists_v2"("table_name" "text", "policy_names" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."fn_drop_policies_if_exists_v2"("table_name" "text", "policy_names" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_drop_policies_if_exists_v2"("table_name" "text", "policy_names" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_merge_ticket_duplicates"("p_canonical_ticket_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_merge_ticket_duplicates"("p_canonical_ticket_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_merge_ticket_duplicates"("p_canonical_ticket_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_merge_ticket_duplicates_batch"("p_keep_id" "uuid", "p_remove_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."fn_merge_ticket_duplicates_batch"("p_keep_id" "uuid", "p_remove_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_merge_ticket_duplicates_batch"("p_keep_id" "uuid", "p_remove_ids" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_trg_set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_trg_set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_trg_set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_trg_validate_ticket_merch"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_trg_validate_ticket_merch"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_trg_validate_ticket_merch"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_user_has_min_level"("min_level" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."fn_user_has_min_level"("min_level" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_user_has_min_level"("min_level" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_user_is_level_gt0"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_user_is_level_gt0"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_user_is_level_gt0"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_ticket_audit_summary"("p_action" character varying, "p_changed_fields" "text"[], "p_old_values" "jsonb", "p_new_values" "jsonb", "p_metadata" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."generate_ticket_audit_summary"("p_action" character varying, "p_changed_fields" "text"[], "p_old_values" "jsonb", "p_new_values" "jsonb", "p_metadata" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_ticket_audit_summary"("p_action" character varying, "p_changed_fields" "text"[], "p_old_values" "jsonb", "p_new_values" "jsonb", "p_metadata" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_ticket_code"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_ticket_code"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_ticket_code"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_employee_level"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_employee_level"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_employee_level"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_low_stock_items"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_low_stock_items"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_low_stock_items"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_technician_detail_data"("p_employee_id" "uuid", "p_start_date" "date", "p_end_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."get_technician_detail_data"("p_employee_id" "uuid", "p_start_date" "date", "p_end_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_technician_detail_data"("p_employee_id" "uuid", "p_start_date" "date", "p_end_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_workload_distribution_data"("p_start_date" "date", "p_end_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."get_workload_distribution_data"("p_start_date" "date", "p_end_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_workload_distribution_data"("p_start_date" "date", "p_end_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."merge_ticket_duplicates"("p_keep_id" "uuid", "p_remove_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."merge_ticket_duplicates"("p_keep_id" "uuid", "p_remove_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."merge_ticket_duplicates"("p_keep_id" "uuid", "p_remove_ids" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_fleet_status_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_fleet_status_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_fleet_status_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."receive_stock"("p_location_id" "uuid", "p_model_id" "uuid", "p_quantity" integer, "p_performed_by" "uuid", "p_notes" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."receive_stock"("p_location_id" "uuid", "p_model_id" "uuid", "p_quantity" integer, "p_performed_by" "uuid", "p_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."receive_stock"("p_location_id" "uuid", "p_model_id" "uuid", "p_quantity" integer, "p_performed_by" "uuid", "p_notes" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."search_sites_with_ticket_count"("p_query" "text", "p_company_id" "uuid", "p_min_ticket_count" integer, "p_max_ticket_count" integer, "p_page" integer, "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."search_sites_with_ticket_count"("p_query" "text", "p_company_id" "uuid", "p_min_ticket_count" integer, "p_max_ticket_count" integer, "p_page" integer, "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_sites_with_ticket_count"("p_query" "text", "p_company_id" "uuid", "p_min_ticket_count" integer, "p_max_ticket_count" integer, "p_page" integer, "p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."search_tickets"("p_page" integer, "p_limit" integer, "p_sort" "text", "p_order" "text", "p_start_date" "date", "p_end_date" "date", "p_date_type" "text", "p_site_id" "uuid", "p_status_id" "uuid", "p_work_type_id" "uuid", "p_assigner_id" "uuid", "p_contact_id" "uuid", "p_details" "text", "p_exclude_backlog" boolean, "p_only_backlog" boolean, "p_employee_id" "uuid", "p_department_id" "uuid", "p_appointment_is_approved" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."search_tickets"("p_page" integer, "p_limit" integer, "p_sort" "text", "p_order" "text", "p_start_date" "date", "p_end_date" "date", "p_date_type" "text", "p_site_id" "uuid", "p_status_id" "uuid", "p_work_type_id" "uuid", "p_assigner_id" "uuid", "p_contact_id" "uuid", "p_details" "text", "p_exclude_backlog" boolean, "p_only_backlog" boolean, "p_employee_id" "uuid", "p_department_id" "uuid", "p_appointment_is_approved" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_tickets"("p_page" integer, "p_limit" integer, "p_sort" "text", "p_order" "text", "p_start_date" "date", "p_end_date" "date", "p_date_type" "text", "p_site_id" "uuid", "p_status_id" "uuid", "p_work_type_id" "uuid", "p_assigner_id" "uuid", "p_contact_id" "uuid", "p_details" "text", "p_exclude_backlog" boolean, "p_only_backlog" boolean, "p_employee_id" "uuid", "p_department_id" "uuid", "p_appointment_is_approved" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."search_tickets_fast"("p_page" integer, "p_limit" integer, "p_sort" "text", "p_order" "text", "p_start_date" "date", "p_end_date" "date", "p_date_type" "text", "p_site_id" "uuid", "p_status_id" "uuid", "p_work_type_id" "uuid", "p_assigner_id" "uuid", "p_contact_id" "uuid", "p_details" "text", "p_exclude_backlog" boolean, "p_only_backlog" boolean, "p_employee_id" "uuid", "p_department_id" "uuid", "p_appointment_is_approved" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."search_tickets_fast"("p_page" integer, "p_limit" integer, "p_sort" "text", "p_order" "text", "p_start_date" "date", "p_end_date" "date", "p_date_type" "text", "p_site_id" "uuid", "p_status_id" "uuid", "p_work_type_id" "uuid", "p_assigner_id" "uuid", "p_contact_id" "uuid", "p_details" "text", "p_exclude_backlog" boolean, "p_only_backlog" boolean, "p_employee_id" "uuid", "p_department_id" "uuid", "p_appointment_is_approved" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_tickets_fast"("p_page" integer, "p_limit" integer, "p_sort" "text", "p_order" "text", "p_start_date" "date", "p_end_date" "date", "p_date_type" "text", "p_site_id" "uuid", "p_status_id" "uuid", "p_work_type_id" "uuid", "p_assigner_id" "uuid", "p_contact_id" "uuid", "p_details" "text", "p_exclude_backlog" boolean, "p_only_backlog" boolean, "p_employee_id" "uuid", "p_department_id" "uuid", "p_appointment_is_approved" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_company_name"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_company_name"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_company_name"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_employee_department"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_employee_department"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_employee_department"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_site_company_on_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_site_company_on_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_site_company_on_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_ticket_appointment"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_ticket_appointment"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_ticket_appointment"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_ticket_denorm_on_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_ticket_denorm_on_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_ticket_denorm_on_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_ticket_site"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_ticket_site"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_ticket_site"() TO "service_role";



GRANT ALL ON FUNCTION "public"."transfer_stock"("p_from_location_id" "uuid", "p_to_location_id" "uuid", "p_model_id" "uuid", "p_quantity" integer, "p_performed_by" "uuid", "p_notes" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."transfer_stock"("p_from_location_id" "uuid", "p_to_location_id" "uuid", "p_model_id" "uuid", "p_quantity" integer, "p_performed_by" "uuid", "p_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."transfer_stock"("p_from_location_id" "uuid", "p_to_location_id" "uuid", "p_model_id" "uuid", "p_quantity" integer, "p_performed_by" "uuid", "p_notes" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_fleet_sync"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_fleet_sync"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_fleet_sync"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_ai_session_timestamp"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_ai_session_timestamp"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_ai_session_timestamp"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_ai_session_tokens"("p_session_id" "uuid", "p_input_tokens" integer, "p_output_tokens" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."update_ai_session_tokens"("p_session_id" "uuid", "p_input_tokens" integer, "p_output_tokens" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_ai_session_tokens"("p_session_id" "uuid", "p_input_tokens" integer, "p_output_tokens" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."user_has_min_level"("min_level" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."user_has_min_level"("min_level" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_has_min_level"("min_level" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_ticket_merchandise_site"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_ticket_merchandise_site"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_ticket_merchandise_site"() TO "service_role";
























GRANT ALL ON TABLE "public"."addon_achievement_goals" TO "anon";
GRANT ALL ON TABLE "public"."addon_achievement_goals" TO "authenticated";
GRANT ALL ON TABLE "public"."addon_achievement_goals" TO "service_role";



GRANT ALL ON TABLE "public"."addon_employee_achievements" TO "anon";
GRANT ALL ON TABLE "public"."addon_employee_achievements" TO "authenticated";
GRANT ALL ON TABLE "public"."addon_employee_achievements" TO "service_role";



GRANT ALL ON TABLE "public"."addon_employee_coupons" TO "anon";
GRANT ALL ON TABLE "public"."addon_employee_coupons" TO "authenticated";
GRANT ALL ON TABLE "public"."addon_employee_coupons" TO "service_role";



GRANT ALL ON TABLE "public"."child_ai_messages" TO "anon";
GRANT ALL ON TABLE "public"."child_ai_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."child_ai_messages" TO "service_role";



GRANT ALL ON TABLE "public"."child_announcement_files" TO "anon";
GRANT ALL ON TABLE "public"."child_announcement_files" TO "authenticated";
GRANT ALL ON TABLE "public"."child_announcement_files" TO "service_role";



GRANT ALL ON TABLE "public"."child_announcement_photos" TO "anon";
GRANT ALL ON TABLE "public"."child_announcement_photos" TO "authenticated";
GRANT ALL ON TABLE "public"."child_announcement_photos" TO "service_role";



GRANT ALL ON TABLE "public"."child_comment_files" TO "anon";
GRANT ALL ON TABLE "public"."child_comment_files" TO "authenticated";
GRANT ALL ON TABLE "public"."child_comment_files" TO "service_role";



GRANT ALL ON TABLE "public"."child_comment_photos" TO "anon";
GRANT ALL ON TABLE "public"."child_comment_photos" TO "authenticated";
GRANT ALL ON TABLE "public"."child_comment_photos" TO "service_role";



GRANT ALL ON TABLE "public"."child_company_comment_files" TO "anon";
GRANT ALL ON TABLE "public"."child_company_comment_files" TO "authenticated";
GRANT ALL ON TABLE "public"."child_company_comment_files" TO "service_role";



GRANT ALL ON TABLE "public"."child_company_comment_photos" TO "anon";
GRANT ALL ON TABLE "public"."child_company_comment_photos" TO "authenticated";
GRANT ALL ON TABLE "public"."child_company_comment_photos" TO "service_role";



GRANT ALL ON TABLE "public"."child_company_comments" TO "anon";
GRANT ALL ON TABLE "public"."child_company_comments" TO "authenticated";
GRANT ALL ON TABLE "public"."child_company_comments" TO "service_role";



GRANT ALL ON TABLE "public"."child_employee_leave_balances" TO "anon";
GRANT ALL ON TABLE "public"."child_employee_leave_balances" TO "authenticated";
GRANT ALL ON TABLE "public"."child_employee_leave_balances" TO "service_role";



GRANT ALL ON TABLE "public"."child_employee_leave_requests" TO "anon";
GRANT ALL ON TABLE "public"."child_employee_leave_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."child_employee_leave_requests" TO "service_role";



GRANT ALL ON TABLE "public"."child_employee_line_accounts" TO "anon";
GRANT ALL ON TABLE "public"."child_employee_line_accounts" TO "authenticated";
GRANT ALL ON TABLE "public"."child_employee_line_accounts" TO "service_role";



GRANT ALL ON TABLE "public"."child_merchandise_location" TO "anon";
GRANT ALL ON TABLE "public"."child_merchandise_location" TO "authenticated";
GRANT ALL ON TABLE "public"."child_merchandise_location" TO "service_role";



GRANT ALL ON TABLE "public"."child_site_comment_files" TO "anon";
GRANT ALL ON TABLE "public"."child_site_comment_files" TO "authenticated";
GRANT ALL ON TABLE "public"."child_site_comment_files" TO "service_role";



GRANT ALL ON TABLE "public"."child_site_comment_photos" TO "anon";
GRANT ALL ON TABLE "public"."child_site_comment_photos" TO "authenticated";
GRANT ALL ON TABLE "public"."child_site_comment_photos" TO "service_role";



GRANT ALL ON TABLE "public"."child_site_comments" TO "anon";
GRANT ALL ON TABLE "public"."child_site_comments" TO "authenticated";
GRANT ALL ON TABLE "public"."child_site_comments" TO "service_role";



GRANT ALL ON TABLE "public"."child_site_contacts" TO "anon";
GRANT ALL ON TABLE "public"."child_site_contacts" TO "authenticated";
GRANT ALL ON TABLE "public"."child_site_contacts" TO "service_role";



GRANT ALL ON TABLE "public"."child_stock_movements" TO "anon";
GRANT ALL ON TABLE "public"."child_stock_movements" TO "authenticated";
GRANT ALL ON TABLE "public"."child_stock_movements" TO "service_role";



GRANT ALL ON TABLE "public"."child_stock_serial_movements" TO "anon";
GRANT ALL ON TABLE "public"."child_stock_serial_movements" TO "authenticated";
GRANT ALL ON TABLE "public"."child_stock_serial_movements" TO "service_role";



GRANT ALL ON TABLE "public"."child_ticket_audit" TO "anon";
GRANT ALL ON TABLE "public"."child_ticket_audit" TO "authenticated";
GRANT ALL ON TABLE "public"."child_ticket_audit" TO "service_role";



GRANT ALL ON TABLE "public"."child_ticket_comments" TO "anon";
GRANT ALL ON TABLE "public"."child_ticket_comments" TO "authenticated";
GRANT ALL ON TABLE "public"."child_ticket_comments" TO "service_role";



GRANT ALL ON TABLE "public"."child_ticket_extra_fields" TO "anon";
GRANT ALL ON TABLE "public"."child_ticket_extra_fields" TO "authenticated";
GRANT ALL ON TABLE "public"."child_ticket_extra_fields" TO "service_role";



GRANT ALL ON TABLE "public"."child_ticket_files" TO "anon";
GRANT ALL ON TABLE "public"."child_ticket_files" TO "authenticated";
GRANT ALL ON TABLE "public"."child_ticket_files" TO "service_role";



GRANT ALL ON TABLE "public"."child_ticket_photos" TO "anon";
GRANT ALL ON TABLE "public"."child_ticket_photos" TO "authenticated";
GRANT ALL ON TABLE "public"."child_ticket_photos" TO "service_role";



GRANT ALL ON TABLE "public"."child_ticket_ratings" TO "anon";
GRANT ALL ON TABLE "public"."child_ticket_ratings" TO "authenticated";
GRANT ALL ON TABLE "public"."child_ticket_ratings" TO "service_role";



GRANT ALL ON TABLE "public"."child_ticket_work_estimates" TO "anon";
GRANT ALL ON TABLE "public"."child_ticket_work_estimates" TO "authenticated";
GRANT ALL ON TABLE "public"."child_ticket_work_estimates" TO "service_role";



GRANT ALL ON TABLE "public"."child_ticket_work_givers" TO "anon";
GRANT ALL ON TABLE "public"."child_ticket_work_givers" TO "authenticated";
GRANT ALL ON TABLE "public"."child_ticket_work_givers" TO "service_role";



GRANT ALL ON TABLE "public"."fleet_garages" TO "anon";
GRANT ALL ON TABLE "public"."fleet_garages" TO "authenticated";
GRANT ALL ON TABLE "public"."fleet_garages" TO "service_role";



GRANT ALL ON TABLE "public"."fleet_vehicle_history" TO "anon";
GRANT ALL ON TABLE "public"."fleet_vehicle_history" TO "authenticated";
GRANT ALL ON TABLE "public"."fleet_vehicle_history" TO "service_role";



GRANT ALL ON TABLE "public"."fleet_vehicles" TO "anon";
GRANT ALL ON TABLE "public"."fleet_vehicles" TO "authenticated";
GRANT ALL ON TABLE "public"."fleet_vehicles" TO "service_role";



GRANT ALL ON TABLE "public"."jct_appointment_approvers" TO "anon";
GRANT ALL ON TABLE "public"."jct_appointment_approvers" TO "authenticated";
GRANT ALL ON TABLE "public"."jct_appointment_approvers" TO "service_role";



GRANT ALL ON TABLE "public"."jct_fleet_vehicle_employees" TO "anon";
GRANT ALL ON TABLE "public"."jct_fleet_vehicle_employees" TO "authenticated";
GRANT ALL ON TABLE "public"."jct_fleet_vehicle_employees" TO "service_role";



GRANT ALL ON TABLE "public"."jct_model_components" TO "anon";
GRANT ALL ON TABLE "public"."jct_model_components" TO "authenticated";
GRANT ALL ON TABLE "public"."jct_model_components" TO "service_role";



GRANT ALL ON TABLE "public"."jct_model_package_services" TO "anon";
GRANT ALL ON TABLE "public"."jct_model_package_services" TO "authenticated";
GRANT ALL ON TABLE "public"."jct_model_package_services" TO "service_role";



GRANT ALL ON TABLE "public"."jct_site_employee_trainings" TO "anon";
GRANT ALL ON TABLE "public"."jct_site_employee_trainings" TO "authenticated";
GRANT ALL ON TABLE "public"."jct_site_employee_trainings" TO "service_role";



GRANT ALL ON TABLE "public"."jct_ticket_employees" TO "anon";
GRANT ALL ON TABLE "public"."jct_ticket_employees" TO "authenticated";
GRANT ALL ON TABLE "public"."jct_ticket_employees" TO "service_role";



GRANT ALL ON TABLE "public"."jct_ticket_employees_cf" TO "anon";
GRANT ALL ON TABLE "public"."jct_ticket_employees_cf" TO "authenticated";
GRANT ALL ON TABLE "public"."jct_ticket_employees_cf" TO "service_role";



GRANT ALL ON TABLE "public"."jct_ticket_merchandise" TO "anon";
GRANT ALL ON TABLE "public"."jct_ticket_merchandise" TO "authenticated";
GRANT ALL ON TABLE "public"."jct_ticket_merchandise" TO "service_role";



GRANT ALL ON TABLE "public"."jct_ticket_stock_items" TO "anon";
GRANT ALL ON TABLE "public"."jct_ticket_stock_items" TO "authenticated";
GRANT ALL ON TABLE "public"."jct_ticket_stock_items" TO "service_role";



GRANT ALL ON TABLE "public"."jct_ticket_watchers" TO "anon";
GRANT ALL ON TABLE "public"."jct_ticket_watchers" TO "authenticated";
GRANT ALL ON TABLE "public"."jct_ticket_watchers" TO "service_role";



GRANT ALL ON TABLE "public"."main_ai_sessions" TO "anon";
GRANT ALL ON TABLE "public"."main_ai_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."main_ai_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."main_announcements" TO "anon";
GRANT ALL ON TABLE "public"."main_announcements" TO "authenticated";
GRANT ALL ON TABLE "public"."main_announcements" TO "service_role";



GRANT ALL ON TABLE "public"."main_appointments" TO "anon";
GRANT ALL ON TABLE "public"."main_appointments" TO "authenticated";
GRANT ALL ON TABLE "public"."main_appointments" TO "service_role";



GRANT ALL ON TABLE "public"."main_background_jobs" TO "anon";
GRANT ALL ON TABLE "public"."main_background_jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."main_background_jobs" TO "service_role";



GRANT ALL ON TABLE "public"."main_companies" TO "anon";
GRANT ALL ON TABLE "public"."main_companies" TO "authenticated";
GRANT ALL ON TABLE "public"."main_companies" TO "service_role";



GRANT ALL ON TABLE "public"."main_employees" TO "anon";
GRANT ALL ON TABLE "public"."main_employees" TO "authenticated";
GRANT ALL ON TABLE "public"."main_employees" TO "service_role";



GRANT ALL ON TABLE "public"."main_features" TO "anon";
GRANT ALL ON TABLE "public"."main_features" TO "authenticated";
GRANT ALL ON TABLE "public"."main_features" TO "service_role";



GRANT ALL ON TABLE "public"."main_merchandise" TO "anon";
GRANT ALL ON TABLE "public"."main_merchandise" TO "authenticated";
GRANT ALL ON TABLE "public"."main_merchandise" TO "service_role";



GRANT ALL ON TABLE "public"."main_models" TO "anon";
GRANT ALL ON TABLE "public"."main_models" TO "authenticated";
GRANT ALL ON TABLE "public"."main_models" TO "service_role";



GRANT ALL ON TABLE "public"."main_notifications" TO "anon";
GRANT ALL ON TABLE "public"."main_notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."main_notifications" TO "service_role";



GRANT ALL ON TABLE "public"."main_org_departments" TO "anon";
GRANT ALL ON TABLE "public"."main_org_departments" TO "authenticated";
GRANT ALL ON TABLE "public"."main_org_departments" TO "service_role";



GRANT ALL ON TABLE "public"."main_org_roles" TO "anon";
GRANT ALL ON TABLE "public"."main_org_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."main_org_roles" TO "service_role";



GRANT ALL ON TABLE "public"."main_route_optimization_jobs" TO "anon";
GRANT ALL ON TABLE "public"."main_route_optimization_jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."main_route_optimization_jobs" TO "service_role";



GRANT ALL ON TABLE "public"."main_sites" TO "anon";
GRANT ALL ON TABLE "public"."main_sites" TO "authenticated";
GRANT ALL ON TABLE "public"."main_sites" TO "service_role";



GRANT ALL ON TABLE "public"."main_staged_files" TO "anon";
GRANT ALL ON TABLE "public"."main_staged_files" TO "authenticated";
GRANT ALL ON TABLE "public"."main_staged_files" TO "service_role";



GRANT ALL ON TABLE "public"."main_stock_items" TO "anon";
GRANT ALL ON TABLE "public"."main_stock_items" TO "authenticated";
GRANT ALL ON TABLE "public"."main_stock_items" TO "service_role";



GRANT ALL ON TABLE "public"."main_stock_locations" TO "anon";
GRANT ALL ON TABLE "public"."main_stock_locations" TO "authenticated";
GRANT ALL ON TABLE "public"."main_stock_locations" TO "service_role";



GRANT ALL ON TABLE "public"."main_stock_serial_items" TO "anon";
GRANT ALL ON TABLE "public"."main_stock_serial_items" TO "authenticated";
GRANT ALL ON TABLE "public"."main_stock_serial_items" TO "service_role";



GRANT ALL ON TABLE "public"."main_tickets" TO "anon";
GRANT ALL ON TABLE "public"."main_tickets" TO "authenticated";
GRANT ALL ON TABLE "public"."main_tickets" TO "service_role";



GRANT ALL ON TABLE "public"."main_todos" TO "anon";
GRANT ALL ON TABLE "public"."main_todos" TO "authenticated";
GRANT ALL ON TABLE "public"."main_todos" TO "service_role";



GRANT ALL ON TABLE "public"."ref_districts" TO "anon";
GRANT ALL ON TABLE "public"."ref_districts" TO "authenticated";
GRANT ALL ON TABLE "public"."ref_districts" TO "service_role";



GRANT ALL ON TABLE "public"."ref_leave_types" TO "anon";
GRANT ALL ON TABLE "public"."ref_leave_types" TO "authenticated";
GRANT ALL ON TABLE "public"."ref_leave_types" TO "service_role";



GRANT ALL ON TABLE "public"."ref_package_services" TO "anon";
GRANT ALL ON TABLE "public"."ref_package_services" TO "authenticated";
GRANT ALL ON TABLE "public"."ref_package_services" TO "service_role";



GRANT ALL ON TABLE "public"."ref_provinces" TO "anon";
GRANT ALL ON TABLE "public"."ref_provinces" TO "authenticated";
GRANT ALL ON TABLE "public"."ref_provinces" TO "service_role";



GRANT ALL ON TABLE "public"."ref_stock_location_types" TO "anon";
GRANT ALL ON TABLE "public"."ref_stock_location_types" TO "authenticated";
GRANT ALL ON TABLE "public"."ref_stock_location_types" TO "service_role";



GRANT ALL ON TABLE "public"."ref_sub_districts" TO "anon";
GRANT ALL ON TABLE "public"."ref_sub_districts" TO "authenticated";
GRANT ALL ON TABLE "public"."ref_sub_districts" TO "service_role";



GRANT ALL ON TABLE "public"."ref_ticket_statuses" TO "anon";
GRANT ALL ON TABLE "public"."ref_ticket_statuses" TO "authenticated";
GRANT ALL ON TABLE "public"."ref_ticket_statuses" TO "service_role";



GRANT ALL ON TABLE "public"."ref_ticket_work_types" TO "anon";
GRANT ALL ON TABLE "public"."ref_ticket_work_types" TO "authenticated";
GRANT ALL ON TABLE "public"."ref_ticket_work_types" TO "service_role";



GRANT ALL ON TABLE "public"."ref_work_givers" TO "anon";
GRANT ALL ON TABLE "public"."ref_work_givers" TO "authenticated";
GRANT ALL ON TABLE "public"."ref_work_givers" TO "service_role";



GRANT ALL ON TABLE "public"."sys_idempotency_keys" TO "anon";
GRANT ALL ON TABLE "public"."sys_idempotency_keys" TO "authenticated";
GRANT ALL ON TABLE "public"."sys_idempotency_keys" TO "service_role";



GRANT ALL ON SEQUENCE "public"."ticket_number_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."ticket_number_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."ticket_number_seq" TO "service_role";



GRANT ALL ON TABLE "public"."v_employees" TO "anon";
GRANT ALL ON TABLE "public"."v_employees" TO "authenticated";
GRANT ALL ON TABLE "public"."v_employees" TO "service_role";



GRANT ALL ON TABLE "public"."v_leave_balances" TO "anon";
GRANT ALL ON TABLE "public"."v_leave_balances" TO "authenticated";
GRANT ALL ON TABLE "public"."v_leave_balances" TO "service_role";



GRANT ALL ON TABLE "public"."v_leave_requests" TO "anon";
GRANT ALL ON TABLE "public"."v_leave_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."v_leave_requests" TO "service_role";



GRANT ALL ON TABLE "public"."v_merchandise" TO "anon";
GRANT ALL ON TABLE "public"."v_merchandise" TO "authenticated";
GRANT ALL ON TABLE "public"."v_merchandise" TO "service_role";



GRANT ALL ON TABLE "public"."v_sites" TO "anon";
GRANT ALL ON TABLE "public"."v_sites" TO "authenticated";
GRANT ALL ON TABLE "public"."v_sites" TO "service_role";



GRANT ALL ON TABLE "public"."v_ticket_audit_readable" TO "anon";
GRANT ALL ON TABLE "public"."v_ticket_audit_readable" TO "authenticated";
GRANT ALL ON TABLE "public"."v_ticket_audit_readable" TO "service_role";



GRANT ALL ON TABLE "public"."v_tickets" TO "anon";
GRANT ALL ON TABLE "public"."v_tickets" TO "authenticated";
GRANT ALL ON TABLE "public"."v_tickets" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































alter table "public"."child_ticket_audit" drop constraint "ticket_audit_action_check";

alter table "public"."jct_ticket_stock_items" drop constraint "chk_status_valid";

alter table "public"."child_ticket_audit" add constraint "ticket_audit_action_check" CHECK (((action)::text = ANY ((ARRAY['created'::character varying, 'updated'::character varying, 'deleted'::character varying, 'approved'::character varying, 'unapproved'::character varying, 'technician_confirmed'::character varying, 'technician_unconfirmed'::character varying, 'technician_changed'::character varying, 'employee_assigned'::character varying, 'employee_removed'::character varying, 'work_giver_set'::character varying, 'work_giver_changed'::character varying, 'comment_added'::character varying])::text[]))) not valid;

alter table "public"."child_ticket_audit" validate constraint "ticket_audit_action_check";

alter table "public"."jct_ticket_stock_items" add constraint "chk_status_valid" CHECK (((status)::text = ANY ((ARRAY['reserved'::character varying, 'consumed'::character varying, 'returned'::character varying])::text[]))) not valid;

alter table "public"."jct_ticket_stock_items" validate constraint "chk_status_valid";

-- Storage policies have been moved to a separate config
-- They will be applied via Supabase dashboard or supabase/config.toml

-- pg_cron scheduled jobs
SELECT cron.schedule('cleanup_idempotency_keys', '0 2 * * *', 'SELECT cleanup_expired_idempotency_keys()');
SELECT cron.schedule('delete_expired_notifications', '0 3 * * *', 'SELECT delete_expired_notifications()');
SELECT cron.schedule('check_todo_deadlines', '*/5 * * * *', 'SELECT public.check_todo_deadlines()');
SELECT cron.schedule('trigger_fleet_sync', '*/5 * * * *', 'SELECT public.trigger_fleet_sync()');
SELECT cron.schedule('cleanup_staged_files', '0 4 * * *', 'SELECT cleanup_expired_staged_files()');
-- Note: warmup job is environment-specific (uses production URL), not included in baseline
