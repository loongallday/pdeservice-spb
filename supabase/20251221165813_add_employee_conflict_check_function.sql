-- Migration: Add database function for employee appointment conflict checking
-- This function replaces complex in-memory conflict checking with a single database call

-- Function: Check employee appointment conflicts
-- Returns employee IDs that have conflicting appointments on the given date/time
CREATE OR REPLACE FUNCTION check_employee_appointment_conflicts(
  p_employee_ids UUID[],
  p_date DATE,
  p_time_start TIME DEFAULT NULL,
  p_time_end TIME DEFAULT NULL,
  p_exclude_ticket_id UUID DEFAULT NULL
)
RETURNS TABLE(conflicted_employee_id UUID) AS $$
DECLARE
  v_time_start TIME;
  v_time_end TIME;
BEGIN
  -- Set default times if not provided (full day)
  v_time_start := COALESCE(p_time_start, '00:00:00'::TIME);
  v_time_end := COALESCE(p_time_end, '23:59:59'::TIME);

  RETURN QUERY
  SELECT DISTINCT te.employee_id
  FROM ticket_employees te
  JOIN tickets t ON te.ticket_id = t.id
  JOIN appointments a ON t.appointment_id = a.id
  WHERE te.employee_id = ANY(p_employee_ids)
    AND a.appointment_date = p_date
    AND (p_exclude_ticket_id IS NULL OR te.ticket_id != p_exclude_ticket_id)
    -- Handle appointment types
    AND a.appointment_type != 'call_to_schedule' -- call_to_schedule never conflicts
    -- Check time overlap
    AND (
      -- If appointment has explicit times
      (a.appointment_time_start IS NOT NULL AND a.appointment_time_end IS NOT NULL
        AND a.appointment_time_start < v_time_end 
        AND a.appointment_time_end > v_time_start
        AND a.appointment_time_start != a.appointment_time_end -- Skip zero-duration
      )
      OR
      -- Handle half_morning type (08:00-12:00)
      (a.appointment_type = 'half_morning' 
        AND (a.appointment_time_start IS NULL OR a.appointment_time_end IS NULL)
        AND '08:00:00'::TIME < v_time_end 
        AND '12:00:00'::TIME > v_time_start
      )
      OR
      -- Handle half_afternoon type (13:00-17:30)
      (a.appointment_type = 'half_afternoon' 
        AND (a.appointment_time_start IS NULL OR a.appointment_time_end IS NULL)
        AND '13:00:00'::TIME < v_time_end 
        AND '17:30:00'::TIME > v_time_start
      )
      OR
      -- Handle full_day type (08:00-17:30)
      (a.appointment_type = 'full_day' 
        AND (a.appointment_time_start IS NULL OR a.appointment_time_end IS NULL)
        AND '08:00:00'::TIME < v_time_end 
        AND '17:30:00'::TIME > v_time_start
      )
      OR
      -- Handle time_range without explicit times (assume full day conflict)
      (a.appointment_type = 'time_range'
        AND a.appointment_time_start IS NULL 
        AND a.appointment_time_end IS NULL
      )
    );
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION check_employee_appointment_conflicts IS 'Check for employee appointment conflicts. Returns employee IDs that have overlapping appointments on the specified date and time range.';

-- Grant permissions
GRANT EXECUTE ON FUNCTION check_employee_appointment_conflicts TO authenticated;


