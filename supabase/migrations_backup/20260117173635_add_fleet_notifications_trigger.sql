-- Migration: Add fleet departure/arrival notifications
-- Automatically notify approvers when employees leave or arrive at office/garage

-- 1. Add new notification types for fleet events
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'fleet_departure';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'fleet_arrival';

-- 2. Create trigger function to send notifications on vehicle status changes
CREATE OR REPLACE FUNCTION public.notify_fleet_status_change()
RETURNS TRIGGER AS $$
DECLARE
  v_is_departure BOOLEAN;
  v_is_arrival BOOLEAN;
  v_garage_id UUID;
  v_garage_name TEXT;
  v_plate_number TEXT;
  v_employee_names TEXT[];
  v_employee_ids UUID[];
  v_employee_list TEXT;
  v_approver_id UUID;
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

  -- Insert notifications for all approvers
  INSERT INTO public.main_notifications (
    recipient_id,
    type,
    title,
    message,
    metadata,
    created_at
  )
  SELECT
    jaa.employee_id,
    v_notification_type,
    v_title,
    v_message,
    v_metadata,
    NOW()
  FROM public.jct_appointment_approvers jaa
  WHERE jaa.employee_id IS NOT NULL;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create trigger on fleet_vehicles table
DROP TRIGGER IF EXISTS trg_fleet_vehicle_status_change ON public.fleet_vehicles;

CREATE TRIGGER trg_fleet_vehicle_status_change
  AFTER UPDATE OF status ON public.fleet_vehicles
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.notify_fleet_status_change();

-- Comments
COMMENT ON FUNCTION public.notify_fleet_status_change() IS
  'Trigger function to send notifications to approvers when vehicle status changes (departure/arrival at garage)';
