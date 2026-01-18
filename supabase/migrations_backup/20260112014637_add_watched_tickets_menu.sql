-- Migration: Add Watched Tickets Menu Item
-- Adds /tickets/watching path for viewing tickets the user is watching

INSERT INTO public.main_features (id, path, display_name, min_level, icon, group_label, display_order, is_menu_item, allowed_roles, category_order, is_active)
VALUES
  ('menu_tickets_watching', '/tickets/watching', 'ตั๋วที่ติดตาม', 0, 'Eye', 'ตั๋วงาน', 2, true, NULL, 1, true)
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
