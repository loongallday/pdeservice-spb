-- =============================================
-- Migration: Seed Reference Data
-- Purpose: Populate all reference tables with production data
-- =============================================

-- ===========================================
-- 1. Departments
-- ===========================================
INSERT INTO main_org_departments (id, code, name_th, name_en, description, is_active) VALUES
  ('6dcd5778-ef2f-4605-8584-b94f7afee0ec', 'admin', 'ฝ่ายบริหาร', 'Administration', 'ฝ่ายบริหารและจัดการ', true),
  ('9832c452-4494-4642-8451-25279a932caf', 'general', 'ทั่วไป', 'General', 'บทบาททั่วไปที่ไม่เฉพาะเจาะจงฝ่าย', true),
  ('10922489-f324-4bfd-8afd-ffa5edcc8eba', 'pm', 'ฝ่าย PM', 'Project Management', 'ฝ่ายบริหารโครงการ', true),
  ('e4b2d701-122a-417e-9680-8fb5746887b4', 'rma', 'ฝ่าย RMA', 'RMA', 'Return Merchandise Authorization', true),
  ('3fb22d7b-9902-453b-a97f-f04a91dd76e0', 'sales', 'ฝ่ายขาย', 'Sales', 'ฝ่ายขายและการตลาด', true),
  ('f7ee1d76-d95d-4fd6-90be-ce5177ecc2be', 'technical', 'ฝ่ายช่าง', 'Technical', 'ฝ่ายช่างเทคนิค', true)
ON CONFLICT (id) DO UPDATE SET
  code = EXCLUDED.code,
  name_th = EXCLUDED.name_th,
  name_en = EXCLUDED.name_en,
  description = EXCLUDED.description,
  is_active = EXCLUDED.is_active;

