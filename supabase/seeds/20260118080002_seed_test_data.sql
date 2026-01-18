-- =============================================
-- Migration: Seed Test Data
-- Purpose: Create sample data for local testing
-- =============================================

-- ===========================================
-- Test Employees
-- ===========================================
INSERT INTO main_employees (id, code, name, nickname, email, role_id, is_active) VALUES
  -- Superadmin
  ('00000000-0000-0000-0000-000000000001', 'ADMIN001', 'Super Admin', 'Admin', 'admin@pdeservice.com', '2443de66-4083-40e0-9f4e-3ec963c816d8', true),
  -- Admin
  ('00000000-0000-0000-0000-000000000002', 'ADM002', 'Admin User', 'Admin2', 'admin2@pdeservice.com', '44ec3f3f-b7f2-4fb5-a1b7-63435922a847', true),
  -- Assigner (Level 1)
  ('00000000-0000-0000-0000-000000000003', 'ASN001', 'Test Assigner', 'Assigner', 'assigner@pdeservice.com', 'e4cafe9c-c22b-45bb-b1f8-023fbf7394fd', true),
  -- Technicians (Level 0-1)
  ('00000000-0000-0000-0000-000000000004', 'TECH001', 'Technician One', 'Tech1', 'tech1@pdeservice.com', 'fc347af8-2633-4fb4-a0eb-a3bbe63957a8', true),
  ('00000000-0000-0000-0000-000000000005', 'TECH002', 'Technician Two', 'Tech2', 'tech2@pdeservice.com', 'e238ab2d-adae-4322-9ebb-2fb951c91a8f', true),
  ('00000000-0000-0000-0000-000000000006', 'TECH003', 'Technician Three', 'Tech3', 'tech3@pdeservice.com', '2bf27581-e4e2-49ca-bfd0-90213dad87c9', true),
  -- Sales
  ('00000000-0000-0000-0000-000000000007', 'SALE001', 'Sales Rep One', 'Sales1', 'sales1@pdeservice.com', '38d84907-9182-4643-b766-bba4ca96e4c8', true),
  -- PM
  ('00000000-0000-0000-0000-000000000008', 'PM001', 'PM Manager', 'PM1', 'pm1@pdeservice.com', '1fa838c8-4b59-4ee3-b209-99ca56ab1d11', true),
  -- RMA
  ('00000000-0000-0000-0000-000000000009', 'RMA001', 'RMA Handler', 'RMA1', 'rma1@pdeservice.com', 'cfc01ba4-989b-4cdc-888e-4d2ea710e75d', true),
  -- Stock
  ('00000000-0000-0000-0000-000000000010', 'STK001', 'Stock Keeper', 'Stock', 'stock@pdeservice.com', '5bed8f0d-5f02-4638-85a4-262491db4eda', true)
ON CONFLICT (id) DO UPDATE SET
  code = EXCLUDED.code,
  name = EXCLUDED.name,
  nickname = EXCLUDED.nickname,
  email = EXCLUDED.email,
  role_id = EXCLUDED.role_id,
  is_active = EXCLUDED.is_active;

-- ===========================================
-- Test Companies
-- ===========================================
INSERT INTO main_companies (id, name_th, name_en, tax_id) VALUES
  ('10000000-0000-0000-0000-000000000001', 'บริษัท ทดสอบ จำกัด', 'Test Company Co., Ltd.', '1234567890001'),
  ('10000000-0000-0000-0000-000000000002', 'บริษัท เอบีซี คอร์ปอเรชั่น จำกัด', 'ABC Corporation Co., Ltd.', '1234567890002'),
  ('10000000-0000-0000-0000-000000000003', 'บริษัท ไทย เทค จำกัด', 'Thai Tech Co., Ltd.', '1234567890003'),
  ('10000000-0000-0000-0000-000000000004', 'บริษัท กรุงเทพ อิเลคทรอนิกส์ จำกัด', 'Bangkok Electronics Co., Ltd.', '1234567890004'),
  ('10000000-0000-0000-0000-000000000005', 'บริษัท สยาม พาวเวอร์ จำกัด', 'Siam Power Co., Ltd.', '1234567890005')
