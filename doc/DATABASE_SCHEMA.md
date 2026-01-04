# PDE Service - Database Schema Documentation

**Last Updated:** January 2, 2026  
**Database:** PostgreSQL (Supabase)

---

## Table of Contents

1. [Naming Conventions](#naming-conventions)
2. [Main Tables](#main-tables)
3. [Junction Tables](#junction-tables)
4. [Child Tables](#child-tables)
5. [Extension Tables](#extension-tables)
6. [Reference Tables](#reference-tables)
7. [System Tables](#system-tables)
8. [Views](#views)
9. [Entity Relationships](#entity-relationships)

---

## Naming Conventions

| Prefix | Type | Description |
|--------|------|-------------|
| `main_` | Main Tables | Primary business entities |
| `jct_` | Junction Tables | Many-to-many relationships |
| `child_` | Child Tables | 1:N dependent tables |
| `ext_` | Extension Tables | 1:1 extended data |
| `ref_` | Reference Tables | Lookup/catalog data |
| `sys_` | System Tables | Internal system data |
| `v_` | Views | Materialized or regular views |
| `fn_` | Functions | Database functions |
| `fn_trg_` | Trigger Functions | Functions used by triggers |

---

## Main Tables

### main_employees
**Purpose:** Employee records  
**Rows:** 48

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | uuid | ❌ | Primary key |
| code | varchar | ❌ | Unique employee code |
| name | varchar | ❌ | Full name |
| email | varchar | ✅ | Email address |
| nickname | varchar | ✅ | Preferred name |
| is_active | boolean | ✅ | Active status (default: true) |
| role_id | uuid | ✅ | FK → main_org_roles |
| auth_user_id | uuid | ✅ | FK → auth.users |
| supervisor_id | uuid | ✅ | FK → main_employees (self) |
| profile_image_url | text | ✅ | Profile image URL |
| created_at | timestamptz | ✅ | Created timestamp |
| updated_at | timestamptz | ✅ | Updated timestamp |

---

### main_org_roles
**Purpose:** Employee roles with permissions  
**Rows:** 17

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | uuid | ❌ | Primary key |
| code | varchar | ❌ | Unique role code |
| name_th | varchar | ❌ | Thai name |
| name_en | varchar | ✅ | English name |
| name | varchar | ✅ | Display name |
| description | text | ✅ | Description |
| level | integer | ✅ | Permission level (0-10) |
| department_id | uuid | ✅ | FK → main_org_departments |
| is_active | boolean | ✅ | Active status |
| requires_auth | boolean | ✅ | Requires auth account |
| created_at | timestamptz | ❌ | Created timestamp |
| updated_at | timestamptz | ❌ | Updated timestamp |

---

### main_org_departments
**Purpose:** Organizational departments  
**Rows:** 6

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | uuid | ❌ | Primary key |
| code | varchar | ❌ | Unique department code |
| name_th | varchar | ❌ | Thai name |
| name_en | varchar | ✅ | English name |
| description | text | ✅ | Description |
| is_active | boolean | ✅ | Active status |
| head_id | uuid | ✅ | FK → main_employees (department head) |
| created_at | timestamptz | ✅ | Created timestamp |
| updated_at | timestamptz | ✅ | Updated timestamp |

---

### main_tickets
**Purpose:** Work tickets  
**Rows:** 653

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | uuid | ❌ | Primary key |
| details | text | ✅ | Ticket description |
| additional | text | ✅ | Additional notes |
| work_type_id | uuid | ❌ | FK → ref_ticket_work_types |
| status_id | uuid | ❌ | FK → ref_ticket_statuses |
| site_id | uuid | ✅ | FK → main_sites |
| contact_id | uuid | ✅ | FK → child_site_contacts |
| appointment_id | uuid | ✅ | FK → main_appointments |
| assigner_id | uuid | ❌ | FK → main_employees (assigner) |
| created_by | uuid | ✅ | FK → main_employees (creator) |
| created_at | timestamptz | ✅ | Created timestamp |
| updated_at | timestamptz | ✅ | Updated timestamp |

---

### main_appointments
**Purpose:** Appointment scheduling  
**Rows:** 652

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | uuid | ❌ | Primary key |
| appointment_date | date | ✅ | Scheduled date |
| appointment_time_start | time | ✅ | Start time |
| appointment_time_end | time | ✅ | End time |
| appointment_type | enum | ❌ | Type (full_day, time_range, half_morning, half_afternoon, call_to_schedule) |
| is_approved | boolean | ❌ | Approval status |
| created_at | timestamptz | ✅ | Created timestamp |
| updated_at | timestamptz | ✅ | Updated timestamp |

---

### main_companies
**Purpose:** Company information from DBD API  
**Rows:** 420

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | uuid | ❌ | Primary key (UUID) |
| tax_id | varchar | ❌ | Tax ID (unique, from DBD) |
| name_th | varchar | ❌ | Thai name |
| name_en | varchar | ✅ | English name |
| type | varchar | ✅ | Company type |
| status | varchar | ✅ | Registration status |
| objective | text | ✅ | Business objective |
| objective_code | varchar | ✅ | Objective code |
| register_date | date | ✅ | Registration date |
| register_capital | varchar | ✅ | Registered capital |
| branch_name | varchar | ✅ | Branch name |
| address_* | various | ✅ | Address fields |
| created_at | timestamptz | ✅ | Created timestamp |
| updated_at | timestamptz | ✅ | Updated timestamp |

---

### main_sites
**Purpose:** Customer sites/locations  
**Rows:** 684

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | uuid | ❌ | Primary key |
| name | varchar | ❌ | Site name |
| address_detail | text | ✅ | Full address |
| company_id | uuid | ✅ | FK → main_companies |
| subdistrict_code | integer | ✅ | Subdistrict code |
| district_code | integer | ✅ | District code |
| province_code | integer | ✅ | Province code |
| postal_code | integer | ✅ | Postal code |
| contact_ids | uuid[] | ✅ | Array of contact IDs |
| map_url | text | ✅ | Google Maps URL |
| is_main_branch | boolean | ✅ | Main branch flag |
| safety_standard | enum[] | ✅ | Required safety standards |

---

### main_merchandise
**Purpose:** Merchandise/equipment at sites  
**Rows:** 185

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | uuid | ❌ | Primary key |
| serial_no | text | ❌ | Serial number |
| model_id | uuid | ❌ | FK → main_models |
| site_id | uuid | ❌ | FK → main_sites |
| distributor_id | uuid | ✅ | FK → main_companies |
| dealer_id | uuid | ✅ | FK → main_companies |
| pm_count | integer | ✅ | Max PM count before warranty renewal |
| replaced_by_id | uuid | ✅ | FK → main_merchandise (replacement) |
| created_at | timestamptz | ❌ | Created timestamp |
| updated_at | timestamptz | ❌ | Updated timestamp |

---

### main_models
**Purpose:** Product model catalog  
**Rows:** 73

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | uuid | ❌ | Primary key |
| model | text | ❌ | Unique model identifier |
| name | text | ✅ | Display name |
| website_url | text | ✅ | Documentation URL |
| created_at | timestamptz | ❌ | Created timestamp |
| updated_at | timestamptz | ❌ | Updated timestamp |

---

### main_features
**Purpose:** Feature flags and permissions  
**Rows:** 17

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | varchar | ❌ | Primary key (feature code) |
| path | varchar | ✅ | Route path |
| display_name | varchar | ✅ | Display name |
| min_level | integer | ✅ | Minimum required level |
| icon | text | ✅ | Icon identifier |
| group_label | varchar | ✅ | Menu group |
| display_order | integer | ✅ | Display order |
| category_order | integer | ✅ | Category order |
| is_menu_item | boolean | ✅ | Show in menu |
| is_active | boolean | ✅ | Active status |
| allowed_roles | text[] | ✅ | Allowed role codes |
| created_at | timestamptz | ❌ | Created timestamp |
| updated_at | timestamptz | ❌ | Updated timestamp |

---

### main_announcements
**Purpose:** System announcements  
**Rows:** 1

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | uuid | ❌ | Primary key |
| message | text | ❌ | Announcement content |
| created_at | timestamptz | ❌ | Created timestamp |
| updated_at | timestamptz | ❌ | Updated timestamp |

---

## Junction Tables

### jct_ticket_employees
**Purpose:** Tickets ↔ Employees assignment  
**Rows:** 263

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | uuid | ❌ | Primary key |
| ticket_id | uuid | ❌ | FK → main_tickets |
| employee_id | uuid | ❌ | FK → main_employees |
| date | date | ❌ | Assignment date |
| is_key_employee | boolean | ❌ | Key employee flag |
| created_at | timestamptz | ✅ | Created timestamp |

**Unique constraint:** (ticket_id, employee_id, date)

---

### jct_ticket_merchandise
**Purpose:** Tickets ↔ Merchandise  
**Rows:** 143

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | uuid | ❌ | Primary key |
| ticket_id | uuid | ❌ | FK → main_tickets |
| merchandise_id | uuid | ❌ | FK → main_merchandise |
| created_at | timestamptz | ❌ | Created timestamp |

---

### jct_site_employee_trainings
**Purpose:** Sites ↔ Employees training records  
**Rows:** 0

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | uuid | ❌ | Primary key |
| site_id | uuid | ❌ | FK → main_sites |
| employee_id | uuid | ❌ | FK → main_employees |
| trained_at | date | ❌ | Training date |
| created_at | timestamptz | ❌ | Created timestamp |

---

### jct_model_package_items
**Purpose:** Models ↔ Package items  
**Rows:** 0

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | uuid | ❌ | Primary key |
| model_id | uuid | ❌ | FK → main_models |
| item_id | uuid | ❌ | FK → ref_package_items |
| quantity | integer | ❌ | Quantity (default: 1) |
| note | text | ✅ | Additional notes |
| display_order | integer | ✅ | Display order |
| created_at | timestamptz | ✅ | Created timestamp |

---

### jct_model_package_services
**Purpose:** Models ↔ Package services  
**Rows:** 0

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | uuid | ❌ | Primary key |
| model_id | uuid | ❌ | FK → main_models |
| service_id | uuid | ❌ | FK → ref_package_services |
| terms | text | ✅ | Service terms |
| note | text | ✅ | Additional notes |
| display_order | integer | ✅ | Display order |
| created_at | timestamptz | ✅ | Created timestamp |

---

### jct_appointment_approvers
**Purpose:** Appointment approval permissions  
**Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | uuid | ❌ | Primary key |
| employee_id | uuid | ❌ | FK → main_employees |
| created_at | timestamptz | ❌ | Created timestamp |
| updated_at | timestamptz | ❌ | Updated timestamp |

---

## Child Tables

### child_site_contacts
**Purpose:** Contact persons at sites (child of main_sites)  
**Rows:** 504

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | uuid | ❌ | Primary key |
| site_id | uuid | ✅ | FK → main_sites |
| person_name | varchar | ❌ | Contact name |
| nickname | varchar | ✅ | Nickname |
| phone | text[] | ✅ | Phone numbers |
| email | text[] | ✅ | Email addresses |
| line_id | varchar | ✅ | LINE ID |
| note | text | ✅ | Notes |
| created_at | timestamptz | ✅ | Created timestamp |
| updated_at | timestamptz | ✅ | Updated timestamp |

---

### child_ticket_audit
**Purpose:** Audit trail for tickets  
**Rows:** 697

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | uuid | ❌ | Primary key |
| ticket_id | uuid | ❌ | FK → main_tickets |
| action | varchar | ❌ | Action (created, updated, deleted) |
| changed_by | uuid | ❌ | FK → main_employees |
| old_values | jsonb | ✅ | Previous values |
| new_values | jsonb | ✅ | New values |
| changed_fields | text[] | ✅ | Changed field names |
| metadata | jsonb | ✅ | Additional metadata |
| created_at | timestamptz | ❌ | Created timestamp |

---

### child_employee_leave_balances
**Purpose:** Leave balance per employee per year  
**Rows:** 12

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | uuid | ❌ | Primary key |
| employee_id | uuid | ❌ | FK → main_employees |
| leave_type_id | uuid | ❌ | FK → ref_leave_types |
| year | integer | ❌ | Year |
| total_days | numeric | ❌ | Total allocated days |
| used_days | numeric | ❌ | Days used |
| remaining_days | numeric | ✅ | Generated: total_days - used_days |
| created_at | timestamptz | ✅ | Created timestamp |
| updated_at | timestamptz | ✅ | Updated timestamp |

---

### child_employee_leave_requests
**Purpose:** Leave requests  
**Rows:** 0

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | uuid | ❌ | Primary key |
| employee_id | uuid | ❌ | FK → main_employees |
| leave_type_id | uuid | ❌ | FK → ref_leave_types |
| start_date | date | ❌ | Start date |
| end_date | date | ❌ | End date |
| total_days | numeric | ❌ | Total days |
| half_day_type | enum | ✅ | morning, afternoon, or NULL (full day) |
| reason | text | ✅ | Leave reason |
| status | varchar | ❌ | Status (pending, approved, rejected, cancelled) |
| approved_by | uuid | ✅ | FK → main_employees |
| approved_at | timestamptz | ✅ | Approval timestamp |
| created_at | timestamptz | ✅ | Created timestamp |
| updated_at | timestamptz | ✅ | Updated timestamp |

---

### child_announcement_photos
**Purpose:** Photo attachments for announcements  
**Rows:** 2

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | uuid | ❌ | Primary key |
| announcement_id | uuid | ❌ | FK → main_announcements |
| image_url | text | ❌ | Photo URL |
| display_order | integer | ✅ | Display order |
| created_at | timestamptz | ❌ | Created timestamp |

---

### child_announcement_files
**Purpose:** File attachments for announcements  
**Rows:** 1

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | uuid | ❌ | Primary key |
| announcement_id | uuid | ❌ | FK → main_announcements |
| file_url | text | ❌ | File URL |
| file_name | text | ❌ | Original filename |
| file_size | integer | ✅ | Size in bytes |
| mime_type | text | ✅ | MIME type |
| created_at | timestamptz | ❌ | Created timestamp |

---

## Extension Tables

### ext_model_specifications
**Purpose:** Technical specifications for models (1:1)  
**Rows:** 1

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | uuid | ❌ | Primary key |
| model_id | uuid | ❌ | FK → main_models (unique) |
| capacity_va | integer | ✅ | Capacity in VA |
| capacity_watts | integer | ✅ | Capacity in Watts |
| power_factor | numeric | ✅ | Power factor |
| input_voltage_* | various | ✅ | Input specifications |
| output_voltage_* | various | ✅ | Output specifications |
| battery_* | various | ✅ | Battery specifications |
| runtime_* | various | ✅ | Runtime specifications |
| dimensions_wxdxh | varchar | ✅ | Dimensions |
| weight_kg | numeric | ✅ | Weight |
| communication_ports | text[] | ✅ | Ports (USB, RS-232, SNMP) |
| has_lcd_display | boolean | ✅ | LCD display flag |
| has_avr | boolean | ✅ | AVR flag |
| has_surge_protection | boolean | ✅ | Surge protection flag |
| certifications | text[] | ✅ | Certifications |
| additional_specs | jsonb | ✅ | Extra specifications |
| created_at | timestamptz | ✅ | Created timestamp |
| updated_at | timestamptz | ✅ | Updated timestamp |

---

## Reference Tables

### ref_ticket_statuses
**Purpose:** Ticket status lookup values  
**Rows:** 2

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | uuid | ❌ | Primary key |
| code | varchar | ❌ | Unique status code |
| name | varchar | ❌ | Display name |
| is_active | boolean | ❌ | Active status |
| created_at | timestamptz | ❌ | Created timestamp |
| updated_at | timestamptz | ❌ | Updated timestamp |

---

### ref_ticket_work_types
**Purpose:** Ticket work type lookup values  
**Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | uuid | ❌ | Primary key |
| code | varchar | ❌ | Unique work type code |
| name | varchar | ❌ | Display name |
| is_active | boolean | ❌ | Active status |
| created_at | timestamptz | ✅ | Created timestamp |
| updated_at | timestamptz | ❌ | Updated timestamp |

---

### ref_leave_types
**Purpose:** Leave type lookup values  
**Rows:** 3

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | uuid | ❌ | Primary key |
| code | varchar | ✅ | Unique leave type code |
| name | varchar | ❌ | Display name (unique) |
| days_per_year | integer | ✅ | Default days per year |
| requires_approval | boolean | ✅ | Requires approval flag |
| is_active | boolean | ✅ | Active status |
| created_at | timestamptz | ✅ | Created timestamp |
| updated_at | timestamptz | ❌ | Updated timestamp |

---

### ref_package_items
**Purpose:** Package item catalog  
**Rows:** 23

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | uuid | ❌ | Primary key |
| code | varchar | ❌ | Unique item code |
| name_th | varchar | ❌ | Thai name |
| name_en | varchar | ✅ | English name |
| description | text | ✅ | Description |
| category | varchar | ✅ | Item category |
| unit | varchar | ✅ | Unit of measurement |
| is_active | boolean | ✅ | Active status |
| created_at | timestamptz | ✅ | Created timestamp |
| updated_at | timestamptz | ✅ | Updated timestamp |

---

### ref_package_services
**Purpose:** Package service catalog  
**Rows:** 0

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | uuid | ❌ | Primary key |
| code | varchar | ❌ | Unique service code |
| name_th | varchar | ❌ | Thai name |
| name_en | varchar | ✅ | English name |
| description | text | ✅ | Description |
| category | varchar | ✅ | Service category |
| duration_months | integer | ✅ | Duration in months |
| is_active | boolean | ✅ | Active status |
| created_at | timestamptz | ✅ | Created timestamp |
| updated_at | timestamptz | ✅ | Updated timestamp |

---

### ref_provinces
**Purpose:** Thai provinces (จังหวัด)  
**Rows:** 77

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | integer | ❌ | Primary key (province code) |
| name_th | varchar(100) | ❌ | Thai name (e.g., "กรุงเทพมหานคร") |
| name_en | varchar(100) | ✅ | English name (e.g., "Bangkok") |
| geography_id | integer | ✅ | Geography region ID |

---

### ref_districts
**Purpose:** Thai districts/amphoe (อำเภอ/เขต)  
**Rows:** 929

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | integer | ❌ | Primary key (district code) |
| name_th | varchar(100) | ❌ | Thai name (e.g., "เขตพระนคร") |
| name_en | varchar(100) | ✅ | English name |
| province_id | integer | ✅ | FK → ref_provinces |

**Index:** `idx_districts_province_id` on province_id

---

### ref_sub_districts
**Purpose:** Thai sub-districts/tambon (ตำบล/แขวง)  
**Rows:** 7,453

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | integer | ❌ | Primary key (sub-district code) |
| name_th | varchar(100) | ❌ | Thai name |
| name_en | varchar(100) | ✅ | English name |
| district_id | integer | ✅ | FK → ref_districts |
| zip_code | integer | ✅ | Postal code |

**Indexes:** 
- `idx_sub_districts_district_id` on district_id
- `idx_sub_districts_zip_code` on zip_code

---

## System Tables

### sys_idempotency_keys
**Purpose:** Duplicate request prevention  
**Rows:** 5

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | uuid | ❌ | Primary key |
| idempotency_key | text | ❌ | Client-provided key (unique) |
| operation_type | text | ❌ | Operation type |
| employee_id | uuid | ❌ | FK → main_employees |
| request_payload | jsonb | ❌ | Original request |
| response_data | jsonb | ✅ | Cached response |
| status_code | integer | ✅ | HTTP status code |
| is_completed | boolean | ❌ | Completion flag |
| is_failed | boolean | ❌ | Failure flag |
| error_message | text | ✅ | Error message |
| created_at | timestamptz | ❌ | Created timestamp |
| expires_at | timestamptz | ❌ | Expiration (default: 24h) |

---

## Views

### v_employees
**Purpose:** Simplified employee view with role/department info

```sql
SELECT 
  e.id, e.code, e.name, e.email, e.nickname,
  e.is_active, e.auth_user_id,
  r.id AS role_id, r.code AS role_code,
  r.name_th AS role_name_th, r.level AS role_level,
  d.id AS department_id, d.code AS department_code,
  d.name_th AS department_name_th
FROM main_employees e
LEFT JOIN main_org_roles r ON e.role_id = r.id
LEFT JOIN main_org_departments d ON r.department_id = d.id;
```

---

### v_tickets
**Purpose:** Simplified ticket view with related data

Includes: site, company, appointment, work type, status information.

---

### v_sites
**Purpose:** Simplified site view with company info

---

### v_merchandise
**Purpose:** Simplified merchandise view

---

### v_leave_balances
**Purpose:** Leave balance view

---

### v_leave_requests
**Purpose:** Leave request view

---

## Entity Relationships

```
main_employees ─┬─ role_id ────────────► main_org_roles ─── department_id ──► main_org_departments
                ├─ supervisor_id ──────► main_employees (self)
                ├─ auth_user_id ───────► auth.users
                │
                ├──────────────────────◄ jct_ticket_employees ◄──── main_tickets
                ├──────────────────────◄ jct_site_employee_trainings ◄── main_sites
                ├──────────────────────◄ child_employee_leave_balances
                ├──────────────────────◄ child_employee_leave_requests
                └──────────────────────◄ jct_appointment_approvers

main_companies ─┬───────────────────────◄ main_sites
                ├───────────────────────◄ main_merchandise (distributor)
                └───────────────────────◄ main_merchandise (dealer)

main_sites ─────┬───────────────────────◄ child_site_contacts
                ├───────────────────────◄ main_merchandise
                └───────────────────────◄ main_tickets

main_tickets ───┬─ site_id ────────────► main_sites
                ├─ contact_id ─────────► child_site_contacts
                ├─ appointment_id ─────► main_appointments
                ├─ work_type_id ───────► ref_ticket_work_types
                ├─ status_id ──────────► ref_ticket_statuses
                ├─ assigner_id ────────► main_employees
                ├─ created_by ─────────► main_employees
                │
                ├──────────────────────◄ jct_ticket_employees
                ├──────────────────────◄ jct_ticket_merchandise
                └──────────────────────◄ child_ticket_audit

main_models ────┬──────────────────────◄ main_merchandise
                ├──────────────────────◄ jct_model_package_items
                ├──────────────────────◄ jct_model_package_services
                └──────────────────────◄ ext_model_specifications

main_announcements ─┬──────────────────◄ child_announcement_photos
                    └──────────────────◄ child_announcement_files

ref_leave_types ────┬──────────────────◄ child_employee_leave_balances
                    └──────────────────◄ child_employee_leave_requests

ref_package_items ──────────────────────◄ jct_model_package_items
ref_package_services ───────────────────◄ jct_model_package_services

ref_provinces ─────────────────────────► ref_districts ◄──────────────► ref_sub_districts
                                              ▲                               ▲
                                              │                               │
main_sites ────── province_code ──────────────┘                               │
           ────── district_code ──────────────────────────────────────────────┘
           ────── subdistrict_code ───────────────────────────────────────────┘
```

---

## Row-Level Security (RLS)

All tables have RLS enabled with policies based on:
- Employee authentication (via `auth.uid()`)
- Employee permission level (via `fn_user_has_min_level()`)

---

## Custom Types (Enums)

| Type | Values |
|------|--------|
| `customer_appointment_type` | full_day, time_range, half_morning, half_afternoon, call_to_schedule |
| `half_day_type_enum` | morning, afternoon |
| `safety_standard_type` | safety_shoes, safety_vest, safety_helmet, training |

---

## Database Functions

| Function | Purpose |
|----------|---------|
| `fn_user_has_min_level(level)` | Check if current user has minimum level |
| `fn_current_user_is_role_level_gt0()` | Check if user has role level > 0 |
| `fn_delete_tickets_cascade(ids)` | Cascade delete tickets |
| `fn_merge_ticket_duplicates(...)` | Merge duplicate tickets |
| `fn_trg_validate_ticket_merchandise_site(...)` | Validate merchandise belongs to ticket site |
| `search_tickets(...)` | Comprehensive server-side ticket search - avoids URL length issues |

### search_tickets

**Purpose:** Comprehensive ticket search with server-side filtering to avoid URL length issues when filtering by large datasets (e.g., date ranges with many appointments).

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `p_page` | INTEGER | 1 | Page number |
| `p_limit` | INTEGER | 20 | Items per page |
| `p_sort` | TEXT | 'created_at' | Sort field (created_at, updated_at, appointment_date) |
| `p_order` | TEXT | 'desc' | Sort order (asc, desc) |
| `p_start_date` | DATE | NULL | Date range start |
| `p_end_date` | DATE | NULL | Date range end |
| `p_date_type` | TEXT | 'appointed' | Date field to filter (appointed, created, updated) |
| `p_site_id` | UUID | NULL | Filter by site |
| `p_status_id` | UUID | NULL | Filter by status |
| `p_work_type_id` | UUID | NULL | Filter by work type |
| `p_assigner_id` | UUID | NULL | Filter by assigner |
| `p_contact_id` | UUID | NULL | Filter by contact |
| `p_details` | TEXT | NULL | Text search in details |
| `p_exclude_backlog` | BOOLEAN | FALSE | Exclude tickets without appointments |
| `p_only_backlog` | BOOLEAN | FALSE | Only tickets without appointments |
| `p_employee_id` | UUID | NULL | Filter by assigned employee |
| `p_department_id` | UUID | NULL | Filter by department (via employee role) |

**Returns:** Table with `ticket_id` (UUID) and `total_count` (BIGINT)

**Note:** Department filtering uses the join path: `employee.role_id → main_org_roles.department_id`

---

*Generated: January 2, 2026*

