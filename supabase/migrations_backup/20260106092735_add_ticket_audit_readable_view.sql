-- Function to generate natural language summary from audit data
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

-- Create readable audit view
CREATE OR REPLACE VIEW v_ticket_audit_readable AS
SELECT
  a.id,
  a.ticket_id,
  a.action,
  a.changed_by,
  e.name AS changed_by_name,
  e.nickname AS changed_by_nickname,
  generate_ticket_audit_summary(
    a.action,
    a.changed_fields,
    a.old_values,
    a.new_values,
    a.metadata
  ) AS summary,
  a.changed_fields,
  a.old_values,
  a.new_values,
  a.metadata,
  a.created_at,
  -- Additional context
  wt.name AS work_type_name,
  s.name AS site_name,
  c.name_th AS company_name
FROM child_ticket_audit a
LEFT JOIN main_tickets t ON a.ticket_id = t.id
LEFT JOIN main_employees e ON a.changed_by = e.auth_user_id
LEFT JOIN ref_ticket_work_types wt ON t.work_type_id = wt.id
LEFT JOIN main_sites s ON t.site_id = s.id
LEFT JOIN main_companies c ON s.company_id = c.id
ORDER BY a.created_at DESC;

-- Add comment for documentation
COMMENT ON VIEW v_ticket_audit_readable IS 'Readable audit logs with natural language Thai summaries';
COMMENT ON FUNCTION generate_ticket_audit_summary IS 'Generates natural language Thai summary from audit data';
