-- Migration: Add Technician Analytics Menu Item
-- Adds /admin/reports/technician-analytics path for admin reports

INSERT INTO public.main_features (id, path, display_name, min_level, icon, group_label, display_order, is_menu_item, allowed_roles, category_order, is_active)
VALUES
  ('menu_reports_technician_analytics', '/admin/reports/technician-analytics', 'วิเคราะห์ช่าง', 3, 'Users', 'รายงาน', 2, true, ARRAY['superadmin'], 8, true)
ON CONFLICT (id) DO UPDATE SET
  path = EXCLUDED.path,
  display_name = EXCLUDED.display_name,
  min_level = EXCLUDED.min_level,
  icon = EXCLUDED.icon,
  group_label = EXCLUDED.group_label,
  display_order = EXCLUDED.display_order,
  is_menu_item = EXCLUDED.is_menu_item,
  allowed_roles = EXCLUDED.allowed_roles,
  category_order = EXCLUDED.category_order,
  is_active = EXCLUDED.is_active;
