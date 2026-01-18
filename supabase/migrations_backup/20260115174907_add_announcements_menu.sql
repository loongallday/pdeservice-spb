-- Add announcements management menu for superadmin only

INSERT INTO main_features (
  id,
  path,
  display_name,
  min_level,
  icon,
  group_label,
  display_order,
  is_menu_item,
  allowed_roles,
  category_order,
  is_active
) VALUES (
  'menu_announcements_manage',
  '/admin/announcements',
  'จัดการประกาศ',
  3,  -- Superadmin only
  'Megaphone',
  'ตั้งค่า',
  10,
  true,
  NULL,
  5,
  true
)
ON CONFLICT (id) DO NOTHING;
