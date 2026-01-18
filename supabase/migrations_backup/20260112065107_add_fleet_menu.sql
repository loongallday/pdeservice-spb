-- Add fleet page menu for superadmin

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
  'menu_fleet',
  '/admin/fleet',
  'จัดการยานพาหนะ',
  3,
  'Truck',
  'การจัดการ',
  4,
  true,
  ARRAY['superadmin'],
  5,
  true
)
ON CONFLICT (id) DO NOTHING;