ON CONFLICT (id) DO UPDATE SET
  name_th = EXCLUDED.name_th,
  name_en = EXCLUDED.name_en,
  tax_id = EXCLUDED.tax_id;

-- ===========================================
-- Test Sites (Customer Locations)
-- ===========================================
INSERT INTO main_sites (id, name, company_id, address_detail, province_code, district_code, subdistrict_code) VALUES
  -- Test Company Sites
  ('20000000-0000-0000-0000-000000000001', 'Test Company - Head Office', '10000000-0000-0000-0000-000000000001', '123 Sukhumvit Rd', 1, 1001, 100101),
  ('20000000-0000-0000-0000-000000000002', 'Test Company - Branch 1', '10000000-0000-0000-0000-000000000001', '456 Silom Rd', 1, 1002, 100201),
  -- ABC Corporation Sites
  ('20000000-0000-0000-0000-000000000003', 'ABC Corp - Main Office', '10000000-0000-0000-0000-000000000002', '789 Rama 4 Rd', 1, 1003, 100301),
  ('20000000-0000-0000-0000-000000000004', 'ABC Corp - Warehouse', '10000000-0000-0000-0000-000000000002', '321 Bangna-Trad Rd', 2, 1001, 100102),
  -- Thai Tech Sites
  ('20000000-0000-0000-0000-000000000005', 'Thai Tech - Office', '10000000-0000-0000-0000-000000000003', '555 Phahonyothin Rd', 1, 1004, 100401),
  -- Bangkok Electronics Sites
  ('20000000-0000-0000-0000-000000000006', 'Bangkok Electronics - Factory', '10000000-0000-0000-0000-000000000004', '999 Industrial Ring Rd', 2, 1002, 100203),
  -- Siam Power Sites
  ('20000000-0000-0000-0000-000000000007', 'Siam Power - HQ', '10000000-0000-0000-0000-000000000005', '100 Ratchadapisek Rd', 1, 1005, 100501),
  ('20000000-0000-0000-0000-000000000008', 'Siam Power - Service Center', '10000000-0000-0000-0000-000000000005', '200 Lat Phrao Rd', 1, 1006, 100601)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  company_id = EXCLUDED.company_id,
  address_detail = EXCLUDED.address_detail,
  province_code = EXCLUDED.province_code,
  district_code = EXCLUDED.district_code,
  subdistrict_code = EXCLUDED.subdistrict_code;

-- ===========================================
-- Test Site Contacts
-- ===========================================
INSERT INTO child_site_contacts (id, site_id, person_name, nickname, phone, email, note) VALUES
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'John Doe', 'John', ARRAY['0812345678'], ARRAY['john@testcompany.com'], 'IT Manager'),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'Jane Smith', 'Jane', ARRAY['0823456789'], ARRAY['jane@testcompany.com'], 'Assistant'),
  ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000003', 'Bob Wilson', 'Bob', ARRAY['0834567890'], ARRAY['bob@abccorp.com'], 'Facilities Manager'),
  ('30000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000005', 'Alice Johnson', 'Alice', ARRAY['0845678901'], ARRAY['alice@thaitech.com'], 'Operations Lead'),
  ('30000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000007', 'Charlie Brown', 'Charlie', ARRAY['0856789012'], ARRAY['charlie@siampower.com'], 'Technical Lead')
ON CONFLICT (id) DO UPDATE SET
  site_id = EXCLUDED.site_id,
  person_name = EXCLUDED.person_name,
  nickname = EXCLUDED.nickname,
  phone = EXCLUDED.phone,
  email = EXCLUDED.email,
  note = EXCLUDED.note;

