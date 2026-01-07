-- Update audit summary function to handle new action types:
-- approved, unapproved, technician_confirmed, technician_changed,
-- employee_assigned, employee_removed, work_giver_set, work_giver_changed

CREATE OR REPLACE FUNCTION generate_ticket_audit_summary(
  p_action VARCHAR,
  p_changed_fields TEXT[],
  p_old_values JSONB,
  p_new_values JSONB,
  p_metadata JSONB
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
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

COMMENT ON FUNCTION generate_ticket_audit_summary IS 'Generates natural language Thai summary from audit data. Supports: created, updated, deleted, approved, unapproved, technician_confirmed, technician_changed, employee_assigned, employee_removed, work_giver_set, work_giver_changed';
