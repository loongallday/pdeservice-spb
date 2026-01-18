-- Add route optimization menu for planners

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
  'menu_route_optimization',
  '/admin/route-optimization',
  'วางแผนเส้นทาง',
  1,
  'Route',
  'งาน',
  8,
  true,
  NULL,
  2,
  true
)
ON CONFLICT (id) DO NOTHING;