-- ===========================================
-- Test Models (Equipment Models)
-- ===========================================
INSERT INTO main_models (id, model, name, name_th, name_en, category, is_active, has_serial) VALUES
  ('40000000-0000-0000-0000-000000000001', 'SMT1500', 'Smart-UPS 1500', 'สมาร์ท-ยูพีเอส 1500', 'Smart-UPS 1500', 'UPS', true, true),
  ('40000000-0000-0000-0000-000000000002', 'SMT2200', 'Smart-UPS 2200', 'สมาร์ท-ยูพีเอส 2200', 'Smart-UPS 2200', 'UPS', true, true),
  ('40000000-0000-0000-0000-000000000003', 'SMT3000', 'Smart-UPS 3000', 'สมาร์ท-ยูพีเอส 3000', 'Smart-UPS 3000', 'UPS', true, true),
  ('40000000-0000-0000-0000-000000000004', 'SY40K', 'Symmetra PX 40kW', 'ซิมเมตตร้า PX 40kW', 'Symmetra PX 40kW', 'UPS', true, true),
  ('40000000-0000-0000-0000-000000000005', 'GVSE100K', 'Galaxy VS 100kW', 'กาแล็กซี่ VS 100kW', 'Galaxy VS 100kW', 'UPS', true, true),
  ('40000000-0000-0000-0000-000000000006', 'AR3100', 'NetShelter SX 42U', 'เน็ตเชลเตอร์ SX 42U', 'NetShelter SX 42U', 'Rack', true, true),
  ('40000000-0000-0000-0000-000000000007', 'RBC24', 'Battery Pack RBC', 'ชุดแบตเตอรี่ RBC', 'Battery Pack RBC', 'Battery', true, true),
  ('40000000-0000-0000-0000-000000000008', 'AP7931', 'PDU Metered', 'พีดียู มิเตอร์', 'PDU Metered', 'PDU', true, false)
ON CONFLICT (id) DO UPDATE SET
  model = EXCLUDED.model,
  name = EXCLUDED.name,
  name_th = EXCLUDED.name_th,
  name_en = EXCLUDED.name_en,
  category = EXCLUDED.category,
  is_active = EXCLUDED.is_active,
  has_serial = EXCLUDED.has_serial;

-- ===========================================
-- Test Appointments (sample future appointments)
-- ===========================================
INSERT INTO main_appointments (id, appointment_date, appointment_time_start, appointment_time_end, appointment_type, is_approved) VALUES
  ('50000000-0000-0000-0000-000000000001', CURRENT_DATE + INTERVAL '1 day', '09:00', '12:00', 'time_range', false),
  ('50000000-0000-0000-0000-000000000002', CURRENT_DATE + INTERVAL '2 days', '13:00', '17:00', 'time_range', false),
  ('50000000-0000-0000-0000-000000000003', CURRENT_DATE + INTERVAL '3 days', NULL, NULL, 'full_day', false),
  ('50000000-0000-0000-0000-000000000004', CURRENT_DATE + INTERVAL '4 days', '09:00', '12:00', 'half_morning', true),
  ('50000000-0000-0000-0000-000000000005', CURRENT_DATE + INTERVAL '5 days', '13:00', '17:00', 'half_afternoon', true)
ON CONFLICT (id) DO UPDATE SET
  appointment_date = EXCLUDED.appointment_date,
  appointment_time_start = EXCLUDED.appointment_time_start,
  appointment_time_end = EXCLUDED.appointment_time_end,
  appointment_type = EXCLUDED.appointment_type,
  is_approved = EXCLUDED.is_approved;