-- ===========================================
-- 2. Roles
-- ===========================================
INSERT INTO main_org_roles (id, code, name_th, name_en, description, level, department_id, is_active, requires_auth) VALUES
  -- Level 0 (Read-only)
  ('25a24fac-8e85-4594-86b8-2d0dcde8c537', 'messenger', 'เมสเซนเจอร์', 'Messenger', NULL, 0, 'f7ee1d76-d95d-4fd6-90be-ce5177ecc2be', true, false),
  ('fc347af8-2633-4fb4-a0eb-a3bbe63957a8', 'technician_l1', 'ช่างเทคนิค ระดับ 1', 'Technician L1', 'ช่างเทคนิคระดับ 1', 0, 'f7ee1d76-d95d-4fd6-90be-ce5177ecc2be', true, false),
  ('5d260ba4-c3e2-4373-9a7a-7966ec51a714', 'housekeeper', 'แม่บ้าน', 'House Keeper', NULL, 0, '9832c452-4494-4642-8451-25279a932caf', true, false),
  -- Level 1 (Create/Update)
  ('157286ac-d51a-41dd-b6f8-f58b3e702143', 'rma_l2', 'RMA ระดับ 2', 'RMA L2', 'RMA (Return Merchandise Authorization) ระดับ 2', 1, 'e4b2d701-122a-417e-9680-8fb5746887b4', true, false),
  ('38d84907-9182-4643-b766-bba4ca96e4c8', 'sale_l1', 'Sale ระดับ 1', 'Sales L1', 'ฝ่ายขายระดับ 1', 1, '3fb22d7b-9902-453b-a97f-f04a91dd76e0', true, false),
  ('6f1dcb75-29de-4a7e-aaf9-28b567cb008c', 'sale_l2', 'Sale ระดับ 2', 'Sales L2', 'ฝ่ายขายระดับ 2', 1, '3fb22d7b-9902-453b-a97f-f04a91dd76e0', true, false),
  ('2bf27581-e4e2-49ca-bfd0-90213dad87c9', 'technician', 'ช่างเทคนิค', 'Technician', 'ช่างเทคนิคทั่วไป (Legacy)', 1, 'f7ee1d76-d95d-4fd6-90be-ce5177ecc2be', true, false),
  ('5bed8f0d-5f02-4638-85a4-262491db4eda', 'stock', 'สต๊อก', 'Stock', NULL, 1, '9832c452-4494-4642-8451-25279a932caf', true, false),
  ('e238ab2d-adae-4322-9ebb-2fb951c91a8f', 'technician_l2', 'ช่างเทคนิค ระดับ 2', 'Technician L2', 'ช่างเทคนิคระดับ 2', 1, 'f7ee1d76-d95d-4fd6-90be-ce5177ecc2be', true, false),
  ('e4cafe9c-c22b-45bb-b1f8-023fbf7394fd', 'assigner', 'ผู้จ่ายงาน', 'Assigner', 'ผู้มีหน้าที่จ่ายงานและติดตามงาน (Legacy)', 1, '9832c452-4494-4642-8451-25279a932caf', true, false),
  ('1fa838c8-4b59-4ee3-b209-99ca56ab1d11', 'pm_l1', 'PM ระดับ 1', 'PM L1', 'Project Manager ระดับ 1', 1, '10922489-f324-4bfd-8afd-ffa5edcc8eba', true, false),
  ('80ac673d-9bae-4a60-978a-5e5b161a172f', 'emp_admin', 'แอดมิน', 'Admin', NULL, 1, '9832c452-4494-4642-8451-25279a932caf', true, false),
  ('5100597c-c43c-49de-87ad-aa1c250200eb', 'pm_l2', 'PM ระดับ 2', 'PM L2', 'Project Manager ระดับ 2', 1, '10922489-f324-4bfd-8afd-ffa5edcc8eba', true, false),
  ('cfc01ba4-989b-4cdc-888e-4d2ea710e75d', 'rma_l1', 'RMA ระดับ 1', 'RMA L1', 'RMA (Return Merchandise Authorization) ระดับ 1', 1, 'e4b2d701-122a-417e-9680-8fb5746887b4', true, false),
  ('fe22b47c-5f6c-45e7-b232-6c289820f0fc', 'purchase', 'จัดซื้อ', 'Purchase', NULL, NULL, '9832c452-4494-4642-8451-25279a932caf', true, false),
  -- Level 2 (Admin)
  ('44ec3f3f-b7f2-4fb5-a1b7-63435922a847', 'admin', 'ผู้ดูแลระบบ', 'Administrator', 'ผู้ดูแลระบบ', 2, '6dcd5778-ef2f-4605-8584-b94f7afee0ec', true, false),
  -- Level 3 (Superadmin)
  ('2443de66-4083-40e0-9f4e-3ec963c816d8', 'superadmin', 'ผู้ดูแลระบบสูงสุด', 'Super Administrator', 'Super administrator with full system access (level 10)', 3, NULL, true, true)
ON CONFLICT (id) DO UPDATE SET
  code = EXCLUDED.code,
  name_th = EXCLUDED.name_th,
  name_en = EXCLUDED.name_en,
  description = EXCLUDED.description,
  level = EXCLUDED.level,
  department_id = EXCLUDED.department_id,
  is_active = EXCLUDED.is_active,
  requires_auth = EXCLUDED.requires_auth;

-- ===========================================
-- 3. Ticket Statuses
-- ===========================================
INSERT INTO ref_ticket_statuses (id, code, name, is_active) VALUES
  ('36491478-9c1f-4635-90e2-a293968314df', 'normal', 'ปกติ', true),
  ('6798860c-4555-456a-a995-d89522b8982b', 'urgent', 'เร่งด่วน', true)
ON CONFLICT (id) DO UPDATE SET
  code = EXCLUDED.code,
  name = EXCLUDED.name,
  is_active = EXCLUDED.is_active;

-- ===========================================
-- 4. Ticket Work Types
-- ===========================================
INSERT INTO ref_ticket_work_types (id, code, name, is_active) VALUES
  ('a0f4a887-dfe7-496b-851b-e09165ce343f', 'account', 'Account', true),
  ('ae14043e-3ca0-4afc-b5d4-341f6f3e06ca', 'ags_battery', 'AGS', true),
  ('9c3c46e3-c228-433d-8fec-1839030edefb', 'pickup', 'Package', true),
  ('f1093c78-0680-4181-8284-dc07ab7ba38a', 'pm', 'PM', true),
  ('f243515b-ef8b-484b-8399-988d54fd122f', 'rma', 'RMA', true),
  ('7b2a377b-fe11-478b-9a08-e8e9822d027b', 'sales', 'Sales', true),
  ('2f6f098f-a156-4bfc-97e9-bb7db9efbc7b', 'start_up', 'Start UP', true),
  ('7a08defc-63e0-4461-b6c4-1dbc34f218d3', 'survey', 'Survey', true)
