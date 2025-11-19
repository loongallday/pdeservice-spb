-- Migration: Add merchandise management features
-- Created: 2025-11-17
-- Description: Adds features for merchandise, models, and PM summary pages

INSERT INTO public.feature (id, path, display_name, min_level, icon, group_label, display_order, is_menu_item, allowed_roles, category_order, is_active)
VALUES
  -- Merchandise list page (menu item)
  ('menu_merchandise', '/admin/merchandise', 'อุปกรณ์', 1, 'Package', 'ข้อมูล', 3, true, NULL, 3, true),
  
  -- Merchandise detail page (feature flag, not menu item)
  ('merchandise_detail', '/admin/merchandise/:id', 'รายละเอียดอุปกรณ์', 1, NULL, NULL, 0, false, NULL, 0, true),
  
  -- PM Summary page (menu item)
  ('menu_pm_summary', '/admin/pm-summary', 'สรุป PM', 0, 'ClipboardCheck', 'ข้อมูล', 4, true, NULL, 3, true),
  
  -- Models management page (menu item)
  ('menu_models', '/admin/models', 'จัดการ Model', 2, 'Box', 'การจัดการ', 3, true, NULL, 5, true)
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

COMMENT ON TABLE public.feature IS 'Feature flags and permissions. min_level: 0=technician_l1, 1=technician/assigner, 2=admin, 3=superadmin';

