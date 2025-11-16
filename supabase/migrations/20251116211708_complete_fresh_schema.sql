-- =============================================
-- Complete Fresh Schema Migration
-- Generated from dev branch (current prod)
-- =============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" SCHEMA extensions;

-- =============================================
-- CUSTOM ENUM TYPES
-- =============================================

CREATE TYPE public.customer_appointment_type AS ENUM (
  'full_day',
  'time_range',
  'half_morning',
  'half_afternoon',
  'call_to_schedule'
);

CREATE TYPE public.half_day_type_enum AS ENUM (
  'morning',
  'afternoon'
);

-- =============================================
-- HELPER FUNCTIONS FOR RLS
-- =============================================

CREATE OR REPLACE FUNCTION public.user_has_min_level(min_level integer)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
AS $$
DECLARE
  user_level integer;
BEGIN
  -- Get the user's role level
  SELECT COALESCE(r.level, 0) INTO user_level
  FROM employees e
  LEFT JOIN roles r ON e.role_id = r.id
  WHERE e.auth_user_id = auth.uid()
  AND e.is_active = true
  LIMIT 1;
  
  -- Return true if user level >= min_level
  RETURN COALESCE(user_level, 0) >= min_level;
END;
$$;

CREATE OR REPLACE FUNCTION public.current_user_is_role_level_gt0()
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
AS $$
BEGIN
  RETURN user_has_min_level(1);
END;
$$;

-- =============================================
-- TABLES
-- =============================================

-- Departments table
CREATE TABLE IF NOT EXISTS public.departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR NOT NULL UNIQUE,
  name_th VARCHAR NOT NULL,
  name_en VARCHAR,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  head_id UUID
);

COMMENT ON TABLE public.departments IS 'Departments/divisions within the organization';
COMMENT ON COLUMN public.departments.head_id IS 'Reference to the employee who is the department head/manager';

-- Roles table
CREATE TABLE IF NOT EXISTS public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR NOT NULL UNIQUE,
  name_th VARCHAR NOT NULL,
  name_en VARCHAR,
  description TEXT,
  name VARCHAR,
  level INTEGER,
  department_id UUID,
  is_active BOOLEAN DEFAULT true,
  requires_auth BOOLEAN DEFAULT false
);

COMMENT ON TABLE public.roles IS 'Metadata for employee roles - display names, descriptions, and settings';
COMMENT ON COLUMN public.roles.department_id IS 'Reference to the department this role belongs to';
COMMENT ON COLUMN public.roles.is_active IS 'Whether this role is currently active';
COMMENT ON COLUMN public.roles.requires_auth IS 'Whether this role requires authentication';

-- Employees table
CREATE TABLE IF NOT EXISTS public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR NOT NULL,
  code VARCHAR NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  auth_user_id UUID,
  nickname VARCHAR,
  email VARCHAR,
  role_id UUID,
  profile_image_url TEXT,
  supervisor_id UUID
);

COMMENT ON COLUMN public.employees.nickname IS 'Optional nickname or preferred name for the employee';
COMMENT ON COLUMN public.employees.email IS 'Optional email address for the employee';
COMMENT ON COLUMN public.employees.profile_image_url IS 'URL to the employee profile image stored in Supabase Storage (profile-image bucket)';
COMMENT ON COLUMN public.employees.supervisor_id IS 'Reference to the employee who is the direct supervisor/manager of this employee';

-- Work types table
CREATE TABLE IF NOT EXISTS public.work_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR NOT NULL,
  code VARCHAR NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ticket statuses table
CREATE TABLE IF NOT EXISTS public.ticket_statuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR NOT NULL,
  code VARCHAR NOT NULL UNIQUE
);

-- Companies table
CREATE TABLE IF NOT EXISTS public.companies (
  tax_id VARCHAR PRIMARY KEY,
  name_th VARCHAR NOT NULL,
  name_en VARCHAR,
  type VARCHAR,
  status VARCHAR,
  objective TEXT,
  objective_code VARCHAR,
  register_date DATE,
  register_capital VARCHAR,
  branch_name VARCHAR,
  address_full TEXT,
  address_no VARCHAR,
  address_moo VARCHAR,
  address_building VARCHAR,
  address_floor VARCHAR,
  address_room_no VARCHAR,
  address_soi VARCHAR,
  address_yaek VARCHAR,
  address_trok VARCHAR,
  address_village VARCHAR,
  address_road VARCHAR,
  address_tambon VARCHAR,
  address_district VARCHAR,
  address_province VARCHAR,
  address_tambon_code VARCHAR,
  address_district_code VARCHAR,
  address_province_code VARCHAR,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  address_detail TEXT
);