ON CONFLICT (id) DO UPDATE SET
  code = EXCLUDED.code,
  name = EXCLUDED.name,
  is_active = EXCLUDED.is_active;

-- ===========================================
-- 5. Leave Types
-- ===========================================
INSERT INTO ref_leave_types (id, code, name, days_per_year, requires_approval, is_active) VALUES
  ('06a5468b-6082-48c4-993c-f42076644c42', 'personal_leave', 'ลากิจ', 3, true, true),
  ('7d1dc398-eb6a-440c-9189-48453c3cb969', 'sick_leave', 'ลาป่วย', 30, true, true),
  ('fb27ad28-34d1-47e3-9417-52e856869c23', 'vacation_leave', 'ลาพักร้อน', 5, true, true)
ON CONFLICT (id) DO UPDATE SET
  code = EXCLUDED.code,
  name = EXCLUDED.name,
  days_per_year = EXCLUDED.days_per_year,
  requires_approval = EXCLUDED.requires_approval,
  is_active = EXCLUDED.is_active;

-- ===========================================
-- 6. Work Givers
-- ===========================================
INSERT INTO ref_work_givers (id, code, name, is_active) VALUES
  ('8a4e624f-7bf0-4cfa-ab75-f477ce17331a', 'APC', 'APC', true),
  ('decc730c-3a9e-4051-91f6-0a06b2a20f72', 'APC_INGRAM', 'APC - INGRAM', true),
  ('7e3d2b9c-9970-4e75-8994-f54e0d1ec51d', 'APC_S_DISTRIBUTION', 'APC - S Distribution', true),
  ('c37cab5f-6a10-48c9-8a11-9f6d3b9c7732', 'APC_SIS', 'APC - SIS', true),
  ('d3312bb5-2fc8-4820-8217-ab1bb5f35179', 'APC_SYNNEX', 'APC - SYNNEX', true),
  ('ba34d6a7-95d8-4cc5-a839-d82e3876a314', 'APC_VST', 'APC - VST', true),
  ('19831209-e70e-499b-a741-538718a95ac4', 'PDE', 'PDE', true),
  ('19639270-e9fa-4fa4-a1aa-e923cdeeede0', 'PDE_INGRAM', 'PDE - INGRAM', true),
  ('0cd08d48-9940-48e1-949e-de939553183d', 'PDE_S_DISTRIBUTION', 'PDE - S Distribution', true),
  ('8482e77f-63c4-4878-ba19-6ec473bfa16e', 'PDE_SIS', 'PDE - SIS', true),
  ('194be75e-b17a-44fd-b197-c14f9dcf8e1b', 'PDE_SYNNEX', 'PDE - SYNNEX', true),
  ('39724cc7-0f3f-49c6-b1c5-30f2f94272cf', 'PDE_IT_SOLUTION', 'PDE - IT Solution', true),
  ('e58d2436-c265-40f0-806f-d86658a94422', 'PDE_KDDI', 'PDE - KDDI', true)
ON CONFLICT (id) DO UPDATE SET
  code = EXCLUDED.code,
  name = EXCLUDED.name,
  is_active = EXCLUDED.is_active;

