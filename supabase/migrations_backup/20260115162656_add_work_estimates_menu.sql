-- Add work estimates menu for planners

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
  'menu_work_estimates',
  '/admin/work-estimates',
  'เวลาทำงาน',
  1,
  'Clock',
  'งาน',
  9,
  true,
  NULL,
  2,
  true
)
ON CONFLICT (id) DO NOTHING;
