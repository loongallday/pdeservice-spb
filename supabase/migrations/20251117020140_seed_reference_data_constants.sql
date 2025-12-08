-- Migration: Seed Reference Data Constants
-- This migration seeds the database with reference data constants
-- Based on current database state
-- Idempotent: Can be run multiple times safely
-- Uses code as the unique identifier for conflict resolution

-- =============================================
-- DEPARTMENTS
-- =============================================

INSERT INTO public.departments (code, name_th, name_en, description, is_active, created_at, updated_at, head_id)
VALUES
  ('general', 'ทั่วไป', 'General', 'บทบาททั่วไปที่ไม่เฉพาะเจาะจงฝ่าย', true, NOW(), NOW(), NULL),
  ('pm', 'ฝ่าย PM', 'Project Management', 'ฝ่ายบริหารโครงการ', true, NOW(), NOW(), NULL),
  ('rma', 'ฝ่าย RMA', 'RMA', 'Return Merchandise Authorization', true, NOW(), NOW(), NULL),
  ('sales', 'ฝ่ายขาย', 'Sales', 'ฝ่ายขายและการตลาด', true, NOW(), NOW(), NULL),
  ('technical', 'ฝ่ายช่าง', 'Technical', 'ฝ่ายช่างเทคนิค', true, NOW(), NOW(), NULL),
  ('admin', 'ฝ่ายบริหาร', 'Administration', 'ฝ่ายบริหารและจัดการ', true, NOW(), NOW(), NULL)
ON CONFLICT (code) DO UPDATE SET
  name_th = EXCLUDED.name_th,
  name_en = EXCLUDED.name_en,
  description = EXCLUDED.description,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- =============================================
-- ROLES
-- =============================================
-- Note: Uses subquery to look up department_id by code

INSERT INTO public.roles (code, name_th, name_en, description, name, level, department_id, is_active, requires_auth)
SELECT 
  v.code,
  v.name_th,
  v.name_en,
  v.description,
  v.name,
  v.level,
  d.id AS department_id,
  v.is_active,
  v.requires_auth
FROM (VALUES
  ('pm_l1', 'PM ระดับ 1', 'PM L1', 'Project Manager ระดับ 1', 'PM ระดับ 1', 1, 'pm', true, false),
  ('pm_l2', 'PM ระดับ 2', 'PM L2', 'Project Manager ระดับ 2', 'PM ระดับ 2', 1, 'pm', true, false),
  ('rma_l1', 'RMA ระดับ 1', 'RMA L1', 'RMA (Return Merchandise Authorization) ระดับ 1', 'RMA ระดับ 1', 1, 'rma', true, false),
  ('rma_l2', 'RMA ระดับ 2', 'RMA L2', 'RMA (Return Merchandise Authorization) ระดับ 2', 'RMA ระดับ 2', 1, 'rma', true, false),
  ('sale_l1', 'Sale ระดับ 1', 'Sales L1', 'ฝ่ายขายระดับ 1', 'Sale ระดับ 1', 1, 'sales', true, false),
  ('sale_l2', 'Sale ระดับ 2', 'Sales L2', 'ฝ่ายขายระดับ 2', 'Sale ระดับ 2', 1, 'sales', true, false),
  ('technician', 'ช่างเทคนิค', 'Technician', 'ช่างเทคนิคทั่วไป (Legacy)', 'ช่างเทคนิค', 1, 'technical', true, false),
  ('technician_l1', 'ช่างเทคนิค ระดับ 1', 'Technician L1', 'ช่างเทคนิคระดับ 1', 'ช่างเทคนิค ระดับ 1', 0, 'technical', true, false),
  ('technician_l2', 'ช่างเทคนิค ระดับ 2', 'Technician L2', 'ช่างเทคนิคระดับ 2', 'ช่างเทคนิค ระดับ 2', 1, 'technical', true, false),
  ('assigner', 'ผู้จ่ายงาน', 'Assigner', 'ผู้มีหน้าที่จ่ายงานและติดตามงาน (Legacy)', 'ผู้จ่ายงาน', 1, 'general', true, false),
  ('admin', 'ผู้ดูแลระบบ', 'Administrator', 'ผู้ดูแลระบบ', 'Administrator', 2, 'admin', true, false),
  ('superadmin', 'ผู้ดูแลระบบสูงสุด', 'Super Administrator', 'Super administrator with full system access (level 10)', NULL, 3, NULL, true, true),
  ('messenger', 'เมสเซนเจอร์', 'Messenger', NULL, NULL, 0, 'general', true, false),
  ('housekeeper', 'แม่บ้าน', 'House Keeper', NULL, NULL, 0, 'general', true, false),
  ('stock', 'สต๊อก', 'Stock', NULL, NULL, 1, 'general', true, false),
  ('emp_admin', 'แอดมิน', 'Admin', NULL, NULL, 1, 'general', true, false)
) AS v(code, name_th, name_en, description, name, level, dept_code, is_active, requires_auth)
LEFT JOIN public.departments d ON d.code = v.dept_code
ON CONFLICT (code) DO UPDATE SET
  name_th = EXCLUDED.name_th,
  name_en = EXCLUDED.name_en,
  description = EXCLUDED.description,
  name = EXCLUDED.name,
  level = EXCLUDED.level,
  department_id = EXCLUDED.department_id,
  is_active = EXCLUDED.is_active,
  requires_auth = EXCLUDED.requires_auth;

-- =============================================
-- WORK TYPES
-- =============================================