-- ===========================================
-- 7. Features (Menu Items)
-- ===========================================
INSERT INTO main_features (id, path, display_name, min_level, icon, group_label, display_order, is_menu_item, allowed_roles, category_order, is_active) VALUES
  ('menu_home', '/admin', 'หน้าหลัก', 1, 'Home', 'หลัก', 1, true, NULL, 1, true),
  ('menu_todos', '/admin/todos', 'รายการที่ต้องทำ', 0, 'CheckSquare', 'งาน', 1, true, NULL, 3, true),
  ('menu_tickets_watching', '/admin/watched-tickets', 'งานที่ติดตาม', 0, 'Eye', 'งาน', 2, true, NULL, 3, true),
  ('menu_today_tickets', '/admin/today-tickets', 'งานวันนี้', 0, 'Calendar', 'งาน', 3, true, NULL, 3, true),
  ('menu_week_tickets', '/admin/week-tickets', 'งานอาทิตย์นี้', 0, 'CalendarDays', 'งาน', 4, true, NULL, 3, true),
  ('menu_month_tickets', '/admin/month-tickets', 'งานเดือนนี้', 0, 'Calendar', 'งาน', 5, true, NULL, 3, true),
  ('menu_all_tickets', '/admin/all-tickets', 'งานทั้งหมด', 0, 'List', 'งาน', 6, true, NULL, 3, true),
  ('menu_map', '/map', 'งานตามแผนที่', 0, 'Map', 'งาน', 7, true, NULL, 3, true),
  ('menu_work_estimates', '/admin/work-estimates', 'เวลาทำงาน', 1, 'Clock', 'งาน', 9, true, NULL, 3, true),
  ('menu_companies', '/admin/companies', 'บริษัท', 1, 'Building2', 'ข้อมูล', 1, true, NULL, 4, true),
  ('menu_sites', '/admin/sites', 'ไซต์งาน', 0, 'MapPin', 'ข้อมูล', 2, true, NULL, 4, true),
  ('menu_merchandise', '/admin/merchandise', 'อุปกรณ์', 1, 'Package', 'ข้อมูล', 3, true, NULL, 4, true),
  ('menu_models', '/admin/models', 'รุ่นเครื่อง', 1, 'Box', 'ข้อมูล', 4, true, NULL, 4, true),
  ('menu_stock', '/admin/stock', 'คลังสินค้า', 1, 'Package', 'ข้อมูล', 5, true, ARRAY['stock', 'superadmin'], 4, true),
  ('menu_fleet', '/admin/fleet', 'ยานพาหนะ', 1, 'Truck', 'ข้อมูล', 6, true, NULL, 4, true),
  ('menu_announcements', '/admin/announcements', 'ประกาศ', 0, 'List', 'ข้อมูล', 7, true, NULL, 4, true),
  ('menu_profile', '/admin/profile', 'โปรไฟล์', 0, 'User', 'ผู้ใช้', 1, true, NULL, 5, true),
  ('menu_roles', '/admin/roles', 'จัดการบทบาท', 2, 'Shield', 'เมนูผู้ดูแลระบบ', 1, true, ARRAY['admin', 'superadmin'], 6, true),
  ('menu_departments', '/admin/departments', 'จัดการฝ่าย', 2, 'Building2', 'เมนูผู้ดูแลระบบ', 2, true, ARRAY['admin', 'superadmin'], 6, true),
  ('menu_create_user', '/admin/create-user', 'สร้างผู้ใช้', 2, 'UserPlus', 'เมนูผู้ดูแลระบบ', 3, true, ARRAY['admin', 'superadmin'], 6, true),
  ('menu_users', '/admin/users', 'จัดการผู้ใช้งาน', 2, 'Users', 'เมนูผู้ดูแลระบบ', 4, true, ARRAY['admin', 'superadmin'], 6, true),
  ('menu_reports_daily', '/admin/reports/daily', 'รายงานประจำวัน', 3, 'BarChart2', 'เมนูผู้ดูแลระบบ', 5, true, ARRAY['superadmin'], 6, true),
  ('menu_reports_technician_analytics', '/admin/reports/technician-analytics', 'วิเคราะห์ช่าง', 3, 'Users', 'เมนูผู้ดูแลระบบ', 6, true, ARRAY['superadmin'], 6, true),
  ('merchandise_detail', '/admin/merchandise/:id', 'รายละเอียดอุปกรณ์', 1, 'Box', 'งาน', 0, false, NULL, 0, true),
  ('menu_sales', '/admin/sales', 'ขาย', 3, 'ShoppingCart', 'พาณิชย์', 1, true, NULL, 2, true)
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

-- Print completion message
DO $$ BEGIN RAISE NOTICE 'Reference data seeded successfully'; END $$;