COMMENT ON TABLE public.companies IS 'Company information from DBD (Department of Business Development) API';
COMMENT ON COLUMN public.companies.tax_id IS 'เลขประจำตัวผู้เสียภาษี (13 digits) - Primary key';
COMMENT ON COLUMN public.companies.address_detail IS 'รายละเอียดที่อยู่เพิ่มเติม (เช่น บ้านเลขที่, หมู่บ้าน, ซอย, ถนน) - สามารถกรอกด้วยตนเองหรือจากข้อมูล DBD';

-- Sites table
CREATE TABLE IF NOT EXISTS public.sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR NOT NULL,
  address_detail TEXT,
  subdistrict_code INTEGER,
  postal_code INTEGER,
  contact_ids UUID[] DEFAULT ARRAY[]::uuid[],
  map_url TEXT,
  company_id VARCHAR,
  district_code INTEGER,
  province_code INTEGER
);

COMMENT ON COLUMN public.sites.contact_ids IS 'Array of contact IDs associated with this site';
COMMENT ON COLUMN public.sites.map_url IS 'Optional Google Maps URL for the site location';
COMMENT ON COLUMN public.sites.company_id IS 'Reference to companies table via tax_id';

-- Contacts table
CREATE TABLE IF NOT EXISTS public.contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID,
  person_name VARCHAR NOT NULL,
  nickname VARCHAR,
  phone TEXT[],
  email TEXT[],
  line_id VARCHAR,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.contacts IS 'Contact information linked to sites. Can have multiple phone numbers and/or email addresses.';
COMMENT ON COLUMN public.contacts.site_id IS 'Optional reference to the site this contact is associated with';
COMMENT ON COLUMN public.contacts.person_name IS 'Full name of the contact person (required)';
COMMENT ON COLUMN public.contacts.nickname IS 'Optional nickname for the contact';
COMMENT ON COLUMN public.contacts.phone IS 'Array of phone numbers';
COMMENT ON COLUMN public.contacts.email IS 'Array of email addresses';
COMMENT ON COLUMN public.contacts.line_id IS 'Optional LINE ID';
COMMENT ON COLUMN public.contacts.note IS 'Optional notes about the contact';

-- Tickets table
CREATE TABLE IF NOT EXISTS public.tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  details TEXT,
  work_type_id UUID NOT NULL,
  assigner_id UUID NOT NULL,
  status_id UUID NOT NULL,
  additional TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  site_id UUID,
  contact_id UUID,
  work_result_id UUID,
  appointment_id UUID
);

COMMENT ON TABLE public.tickets IS 'Tickets table - now includes 200 mock tickets for testing';
COMMENT ON COLUMN public.tickets.contact_id IS 'Optional reference to a contact person for this ticket';

-- Ticket employees junction table
CREATE TABLE IF NOT EXISTS public.ticket_employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL,
  employee_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Work results table
CREATE TABLE IF NOT EXISTS public.work_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID
);

-- Work result photos table
CREATE TABLE IF NOT EXISTS public.work_result_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_result_id UUID NOT NULL,
  image_url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Work result documents table
CREATE TABLE IF NOT EXISTS public.work_result_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_result_id UUID NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Work result document pages table
CREATE TABLE IF NOT EXISTS public.work_result_document_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL,
  image_url TEXT NOT NULL,
  page_number INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Appointments table
CREATE TABLE IF NOT EXISTS public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID UNIQUE,
  appointment_date DATE,
  appointment_time_start TIME,
  appointment_time_end TIME,
  appointment_type public.customer_appointment_type NOT NULL DEFAULT 'call_to_schedule',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Leave types table