INSERT INTO public.work_types (name, code, created_at)
VALUES
  ('Account', 'account', NOW()),
  ('AGS Battery', 'ags_battery', NOW()),
  ('PM', 'pm', NOW()),
  ('RMA', 'rma', NOW()),
  ('Sales', 'sales', NOW())
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name;

-- =============================================
-- TICKET STATUSES
-- =============================================

INSERT INTO public.ticket_statuses (name, code)
VALUES
  ('Cancelled', 'cancelled'),
  ('Completed', 'completed'),
  ('In Progress', 'in_progress'),
  ('Pending', 'pending')
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name;

-- =============================================
-- LEAVE TYPES
-- =============================================

INSERT INTO public.leave_types (code, name, days_per_year, requires_approval, is_active, created_at)
VALUES
  ('sick_leave', 'ลาป่วย', 30, true, true, NOW()),
  ('personal_leave', 'ลากิจ', 3, true, true, NOW()),
  ('vacation_leave', 'ลาพักร้อน', 6, true, true, NOW())
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  days_per_year = EXCLUDED.days_per_year,
  requires_approval = EXCLUDED.requires_approval,
  is_active = EXCLUDED.is_active;

-- =============================================
-- FEATURES
-- =============================================

INSERT INTO public.feature (id, path, display_name, min_level, icon, group_label, display_order, is_menu_item, allowed_roles, category_order, is_active)
VALUES
  ('edit_tickets', NULL, 'แก้ไขใบงาน', 1, NULL, NULL, 0, false, NULL, 0, true),
  ('manage_roles', NULL, 'จัดการบทบาท', 2, NULL, NULL, 0, false, ARRAY['admin', 'superadmin'], 0, true),
  ('manage_users', NULL, 'จัดการผู้ใช้งาน', 2, NULL, NULL, 0, false, ARRAY['admin', 'superadmin'], 0, true),
  ('map_view', NULL, 'แผนที่', 0, NULL, NULL, 0, false, ARRAY['superadmin'], 0, true),
  ('menu_all_tickets', '/admin/all-tickets', 'งานทั้งหมด', 0, 'List', 'งาน', 5, true, NULL, 2, true),
  ('menu_companies', '/admin/companies', 'บริษัท', 1, 'Building2', 'ข้อมูล', 2, true, NULL, 3, true),
  ('menu_create_user', '/admin/create-user', 'สร้างผู้ใช้', 2, 'UserPlus', 'ผู้ใช้', 1, true, ARRAY['admin', 'superadmin'], 4, true),
  ('menu_departments', '/admin/departments', 'จัดการฝ่าย', 2, 'Building2', 'การจัดการ', 2, true, ARRAY['admin', 'superadmin'], 5, true),
  ('menu_dev_playground', '/admin/dev-playground', 'Playground', 2, 'Code2', 'Development', 1, true, ARRAY['admin', 'superadmin'], 7, true),
  ('menu_home', '/admin', 'หน้าหลัก', 1, 'Home', 'หลัก', 1, true, NULL, 1, true),
  ('menu_leaves', '/admin/leaves', 'การลา', 1, 'Calendar', 'ผู้ใช้', 4, true, NULL, 4, true),
  ('menu_map', '/map', 'แผนที่', 0, 'Map', 'อื่นๆ', 2, true, ARRAY['superadmin'], 6, true),
  ('menu_month_tickets', '/admin/month-tickets', 'งานเดือนนี้', 0, 'Calendar', 'งาน', 4, true, NULL, 2, true),
  ('menu_org_chart', '/admin/org-chart', 'แผนผังองค์กร', 1, 'Network', 'ผู้ใช้', 3, true, NULL, 4, true),
  ('menu_pending_work', '/admin/pending-work', 'งานที่ยังไม่ได้นัด', 1, 'LayoutGrid', 'งาน', 2, true, NULL, 2, true),
  ('menu_polls', '/admin/polls', 'โพล', 1, 'BarChart3', 'อื่นๆ', 2, true, NULL, 6, true),
  ('menu_profile', '/admin/profile', 'โปรไฟล์', 0, 'User', 'ผู้ใช้', 0, true, NULL, 4, true),
  ('menu_ranking', '/admin/ranking', 'อันดับการทำงาน', 2, 'Trophy', 'งาน', 1, true, ARRAY['admin', 'superadmin'], 2, true),
  ('menu_roles', '/admin/roles', 'จัดการบทบาท', 2, 'Shield', 'การจัดการ', 1, true, ARRAY['admin', 'superadmin'], 5, true),
  ('menu_sites', '/admin/sites', 'ไซต์งาน', 1, 'MapPin', 'ข้อมูล', 1, true, NULL, 3, true),
  ('menu_today_tickets', '/admin/today-tickets', 'งานวันนี้', 1, 'Calendar', 'งาน', 0, true, NULL, 2, true),
  ('menu_users', '/admin/users', 'จัดการผู้ใช้งาน', 2, 'Users', 'ผู้ใช้', 2, true, ARRAY['admin', 'superadmin'], 4, true),
  ('menu_week_tickets', '/admin/week-tickets', 'งานอาทิตย์นี้', 0, 'CalendarDays', 'งาน', 3, true, NULL, 2, true),
  ('menu_announcements', '/admin/announcements', 'ประกาศ', 0, 'Megaphone', 'อื่นๆ', 3, true, NULL, 6, true),
  ('work_results', NULL, 'ผลงาน', 3, NULL, NULL, 0, false, ARRAY['superadmin'], 0, true)
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