-- ===========================================
-- Test Tickets
-- ===========================================
INSERT INTO main_tickets (id, site_id, work_type_id, status_id, details, assigner_id, created_by, appointment_id) VALUES
  -- PM Tickets
  ('60000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'f1093c78-0680-4181-8284-dc07ab7ba38a', '36491478-9c1f-4635-90e2-a293968314df', 'Scheduled PM maintenance for Smart-UPS 1500', '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000003', '50000000-0000-0000-0000-000000000001'),
  ('60000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000003', 'f1093c78-0680-4181-8284-dc07ab7ba38a', '36491478-9c1f-4635-90e2-a293968314df', 'Annual PM for Galaxy VS system', '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000003', '50000000-0000-0000-0000-000000000002'),
  -- RMA Tickets
  ('60000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000005', 'f243515b-ef8b-484b-8399-988d54fd122f', '6798860c-4555-456a-a995-d89522b8982b', 'URGENT: Battery replacement needed', '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000003', '50000000-0000-0000-0000-000000000003'),
  -- Sales Tickets
  ('60000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000007', '7b2a377b-fe11-478b-9a08-e8e9822d027b', '36491478-9c1f-4635-90e2-a293968314df', 'New UPS installation proposal', '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000007', '50000000-0000-0000-0000-000000000004'),
  -- Survey Ticket
  ('60000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000006', '7a08defc-63e0-4461-b6c4-1dbc34f218d3', '36491478-9c1f-4635-90e2-a293968314df', 'Site survey for new data center', '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000008', '50000000-0000-0000-0000-000000000005')
ON CONFLICT (id) DO UPDATE SET
  site_id = EXCLUDED.site_id,
  work_type_id = EXCLUDED.work_type_id,
  status_id = EXCLUDED.status_id,
  details = EXCLUDED.details,
  assigner_id = EXCLUDED.assigner_id,
  created_by = EXCLUDED.created_by,
  appointment_id = EXCLUDED.appointment_id;

-- ===========================================
-- Assign Technicians to Tickets
-- ===========================================
INSERT INTO jct_ticket_employees (id, ticket_id, employee_id, date, is_key_employee) VALUES
  -- Ticket 1: 2 technicians
  ('70000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000004', CURRENT_DATE + INTERVAL '1 day', true),
  ('70000000-0000-0000-0000-000000000002', '60000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000005', CURRENT_DATE + INTERVAL '1 day', false),
  -- Ticket 2: 1 technician
  ('70000000-0000-0000-0000-000000000003', '60000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000006', CURRENT_DATE + INTERVAL '2 days', true),
  -- Ticket 3: 2 technicians (urgent)
  ('70000000-0000-0000-0000-000000000004', '60000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000004', CURRENT_DATE + INTERVAL '3 days', true),
  ('70000000-0000-0000-0000-000000000005', '60000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000006', CURRENT_DATE + INTERVAL '3 days', false),
  -- Ticket 4: Sales rep
  ('70000000-0000-0000-0000-000000000006', '60000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000007', CURRENT_DATE + INTERVAL '4 days', true),
  -- Ticket 5: PM
  ('70000000-0000-0000-0000-000000000007', '60000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000008', CURRENT_DATE + INTERVAL '5 days', true)
ON CONFLICT (id) DO UPDATE SET
  ticket_id = EXCLUDED.ticket_id,
  employee_id = EXCLUDED.employee_id,
  date = EXCLUDED.date,
  is_key_employee = EXCLUDED.is_key_employee;

-- ===========================================
-- Test Audit Log Entries
-- ===========================================
INSERT INTO child_ticket_audit (id, ticket_id, action, changed_by, old_values, new_values, changed_fields, metadata, created_at) VALUES
  ('80000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', 'created', '00000000-0000-0000-0000-000000000003', NULL, '{"details": "Scheduled PM maintenance for Smart-UPS 1500"}', ARRAY['details', 'site_id', 'work_type_id'], '{}', NOW() - INTERVAL '1 hour'),
  ('80000000-0000-0000-0000-000000000002', '60000000-0000-0000-0000-000000000001', 'employee_assigned', '00000000-0000-0000-0000-000000000003', NULL, '{"employee_id": "00000000-0000-0000-0000-000000000004"}', ARRAY['employee_id'], '{}', NOW() - INTERVAL '30 minutes'),
  ('80000000-0000-0000-0000-000000000003', '60000000-0000-0000-0000-000000000002', 'created', '00000000-0000-0000-0000-000000000003', NULL, '{"details": "Annual PM for Galaxy VS system"}', ARRAY['details', 'site_id', 'work_type_id'], '{}', NOW() - INTERVAL '2 hours'),
  ('80000000-0000-0000-0000-000000000004', '60000000-0000-0000-0000-000000000003', 'created', '00000000-0000-0000-0000-000000000003', NULL, '{"details": "Urgent battery replacement"}', ARRAY['details', 'site_id', 'work_type_id', 'status_id'], '{}', NOW() - INTERVAL '3 hours')
ON CONFLICT (id) DO UPDATE SET
  ticket_id = EXCLUDED.ticket_id,
  action = EXCLUDED.action,
  changed_by = EXCLUDED.changed_by,
  old_values = EXCLUDED.old_values,
  new_values = EXCLUDED.new_values,
  changed_fields = EXCLUDED.changed_fields,
  metadata = EXCLUDED.metadata;

-- Print completion message
DO $$ BEGIN RAISE NOTICE 'Test data seeded successfully: 10 employees, 5 companies, 8 sites, 8 models, 5 tickets'; END $$;