CREATE TABLE IF NOT EXISTS public.leave_types (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  name VARCHAR NOT NULL UNIQUE,
  days_per_year INTEGER,
  requires_approval BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Leave balances table
CREATE TABLE IF NOT EXISTS public.leave_balances (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  employee_id UUID NOT NULL,
  leave_type_id UUID NOT NULL,
  year INTEGER NOT NULL,
  total_days NUMERIC NOT NULL DEFAULT 0,
  used_days NUMERIC NOT NULL DEFAULT 0,
  remaining_days NUMERIC GENERATED ALWAYS AS (total_days - used_days) STORED,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Leave requests table
CREATE TABLE IF NOT EXISTS public.leave_requests (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  employee_id UUID NOT NULL,
  leave_type_id UUID NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  total_days NUMERIC NOT NULL,
  reason TEXT,
  status VARCHAR NOT NULL DEFAULT 'pending',
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  half_day_type public.half_day_type_enum
);

COMMENT ON COLUMN public.leave_requests.half_day_type IS 'Type of half-day leave: morning or afternoon. NULL means full day.';

-- Feature table
CREATE TABLE IF NOT EXISTS public.feature (
  id VARCHAR PRIMARY KEY,
  path VARCHAR,
  display_name VARCHAR,
  min_level INTEGER DEFAULT 0,
  icon TEXT,
  group_label VARCHAR,
  display_order INTEGER DEFAULT 0,
  is_menu_item BOOLEAN DEFAULT false,
  allowed_roles TEXT[],
  category_order INTEGER DEFAULT 0
);

COMMENT ON TABLE public.feature IS 'Feature flags and permissions. min_level: 0=technician_l1, 1=technician/assigner, 2=admin, 3=superadmin';
COMMENT ON COLUMN public.feature.min_level IS 'Minimum employee level required to access this feature (0-3)';
COMMENT ON COLUMN public.feature.icon IS 'Icon name from lucide-react (e.g., Home, Trophy, Users)';
COMMENT ON COLUMN public.feature.group_label IS 'Menu group/category label (e.g., หลัก, งาน, ข้อมูล)';
COMMENT ON COLUMN public.feature.display_order IS 'Display order within the group';
COMMENT ON COLUMN public.feature.is_menu_item IS 'Whether this feature should appear in the sidebar menu';
COMMENT ON COLUMN public.feature.allowed_roles IS 'Array of role codes that can access this feature (null means all authenticated users)';
COMMENT ON COLUMN public.feature.category_order IS 'Display order for the category/group. Categories with lower order values appear first.';

-- App configuration table
CREATE TABLE IF NOT EXISTS public.app_configuration (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR NOT NULL UNIQUE,
  value JSONB NOT NULL,
  description TEXT,
  category VARCHAR,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.app_configuration IS 'Application-wide configuration and feature flags';
COMMENT ON COLUMN public.app_configuration.key IS 'Unique configuration key (e.g., feature.map_view.enabled_roles)';
COMMENT ON COLUMN public.app_configuration.value IS 'JSON value containing the configuration data';
COMMENT ON COLUMN public.app_configuration.description IS 'Human-readable description of what this configuration controls';
COMMENT ON COLUMN public.app_configuration.category IS 'Category grouping (pages, actions, features, system)';

-- Polls table
CREATE TABLE IF NOT EXISTS public.polls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR NOT NULL,
  description TEXT,
  poll_type VARCHAR NOT NULL CHECK (poll_type IN ('single_choice', 'multiple_choice', 'text_input')),
  is_anonymous BOOLEAN NOT NULL DEFAULT false,
  expires_at TIMESTAMPTZ NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.polls IS 'Polls created by employees';

-- Poll options table
CREATE TABLE IF NOT EXISTS public.poll_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID NOT NULL,
  option_text TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.poll_options IS 'Options for polls (only for single_choice and multiple_choice types)';

-- Poll votes table
CREATE TABLE IF NOT EXISTS public.poll_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID NOT NULL,
  employee_id UUID NOT NULL,
  option_id UUID,
  text_answer TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.poll_votes IS 'Votes cast by employees on polls';

-- Rewards table
CREATE TABLE IF NOT EXISTS public.rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rank INTEGER NOT NULL UNIQUE CHECK (rank >= 1),
  title_th TEXT NOT NULL,
  title_en TEXT,
  description TEXT,
  amount NUMERIC,
  icon TEXT,
  color TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.rewards IS 'Rewards for monthly ranking system';

-- =============================================
-- FOREIGN KEY CONSTRAINTS
-- =============================================

-- Departments
ALTER TABLE public.departments
  ADD CONSTRAINT departments_head_id_fkey 
  FOREIGN KEY (head_id) REFERENCES public.employees(id);

-- Roles
ALTER TABLE public.roles
  ADD CONSTRAINT roles_department_id_fkey 
  FOREIGN KEY (department_id) REFERENCES public.departments(id);

-- Employees
ALTER TABLE public.employees
  ADD CONSTRAINT employees_role_id_fkey 
  FOREIGN KEY (role_id) REFERENCES public.roles(id);

ALTER TABLE public.employees
  ADD CONSTRAINT employees_supervisor_id_fkey 
  FOREIGN KEY (supervisor_id) REFERENCES public.employees(id);

ALTER TABLE public.employees
  ADD CONSTRAINT employees_auth_user_id_fkey 
  FOREIGN KEY (auth_user_id) REFERENCES auth.users(id);

-- Sites
ALTER TABLE public.sites
  ADD CONSTRAINT sites_company_id_fkey 
  FOREIGN KEY (company_id) REFERENCES public.companies(tax_id);

-- Contacts
ALTER TABLE public.contacts
  ADD CONSTRAINT contacts_site_id_fkey 
  FOREIGN KEY (site_id) REFERENCES public.sites(id);

-- Tickets
ALTER TABLE public.tickets
  ADD CONSTRAINT tickets_work_type_id_fkey 
  FOREIGN KEY (work_type_id) REFERENCES public.work_types(id);

ALTER TABLE public.tickets
  ADD CONSTRAINT tickets_assigner_id_fkey 
  FOREIGN KEY (assigner_id) REFERENCES public.employees(id);

ALTER TABLE public.tickets
  ADD CONSTRAINT tickets_status_id_fkey 
  FOREIGN KEY (status_id) REFERENCES public.ticket_statuses(id);

ALTER TABLE public.tickets
  ADD CONSTRAINT tickets_site_id_fkey 
  FOREIGN KEY (site_id) REFERENCES public.sites(id);

ALTER TABLE public.tickets
  ADD CONSTRAINT tickets_contact_id_fkey 
  FOREIGN KEY (contact_id) REFERENCES public.contacts(id);

ALTER TABLE public.tickets
  ADD CONSTRAINT tickets_work_result_id_fkey 
  FOREIGN KEY (work_result_id) REFERENCES public.work_results(id);

ALTER TABLE public.tickets
  ADD CONSTRAINT tickets_appointment_id_fkey 
  FOREIGN KEY (appointment_id) REFERENCES public.appointments(id);

-- Ticket employees
ALTER TABLE public.ticket_employees
  ADD CONSTRAINT ticket_employees_ticket_id_fkey 
  FOREIGN KEY (ticket_id) REFERENCES public.tickets(id);

ALTER TABLE public.ticket_employees
  ADD CONSTRAINT ticket_employees_employee_id_fkey 
  FOREIGN KEY (employee_id) REFERENCES public.employees(id);

-- Work results
ALTER TABLE public.work_results
  ADD CONSTRAINT work_results_ticket_id_fkey 
  FOREIGN KEY (ticket_id) REFERENCES public.tickets(id);

ALTER TABLE public.work_results
  ADD CONSTRAINT work_results_created_by_fkey 
  FOREIGN KEY (created_by) REFERENCES public.employees(id);

-- Work result photos
ALTER TABLE public.work_result_photos
  ADD CONSTRAINT work_result_photos_work_result_id_fkey 
  FOREIGN KEY (work_result_id) REFERENCES public.work_results(id);

-- Work result documents
ALTER TABLE public.work_result_documents
  ADD CONSTRAINT work_result_documents_work_result_id_fkey 
  FOREIGN KEY (work_result_id) REFERENCES public.work_results(id);

-- Work result document pages
ALTER TABLE public.work_result_document_pages
  ADD CONSTRAINT work_result_document_pages_document_id_fkey 
  FOREIGN KEY (document_id) REFERENCES public.work_result_documents(id);

-- Appointments
ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_ticket_id_fkey 
  FOREIGN KEY (ticket_id) REFERENCES public.tickets(id);

-- Leave balances
ALTER TABLE public.leave_balances
  ADD CONSTRAINT leave_balances_employee_id_fkey 
  FOREIGN KEY (employee_id) REFERENCES public.employees(id);

ALTER TABLE public.leave_balances
  ADD CONSTRAINT leave_balances_leave_type_id_fkey 
  FOREIGN KEY (leave_type_id) REFERENCES public.leave_types(id);

-- Leave requests
ALTER TABLE public.leave_requests
  ADD CONSTRAINT leave_requests_employee_id_fkey 
  FOREIGN KEY (employee_id) REFERENCES public.employees(id);

ALTER TABLE public.leave_requests
  ADD CONSTRAINT leave_requests_leave_type_id_fkey 
  FOREIGN KEY (leave_type_id) REFERENCES public.leave_types(id);

ALTER TABLE public.leave_requests
  ADD CONSTRAINT leave_requests_approved_by_fkey 
  FOREIGN KEY (approved_by) REFERENCES public.employees(id);

-- Polls
ALTER TABLE public.polls
  ADD CONSTRAINT polls_created_by_fkey 
  FOREIGN KEY (created_by) REFERENCES public.employees(id);

-- Poll options
ALTER TABLE public.poll_options
  ADD CONSTRAINT poll_options_poll_id_fkey 
  FOREIGN KEY (poll_id) REFERENCES public.polls(id);

-- Poll votes
ALTER TABLE public.poll_votes
  ADD CONSTRAINT poll_votes_poll_id_fkey 
  FOREIGN KEY (poll_id) REFERENCES public.polls(id);

ALTER TABLE public.poll_votes
  ADD CONSTRAINT poll_votes_employee_id_fkey 
  FOREIGN KEY (employee_id) REFERENCES public.employees(id);

ALTER TABLE public.poll_votes
  ADD CONSTRAINT poll_votes_option_id_fkey 
  FOREIGN KEY (option_id) REFERENCES public.poll_options(id);

-- =============================================
-- ENABLE ROW LEVEL SECURITY
-- =============================================

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_result_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_result_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_result_document_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_configuration ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rewards ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS POLICIES
-- =============================================

-- Employees policies
CREATE POLICY employees_select_all ON public.employees
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY employee_insert_minl ON public.employees
  FOR INSERT TO authenticated
  WITH CHECK (user_has_min_level(2));

CREATE POLICY employee_update_minl ON public.employees
  FOR UPDATE TO authenticated
  USING (user_has_min_level(2))
  WITH CHECK (user_has_min_level(2));

CREATE POLICY employee_delete_minl ON public.employees
  FOR DELETE TO authenticated
  USING (user_has_min_level(2));

-- Work types policies
CREATE POLICY select_policy ON public.work_types
  FOR SELECT TO authenticated
  USING (user_has_min_level(0));

CREATE POLICY insert_policy ON public.work_types
  FOR INSERT TO authenticated
  WITH CHECK (user_has_min_level(0));

CREATE POLICY update_policy ON public.work_types
  FOR UPDATE TO authenticated
  USING (user_has_min_level(2))
  WITH CHECK (user_has_min_level(2));

CREATE POLICY delete_policy ON public.work_types
  FOR DELETE TO authenticated
  USING (user_has_min_level(2));

-- Ticket statuses policies
CREATE POLICY select_policy ON public.ticket_statuses
  FOR SELECT TO authenticated
  USING (user_has_min_level(0));

CREATE POLICY insert_policy ON public.ticket_statuses
  FOR INSERT TO authenticated
  WITH CHECK (user_has_min_level(1));

CREATE POLICY update_policy ON public.ticket_statuses
  FOR UPDATE TO authenticated
  USING (user_has_min_level(1))
  WITH CHECK (user_has_min_level(1));

CREATE POLICY delete_policy ON public.ticket_statuses
  FOR DELETE TO authenticated
  USING (user_has_min_level(1));

-- Tickets policies
CREATE POLICY tickets_read_l1 ON public.tickets
  FOR SELECT TO authenticated
  USING (current_user_is_role_level_gt0());

CREATE POLICY tickets_insert_l1 ON public.tickets
  FOR INSERT TO authenticated
  WITH CHECK (current_user_is_role_level_gt0());

CREATE POLICY tickets_update_l1 ON public.tickets
  FOR UPDATE TO authenticated
  USING (current_user_is_role_level_gt0())
  WITH CHECK (current_user_is_role_level_gt0());

CREATE POLICY tickets_delete_l1 ON public.tickets
  FOR DELETE TO authenticated
  USING (current_user_is_role_level_gt0());

-- Ticket employees policies
CREATE POLICY select_policy ON public.ticket_employees
  FOR SELECT TO authenticated
  USING (user_has_min_level(0));

CREATE POLICY insert_policy ON public.ticket_employees
  FOR INSERT TO authenticated
  WITH CHECK (user_has_min_level(1));

CREATE POLICY update_policy ON public.ticket_employees
  FOR UPDATE TO authenticated
  USING (user_has_min_level(1))
  WITH CHECK (user_has_min_level(1));

CREATE POLICY delete_policy ON public.ticket_employees
  FOR DELETE TO authenticated
  USING (user_has_min_level(1));

-- Sites policies
CREATE POLICY select_policy ON public.sites
  FOR SELECT TO authenticated
  USING (user_has_min_level(0));

CREATE POLICY insert_policy ON public.sites
  FOR INSERT TO authenticated
  WITH CHECK (user_has_min_level(1));

CREATE POLICY update_policy ON public.sites
  FOR UPDATE TO authenticated
  USING (user_has_min_level(1))
  WITH CHECK (user_has_min_level(1));

CREATE POLICY delete_policy ON public.sites
  FOR DELETE TO authenticated
  USING (user_has_min_level(1));

-- Contacts policies
CREATE POLICY select_policy ON public.contacts
  FOR SELECT TO authenticated
  USING (user_has_min_level(0));

CREATE POLICY insert_policy ON public.contacts
  FOR INSERT TO authenticated
  WITH CHECK (user_has_min_level(1));

CREATE POLICY update_policy ON public.contacts
  FOR UPDATE TO authenticated
  USING (user_has_min_level(1))
  WITH CHECK (user_has_min_level(1));

CREATE POLICY delete_policy ON public.contacts
  FOR DELETE TO authenticated
  USING (user_has_min_level(1));

-- Work results policies
CREATE POLICY select_policy ON public.work_results
  FOR SELECT TO authenticated
  USING (user_has_min_level(0));

CREATE POLICY insert_policy ON public.work_results
  FOR INSERT TO authenticated
  WITH CHECK (user_has_min_level(0));

CREATE POLICY update_policy ON public.work_results
  FOR UPDATE TO authenticated
  USING (user_has_min_level(0))
  WITH CHECK (user_has_min_level(0));

CREATE POLICY delete_policy ON public.work_results
  FOR DELETE TO authenticated
  USING (user_has_min_level(0));

-- Work result photos policies
CREATE POLICY select_policy ON public.work_result_photos
  FOR SELECT TO authenticated
  USING (user_has_min_level(0));

CREATE POLICY insert_policy ON public.work_result_photos
  FOR INSERT TO authenticated
  WITH CHECK (user_has_min_level(0));

CREATE POLICY update_policy ON public.work_result_photos
  FOR UPDATE TO authenticated
  USING (user_has_min_level(0))
  WITH CHECK (user_has_min_level(0));

CREATE POLICY delete_policy ON public.work_result_photos
  FOR DELETE TO authenticated
  USING (user_has_min_level(0));

-- Work result documents policies
CREATE POLICY select_policy ON public.work_result_documents
  FOR SELECT TO authenticated
  USING (user_has_min_level(0));

CREATE POLICY insert_policy ON public.work_result_documents
  FOR INSERT TO authenticated
  WITH CHECK (user_has_min_level(0));

CREATE POLICY update_policy ON public.work_result_documents
  FOR UPDATE TO authenticated
  USING (user_has_min_level(0))
  WITH CHECK (user_has_min_level(0));

CREATE POLICY delete_policy ON public.work_result_documents
  FOR DELETE TO authenticated
  USING (user_has_min_level(0));

-- Work result document pages policies
CREATE POLICY select_policy ON public.work_result_document_pages
  FOR SELECT TO authenticated
  USING (user_has_min_level(0));

CREATE POLICY insert_policy ON public.work_result_document_pages
  FOR INSERT TO authenticated
  WITH CHECK (user_has_min_level(0));

CREATE POLICY update_policy ON public.work_result_document_pages
  FOR UPDATE TO authenticated
  USING (user_has_min_level(0))
  WITH CHECK (user_has_min_level(0));

CREATE POLICY delete_policy ON public.work_result_document_pages
  FOR DELETE TO authenticated
  USING (user_has_min_level(0));

-- Companies policies
CREATE POLICY select_policy ON public.companies
  FOR SELECT TO authenticated
  USING (user_has_min_level(0));

CREATE POLICY insert_policy ON public.companies
  FOR INSERT TO authenticated
  WITH CHECK (user_has_min_level(1));

CREATE POLICY update_policy ON public.companies
  FOR UPDATE TO authenticated
  USING (user_has_min_level(1))
  WITH CHECK (user_has_min_level(1));

CREATE POLICY delete_policy ON public.companies
  FOR DELETE TO authenticated
  USING (user_has_min_level(1));

-- App configuration policies
CREATE POLICY select_policy ON public.app_configuration
  FOR SELECT TO authenticated
  USING (user_has_min_level(0));

CREATE POLICY insert_policy ON public.app_configuration
  FOR INSERT TO authenticated
  WITH CHECK (user_has_min_level(2));

CREATE POLICY update_policy ON public.app_configuration
  FOR UPDATE TO authenticated
  USING (user_has_min_level(2))
  WITH CHECK (user_has_min_level(2));

CREATE POLICY delete_policy ON public.app_configuration
  FOR DELETE TO authenticated
  USING (user_has_min_level(2));

-- Roles policies
CREATE POLICY roles_select_all ON public.roles
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY insert_policy ON public.roles
  FOR INSERT TO authenticated
  WITH CHECK (user_has_min_level(2));

CREATE POLICY update_policy ON public.roles
  FOR UPDATE TO authenticated
  USING (user_has_min_level(2))
  WITH CHECK (user_has_min_level(2));

CREATE POLICY delete_policy ON public.roles
  FOR DELETE TO authenticated
  USING (user_has_min_level(2));

-- Leave types policies
CREATE POLICY select_policy ON public.leave_types
  FOR SELECT TO authenticated
  USING (user_has_min_level(0));

CREATE POLICY insert_policy ON public.leave_types
  FOR INSERT TO authenticated
  WITH CHECK (user_has_min_level(2));

CREATE POLICY update_policy ON public.leave_types
  FOR UPDATE TO authenticated
  USING (user_has_min_level(2))
  WITH CHECK (user_has_min_level(2));

CREATE POLICY delete_policy ON public.leave_types
  FOR DELETE TO authenticated
  USING (user_has_min_level(2));

-- Leave balances policies
CREATE POLICY select_policy ON public.leave_balances
  FOR SELECT TO authenticated
  USING (user_has_min_level(0));

CREATE POLICY insert_policy ON public.leave_balances
  FOR INSERT TO authenticated
  WITH CHECK (user_has_min_level(2));

CREATE POLICY update_policy ON public.leave_balances
  FOR UPDATE TO authenticated
  USING (user_has_min_level(0))
  WITH CHECK (user_has_min_level(0));

CREATE POLICY delete_policy ON public.leave_balances
  FOR DELETE TO authenticated
  USING (user_has_min_level(2));

-- Leave requests policies
CREATE POLICY select_policy ON public.leave_requests
  FOR SELECT TO authenticated
  USING (user_has_min_level(0));

CREATE POLICY insert_policy ON public.leave_requests
  FOR INSERT TO authenticated
  WITH CHECK (user_has_min_level(0));

CREATE POLICY update_policy ON public.leave_requests
  FOR UPDATE TO authenticated
  USING (user_has_min_level(0))
  WITH CHECK (user_has_min_level(0));

CREATE POLICY delete_policy ON public.leave_requests
  FOR DELETE TO authenticated
  USING (user_has_min_level(0));

-- Feature policies
CREATE POLICY select_policy ON public.feature
  FOR SELECT TO authenticated
  USING (user_has_min_level(0));

CREATE POLICY insert_policy ON public.feature
  FOR INSERT TO authenticated
  WITH CHECK (user_has_min_level(1));

CREATE POLICY update_policy ON public.feature
  FOR UPDATE TO authenticated
  USING (user_has_min_level(1))
  WITH CHECK (user_has_min_level(1));

CREATE POLICY delete_policy ON public.feature
  FOR DELETE TO authenticated
  USING (user_has_min_level(1));

-- Appointments policies
CREATE POLICY select_policy ON public.appointments
  FOR SELECT TO authenticated
  USING (user_has_min_level(0));

CREATE POLICY insert_policy ON public.appointments
  FOR INSERT TO authenticated
  WITH CHECK (user_has_min_level(1));

CREATE POLICY update_policy ON public.appointments
  FOR UPDATE TO authenticated
  USING (user_has_min_level(1))
  WITH CHECK (user_has_min_level(1));

CREATE POLICY delete_policy ON public.appointments
  FOR DELETE TO authenticated
  USING (user_has_min_level(1));

-- Polls policies (no prefix needed - table created later)
CREATE POLICY select_policy ON public.polls
  FOR SELECT TO authenticated
  USING (user_has_min_level(0));

CREATE POLICY insert_policy ON public.polls
  FOR INSERT TO authenticated
  WITH CHECK (user_has_min_level(0));

CREATE POLICY update_policy ON public.polls
  FOR UPDATE TO authenticated
  USING (user_has_min_level(0))
  WITH CHECK (user_has_min_level(0));

CREATE POLICY delete_policy ON public.polls
  FOR DELETE TO authenticated
  USING (user_has_min_level(0));

-- Poll options policies (no prefix needed)
CREATE POLICY select_policy ON public.poll_options
  FOR SELECT TO authenticated
  USING (user_has_min_level(0));

CREATE POLICY insert_policy ON public.poll_options
  FOR INSERT TO authenticated
  WITH CHECK (user_has_min_level(0));

CREATE POLICY update_policy ON public.poll_options
  FOR UPDATE TO authenticated
  USING (user_has_min_level(0))
  WITH CHECK (user_has_min_level(0));

CREATE POLICY delete_policy ON public.poll_options
  FOR DELETE TO authenticated
  USING (user_has_min_level(0));

-- Poll votes policies (no prefix needed)
CREATE POLICY select_policy ON public.poll_votes
  FOR SELECT TO authenticated
  USING (user_has_min_level(0));

CREATE POLICY insert_policy ON public.poll_votes
  FOR INSERT TO authenticated
  WITH CHECK (user_has_min_level(0));

CREATE POLICY update_policy ON public.poll_votes
  FOR UPDATE TO authenticated
  USING (user_has_min_level(0))
  WITH CHECK (user_has_min_level(0));

CREATE POLICY delete_policy ON public.poll_votes
  FOR DELETE TO authenticated
  USING (user_has_min_level(0));

-- Departments policies
CREATE POLICY "Anyone can view departments" ON public.departments
  FOR SELECT TO public
  USING (true);

CREATE POLICY "Admins can manage departments" ON public.departments
  FOR ALL TO public
  USING (
    EXISTS (
      SELECT 1
      FROM employees
      WHERE employees.auth_user_id = auth.uid()
        AND EXISTS (
          SELECT 1
          FROM roles
          WHERE roles.id = employees.role_id
            AND roles.level >= 2
        )
    )
  );

-- Rewards policies
CREATE POLICY "Anyone can read active rewards" ON public.rewards
  FOR SELECT TO authenticated
  USING (is_active = true);

CREATE POLICY "Admins can manage rewards" ON public.rewards
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM employees e
      JOIN roles r ON e.role_id = r.id
      WHERE e.auth_user_id = auth.uid()
        AND r.level >= 2
    )
  );

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================

-- Employees indexes
CREATE INDEX idx_employees_auth_user_id ON public.employees(auth_user_id);
CREATE INDEX idx_employees_role_id ON public.employees(role_id);
CREATE INDEX idx_employees_code ON public.employees(code);
CREATE INDEX idx_employees_is_active ON public.employees(is_active);

-- Roles indexes
CREATE INDEX idx_roles_code ON public.roles(code);
CREATE INDEX idx_roles_department_id ON public.roles(department_id);

-- Tickets indexes
CREATE INDEX idx_tickets_work_type_id ON public.tickets(work_type_id);
CREATE INDEX idx_tickets_assigner_id ON public.tickets(assigner_id);
CREATE INDEX idx_tickets_status_id ON public.tickets(status_id);
CREATE INDEX idx_tickets_site_id ON public.tickets(site_id);
CREATE INDEX idx_tickets_appointment_id ON public.tickets(appointment_id);
CREATE INDEX idx_tickets_created_at ON public.tickets(created_at DESC);

-- Ticket employees indexes
CREATE INDEX idx_ticket_employees_ticket_id ON public.ticket_employees(ticket_id);
CREATE INDEX idx_ticket_employees_employee_id ON public.ticket_employees(employee_id);

-- Sites indexes
CREATE INDEX idx_sites_company_id ON public.sites(company_id);

-- Contacts indexes
CREATE INDEX idx_contacts_site_id ON public.contacts(site_id);

-- Work results indexes
CREATE INDEX idx_work_results_ticket_id ON public.work_results(ticket_id);
CREATE INDEX idx_work_results_created_by ON public.work_results(created_by);

-- Appointments indexes
CREATE INDEX idx_appointments_ticket_id ON public.appointments(ticket_id);
CREATE INDEX idx_appointments_date ON public.appointments(appointment_date);

-- Leave requests indexes
CREATE INDEX idx_leave_requests_employee_id ON public.leave_requests(employee_id);
CREATE INDEX idx_leave_requests_status ON public.leave_requests(status);

-- Leave balances indexes
CREATE INDEX idx_leave_balances_employee_id ON public.leave_balances(employee_id);

-- Polls indexes
CREATE INDEX idx_polls_created_by ON public.polls(created_by);
CREATE INDEX idx_polls_expires_at ON public.polls(expires_at);

-- Poll votes indexes
CREATE INDEX idx_poll_votes_poll_id ON public.poll_votes(poll_id);
CREATE INDEX idx_poll_votes_employee_id ON public.poll_votes(employee_id);

-- =============================================
-- GRANT PERMISSIONS
-- =============================================

-- Grant usage on schema
GRANT USAGE ON SCHEMA public TO authenticated, anon;

-- Grant all on all tables
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Grant execute on functions
GRANT EXECUTE ON FUNCTION public.user_has_min_level(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_is_role_level_gt0() TO authenticated;

-- =============================================
-- MIGRATION COMPLETE
-- =============================================

