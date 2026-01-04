# PDE Service API Reference

**Base URL:** `https://ogzyihacqbasolfxymgo.supabase.co/functions/v1`

**Authentication:** All endpoints require JWT Bearer token in Authorization header.

```
Authorization: Bearer <jwt_token>
```

---

## Table of Contents

1. [Initialize](#1-initialize-api)
2. [Employees](#2-employees-api)
3. [Tickets](#3-tickets-api)
4. [Appointments](#4-appointments-api)
5. [Sites](#5-sites-api)
6. [Companies](#6-companies-api)
7. [Contacts](#7-contacts-api)
8. [Merchandise](#8-merchandise-api)
9. [Models](#9-models-api)
10. [Departments](#10-departments-api)
11. [Roles](#11-roles-api)
12. [Leave Requests](#12-leave-requests-api)
13. [Features](#13-features-api)
14. [Reference Data](#14-reference-data-api)
15. [Announcements](#15-announcements-api)
16. [Package Items](#16-package-items-api)
17. [Package Services](#17-package-services-api)
18. [Employee Site Trainings](#18-employee-site-trainings-api)

---

## Architecture

All API functions share centralized utilities from `supabase/functions/_shared/`:

| File | Purpose |
|------|---------|
| `auth.ts` | Authentication & authorization |
| `cors.ts` | CORS handling |
| `error.ts` | Error classes & handling |
| `response.ts` | Response utilities |
| `validation.ts` | Input validation |
| `sanitize.ts` | Data sanitization |
| `supabase.ts` | Supabase client |
| `idempotency.ts` | Idempotency key handling |

---

## 1. Initialize API

Base path: `/api-initialize`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/me` | Get current authenticated user info with role & department |
| GET | `/features` | Get enabled features for current user |

---

## 2. Employees API

Base path: `/api-employees`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/network-search` | Search employees with pagination & filters |
| GET | `/employee-summary` | Get lightweight employee list (active only) |
| GET | `/technicians/availability` | Get technicians with workload availability |
| GET | `/:id` | Get single employee by ID |
| POST | `/` | Create new employee |
| POST | `/:id/link-auth` | Create and link new auth account |
| POST | `/:id/link-existing-auth` | Link existing auth account |
| POST | `/:id/unlink-auth` | Unlink auth account |
| PUT | `/:id` | Update employee |
| DELETE | `/:id` | Delete employee |

### Query Parameters (network-search)

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | number | 1 | Page number |
| `limit` | number | 20 | Items per page |
| `search` | string | - | Search query (name, email, nickname) |
| `department_id` | string | - | Filter by department(s), comma-separated |
| `role_id` | string | - | Filter by role |
| `is_active` | boolean | - | Filter by active status |

---

## 3. Tickets API

Base path: `/api-tickets`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/search` | Search tickets with filters (enhanced response) |
| GET | `/search-duration` | Search tickets by date range & type (enhanced response) |
| GET | `/:id` | Get single ticket with full details |
| POST | `/` | Create new ticket |
| PUT | `/:id` | Update ticket |
| DELETE | `/:id` | Delete ticket |
| DELETE | `/employees` | Remove employee assignment from ticket |

### GET `/search` - Search Tickets

Returns display-ready ticket data with pre-resolved names for immediate frontend rendering.

#### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | number | 1 | Page number |
| `limit` | number | 20 | Items per page (max 100) |
| `sort` | string | `created_at` | Sort field: `created_at`, `updated_at`, `appointment_date` |
| `order` | string | `desc` | Sort order: `asc`, `desc` |
| `start_date` | string | - | Appointment date range start (YYYY-MM-DD) |
| `end_date` | string | - | Appointment date range end (YYYY-MM-DD) |
| `site_id` | UUID | - | Filter by site |
| `status_id` | UUID | - | Filter by status |
| `work_type_id` | UUID | - | Filter by work type |
| `employee_id` | UUID | - | Filter by assigned employee |
| `assigner_id` | UUID | - | Filter by assigner |
| `department_id` | UUID | - | Filter by department |
| `contact_id` | UUID | - | Filter by contact |
| `exclude_backlog` | boolean | false | Exclude tickets without appointments |
| `only_backlog` | boolean | false | Only tickets without appointments (backlog) |
| `details` | string | - | Search in ticket details text |
| `include` | string | `full` | Response mode: `full` or `minimal` |

> **Note:** All filtering is performed server-side using database functions for optimal performance with large datasets.

#### Example Request

```http
GET /api-tickets/search?start_date=2025-12-01&end_date=2025-12-31&exclude_backlog=true&page=1&limit=20
Authorization: Bearer <token>
```

### GET `/search-duration` - Search by Date Type

Search tickets filtered by specific date type (created, updated, or appointment date).

#### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `start_date` | string | **required** | Start date (YYYY-MM-DD) |
| `end_date` | string | **required** | End date (YYYY-MM-DD) |
| `date_type` | string | `create` | Date to filter: `create`, `update`, `appointed` |
| `page` | number | 1 | Page number |
| `limit` | number | 20 | Items per page |
| `sort` | string | `created_at` | Sort field |
| `order` | string | `desc` | Sort order |
| `include` | string | `full` | Response mode |

#### Example Request

```http
GET /api-tickets/search-duration?start_date=2025-12-01&end_date=2025-12-31&date_type=appointed
Authorization: Bearer <token>
```

### Enhanced Response Format

Both search endpoints return **display-ready data** with pre-resolved names:

```typescript
interface TicketDisplayItem {
  // Core Identity
  id: string;
  
  // Display Strings (pre-resolved)
  site_name: string | null;
  company_name: string | null;
  work_type_name: string | null;
  work_type_code: string | null;
  status_name: string | null;
  status_code: string | null;
  assigner_name: string | null;
  creator_name: string | null;
  
  // Location (pre-resolved from codes)
  location: {
    province_code: number | null;
    province_name: string | null;      // "กรุงเทพมหานคร"
    district_code: number | null;
    district_name: string | null;       // "เขตพระนคร"
    subdistrict_code: number | null;
    subdistrict_name: string | null;
    address_detail: string | null;
    display: string;                    // "พระนคร, กทม." (pre-formatted)
  };
  
  // Appointment (pre-formatted)
  appointment: {
    id: string | null;
    date: string | null;                // "2026-01-15"
    time_start: string | null;          // "09:00"
    time_end: string | null;            // "12:00"
    type: AppointmentType;
    type_display: string;               // "09:00 - 12:00" or "เต็มวัน"
    is_approved: boolean | null;
  };
  
  // Employees (full data)
  employees: {
    id: string;
    name: string;
    code: string | null;
    is_key: boolean;
    profile_image_url: string | null;
  }[];
  employee_count: number;
  
  // Content
  details: string | null;
  additional: string | null;
  
  // Merchandise Summary
  merchandise: {
    id: string;
    serial_no: string;
    model_name: string | null;
  }[];
  merchandise_count: number;
  
  // Metadata
  created_at: string;
  updated_at: string;
  
  // IDs for updates (only when include=full)
  _ids?: {
    site_id: string | null;
    status_id: string;
    work_type_id: string;
    assigner_id: string;
    contact_id: string | null;
  };
}
```

### Appointment Types

| Type | Display (Thai) |
|------|----------------|
| `full_day` | เต็มวัน |
| `time_range` | 09:00 - 12:00 |
| `half_morning` | ช่วงเช้า |
| `half_afternoon` | ช่วงบ่าย |
| `call_to_schedule` | โทรนัดหมาย |
| `backlog` | Backlog |
| `scheduled` | มีนัดหมาย |

### Example Response

```json
{
  "data": {
    "data": [
      {
        "id": "123e4567-e89b-12d3-a456-426614174000",
        "site_name": "ABC Corp สำนักงานใหญ่",
        "company_name": "ABC Corporation",
        "work_type_name": "PM",
        "work_type_code": "PM",
        "status_name": "กำลังดำเนินการ",
        "status_code": "in_progress",
        "assigner_name": "สมชาย ใจดี",
        "creator_name": "วิชัย สร้างตั๋ว",
        "location": {
          "province_code": 10,
          "province_name": "กรุงเทพมหานคร",
          "district_code": 1001,
          "district_name": "เขตพระนคร",
          "subdistrict_code": null,
          "subdistrict_name": null,
          "address_detail": "123 ถนนราชดำเนิน",
          "display": "พระนคร, กทม."
        },
        "appointment": {
          "id": "appt-456",
          "date": "2025-12-15",
          "time_start": "09:00",
          "time_end": "12:00",
          "type": "time_range",
          "type_display": "09:00 - 12:00",
          "is_approved": true
        },
        "employees": [
          {
            "id": "emp-123",
            "name": "วิชัย ช่างเก่ง",
            "code": "EMP001",
            "is_key": true,
            "profile_image_url": null
          }
        ],
        "employee_count": 1,
        "details": "ซ่อมบำรุงประจำเดือน",
        "additional": null,
        "merchandise": [
          {
            "id": "merch-789",
            "serial_no": "SN123456",
            "model_name": "Model X"
          }
        ],
        "merchandise_count": 1,
        "created_at": "2025-12-01T10:00:00Z",
        "updated_at": "2025-12-01T10:00:00Z",
        "_ids": {
          "site_id": "site-abc",
          "status_id": "st-progress",
          "work_type_id": "wt-pm",
          "assigner_id": "emp-assign",
          "contact_id": null
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "totalPages": 8,
      "hasNext": true,
      "hasPrevious": false
    }
  }
}
```

---

## 4. Appointments API

Base path: `/api-appointments`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | List appointments with pagination |
| GET | `/search` | Search appointments |
| GET | `/ticket/:ticketId` | Get appointment by ticket ID |
| GET | `/:id` | Get single appointment |
| POST | `/` | Create appointment |
| POST | `/approve` | Approve appointment |
| PUT | `/:id` | Update appointment |
| DELETE | `/:id` | Delete appointment |

---

## 5. Sites API

Base path: `/api-sites`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/global-search` | Search sites with pagination |
| GET | `/hint` | Get site hints (autocomplete, max 5) |
| GET | `/:id` | Get single site with related data |
| POST | `/` | Create new site |
| POST | `/create-or-replace` | Create or replace site |
| PUT | `/:id` | Update site |
| DELETE | `/:id` | Delete site |

### Query Parameters (global-search)

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | number | 1 | Page number |
| `limit` | number | 20 | Items per page |
| `search` | string | - | Search query (name, address) |
| `company_id` | UUID | - | Filter by company |

---

## 6. Companies API

Base path: `/api-companies`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/global-search` | Search companies with pagination |
| GET | `/hint` | Get company hints (autocomplete, max 5) |
| GET | `/:id` | Get single company |
| POST | `/` | Create new company |
| POST | `/create-or-update` | Create or update company |
| PUT | `/:id` | Update company |
| DELETE | `/:id` | Delete company |

---

## 7. Contacts API

Base path: `/api-contacts`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | List contacts with pagination |
| GET | `/list` | List contacts (explicit) |
| GET | `/search` | Search contacts |
| GET | `/site/:siteId` | Get contacts by site |
| GET | `/:id` | Get single contact |
| POST | `/` | Create contact |
| PUT | `/:id` | Update contact |
| DELETE | `/:id` | Delete contact |

---

## 8. Merchandise API

Base path: `/api-merchandise`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/search` | Search merchandise |
| GET | `/hint` | Get merchandise hints (autocomplete) |
| GET | `/check-duplicate` | Check for duplicate serial number |
| GET | `/:id` | Get single merchandise |
| POST | `/` | Create merchandise |
| PUT | `/:id` | Update merchandise |
| DELETE | `/:id` | Delete merchandise |

### Query Parameters (search)

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | number | 1 | Page number |
| `limit` | number | 20 | Items per page |
| `search` | string | - | Search query |
| `site_id` | UUID | - | Filter by site |
| `model_id` | UUID | - | Filter by model |

---

## 9. Models API

Base path: `/api-models`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/search` | Search models by code/description |
| GET | `/:id` | Get single model |
| GET | `/:modelId/package` | Get model package (items + services) |
| GET | `/:modelId/specification` | Get model specification |
| POST | `/` | Create model |
| POST | `/:modelId/package/items` | Add item to model package |
| POST | `/:modelId/package/services` | Add service to model package |
| POST | `/:modelId/specification` | Create/update model specification |
| PUT | `/:id` | Update model |
| PUT | `/:modelId/specification` | Update model specification |
| DELETE | `/:modelId/package/items/:itemId` | Remove item from package |
| DELETE | `/:modelId/package/services/:serviceId` | Remove service from package |

---

## 10. Departments API

Base path: `/api-departments`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/search` | Search departments |
| GET | `/department-summary` | Get departments with employee counts |
| GET | `/:id` | Get single department |
| POST | `/` | Create department |
| PUT | `/:id` | Update department |
| DELETE | `/:id` | Delete department |

---

## 11. Roles API

Base path: `/api-roles`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/search` | Search roles |
| GET | `/role-summary` | Get roles with employee counts |
| GET | `/:id` | Get single role |
| POST | `/` | Create role |
| PUT | `/:id` | Update role |
| DELETE | `/:id` | Delete role |

---

## 12. Leave Requests API

Base path: `/api-leave-requests`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | List leave requests |
| GET | `/search` | Search leave requests |
| GET | `/:id` | Get single leave request |
| POST | `/` | Create leave request |
| POST | `/:id/approve` | Approve leave request |
| POST | `/:id/reject` | Reject leave request |
| POST | `/:id/cancel` | Cancel leave request |
| PUT | `/:id` | Update leave request |
| DELETE | `/:id` | Delete leave request |

---

## 13. Features API

Base path: `/api-features`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Get enabled features for employee level |
| GET | `/menu` | Get menu items grouped by group_label |

---

## 14. Reference Data API

Base path: `/api-reference-data`

All endpoints are **read-only (GET only)**.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/constants` | Get all constants (combined) |
| GET | `/work-types` | Get work types |
| GET | `/statuses` | Get ticket statuses |
| GET | `/leave-types` | Get leave types |
| GET | `/provinces` | Get provinces |

### Location Reference Tables

The database includes Thai location reference data for address resolution:

| Table | Records | Description |
|-------|---------|-------------|
| `ref_provinces` | 77 | Thai provinces (จังหวัด) |
| `ref_districts` | 929 | Districts/Amphoe (อำเภอ/เขต) |
| `ref_sub_districts` | 7,453 | Sub-districts/Tambon (ตำบล/แขวง) |

**Schema:**

```sql
-- ref_provinces
id INTEGER PRIMARY KEY,
name_th VARCHAR(100),    -- "กรุงเทพมหานคร"
name_en VARCHAR(100),    -- "Bangkok"
geography_id INTEGER

-- ref_districts  
id INTEGER PRIMARY KEY,
name_th VARCHAR(100),    -- "เขตพระนคร"
name_en VARCHAR(100),    -- "Khet Phra Nakhon"
province_id INTEGER      -- FK to ref_provinces

-- ref_sub_districts
id INTEGER PRIMARY KEY,
name_th VARCHAR(100),    -- "พระบรมมหาราชวัง"
name_en VARCHAR(100),
district_id INTEGER,     -- FK to ref_districts
zip_code INTEGER
```

> **Note:** Location names are automatically resolved in the Tickets API search response via the `location` object. Frontend does not need to query these tables directly.

---

## 15. Announcements API

Base path: `/api-announcements`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | List all announcements |

> **Note:** Create/Update/Delete managed via Supabase Dashboard.

---

## 16. Package Items API

Base path: `/api-package-items`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | List all package items |
| GET | `/:id` | Get single package item |
| POST | `/` | Create package item |
| PUT | `/:id` | Update package item |
| DELETE | `/:id` | Delete package item |

---

## 17. Package Services API

Base path: `/api-package-services`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | List all package services |
| GET | `/:id` | Get single package service |
| POST | `/` | Create package service |
| PUT | `/:id` | Update package service |
| DELETE | `/:id` | Delete package service |

---

## 18. Employee Site Trainings API

Base path: `/api-employee-site-trainings`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | List trainings |
| GET | `/:id` | Get single training |
| POST | `/` | Create training |
| PUT | `/:id` | Update training |

---

## Response Format

### Success Response

```json
{
  "data": { ... }
}
```

### Success with Pagination

```json
{
  "data": {
    "data": [...],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 100,
      "totalPages": 5,
      "hasNext": true,
      "hasPrevious": false
    }
  }
}
```

### Error Response

```json
{
  "error": "Error message in Thai"
}
```

---

## HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | OK - Request successful |
| 201 | Created - Resource created |
| 400 | Bad Request - Validation error |
| 401 | Unauthorized - Invalid/missing token |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource not found |
| 405 | Method Not Allowed |
| 409 | Conflict - Duplicate/constraint violation |
| 500 | Internal Server Error |

---

## Authorization Levels

Operations require minimum employee level:

| Level | Permissions |
|-------|-------------|
| 0 | Read operations (GET) |
| 1 | Create operations (POST) |
| 2 | Update/Delete operations (PUT/DELETE) |
| 3+ | Administrative operations |
| 5+ | System management |

---

## Database Tables

### Naming Conventions

| Prefix | Type | Example |
|--------|------|---------|
| `main_` | Primary entities | `main_tickets`, `main_employees` |
| `jct_` | Junction/relationship tables | `jct_ticket_employees` |
| `child_` | Child/dependent tables | `child_site_contacts` |
| `ext_` | Extension tables | `ext_model_specifications` |
| `ref_` | Reference/lookup tables | `ref_ticket_statuses`, `ref_provinces` |
| `v_` | Views | `v_employees`, `v_tickets` |

### Key Reference Tables

| Table | Description |
|-------|-------------|
| `ref_ticket_statuses` | Ticket status codes |
| `ref_ticket_work_types` | Work type codes (PM, CM, etc.) |
| `ref_leave_types` | Leave request types |
| `ref_provinces` | 77 Thai provinces |
| `ref_districts` | 929 Thai districts |
| `ref_sub_districts` | 7,453 Thai sub-districts |

### Database Functions

| Function | Description |
|----------|-------------|
| `search_tickets(...)` | Server-side ticket search with all filtering - avoids URL length issues with large datasets |

**`search_tickets` Parameters:**
- `p_page`, `p_limit` - Pagination
- `p_sort`, `p_order` - Sorting (created_at, updated_at, appointment_date)
- `p_start_date`, `p_end_date`, `p_date_type` - Date filtering (appointed/created/updated)
- `p_site_id`, `p_status_id`, `p_work_type_id`, `p_assigner_id`, `p_contact_id` - Entity filters
- `p_details` - Text search
- `p_exclude_backlog`, `p_only_backlog` - Backlog flags
- `p_employee_id`, `p_department_id` - Employee/department filters

---

*Last Updated: January 2, 2026*
