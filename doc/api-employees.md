# API Employees

Employees API for managing workforce data, authentication linking, and gamification features.

## Overview

| Attribute | Value |
|-----------|-------|
| Base URL | `/api-employees` |
| Auth | JWT required |
| Content-Type | `application/json` |

## Database Schema

**Table:** `main_employees`

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | uuid | NO | Primary key |
| name | varchar | NO | Full name |
| code | varchar | NO | Employee code (unique) |
| is_active | boolean | YES | Active status (default: true) |
| auth_user_id | uuid | YES | Linked Supabase auth user |
| nickname | varchar | YES | Nickname |
| email | varchar | YES | Email address |
| role_id | uuid | YES | FK to main_org_roles |
| profile_image_url | text | YES | Profile image URL |
| cover_image_url | text | YES | Cover image URL |
| supervisor_id | uuid | YES | FK to self (supervisor) |
| created_at | timestamptz | YES | Created timestamp |
| updated_at | timestamptz | YES | Updated timestamp |

**View:** `v_employees` - Flattened view with role and department data

---

## Endpoints

### Search Employees (Master)

```
GET /api-employees
```

**Auth:** Level 1+ (Assigner, PM, Sales, Admin, Superadmin)

**Query Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| page | number | 1 | Page number |
| limit | number | 50 | Items per page |
| q | string | - | Text search (name, code, email, nickname) |
| role | string | - | Filter by role code |
| role_id | uuid | - | Filter by role UUID |
| department_id | uuid | - | Filter by department UUID |
| code | string | - | Filter by exact employee code |
| is_active | boolean | - | Filter by active status ("true"/"false") |

**Response:** `200 OK`
```json
{
  "data": {
    "data": [
      {
        "id": "uuid",
        "code": "EMP001",
        "name": "John Doe",
        "email": "john@example.com",
        "nickname": "Johnny",
        "is_active": true,
        "role_id": "uuid",
        "role_code": "technician_l1",
        "role_name": "ช่างเทคนิค",
        "department_id": "uuid",
        "department_code": "technical",
        "department_name": "ฝ่ายช่าง",
        "created_at": "2026-01-18T10:00:00Z",
        "updated_at": "2026-01-18T10:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 100,
      "totalPages": 2,
      "hasNext": true,
      "hasPrevious": false
    }
  }
}
```

**Errors:**
- `400` - Invalid UUID format
- `401` - Not authenticated
- `403` - Insufficient permissions (requires Level 1+)

---

### Network Search Employees

```
GET /api-employees/network-search
```

**Auth:** Level 0+ (all authenticated)

Simplified search for user management UI. Searches name/email only.

**Query Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| page | number | 1 | Page number |
| limit | number | 50 | Items per page |
| q | string | - | Text search (name, email only) |
| department_id | string | - | Filter by department UUID(s) - supports % or , separator |
| role | string | - | Filter by role code |
| role_id | uuid | - | Filter by role UUID |
| is_active | boolean | - | Filter by active status ("true"/"false") |

**Department ID Formats:**
- Single: `?department_id=uuid1`
- Percent-separated (preferred): `?department_id=uuid1%uuid2`
- Comma-separated (legacy): `?department_id=uuid1,uuid2`

**Response:** `200 OK`

Same as master search, but includes `auth_user_id` in response.

```json
{
  "data": {
    "data": [
      {
        "id": "uuid",
        "code": "EMP001",
        "name": "John Doe",
        "email": "john@example.com",
        "nickname": "Johnny",
        "is_active": true,
        "role_id": "uuid",
        "role_code": "technician_l1",
        "role_name": "ช่างเทคนิค",
        "department_id": "uuid",
        "department_code": "technical",
        "department_name": "ฝ่ายช่าง",
        "created_at": "2026-01-18T10:00:00Z",
        "updated_at": "2026-01-18T10:00:00Z",
        "auth_user_id": "uuid"
      }
    ],
    "pagination": { ... }
  }
}
```

---

### Get Employee by ID

```
GET /api-employees/:id
```

**Auth:** Level 0+

**Response:** `200 OK`
```json
{
  "data": {
    "id": "uuid",
    "name": "John Doe",
    "code": "EMP001",
    "nickname": "Johnny",
    "email": "john@example.com",
    "is_active": true,
    "auth_user_id": "uuid",
    "profile_image_url": "https://...",
    "cover_image_url": "https://...",
    "supervisor_id": "uuid",
    "created_at": "2026-01-18T10:00:00Z",
    "updated_at": "2026-01-18T10:00:00Z",
    "role_data": {
      "id": "uuid",
      "code": "technician_l1",
      "name_th": "ช่างเทคนิค",
      "name_en": "Technician L1",
      "level": 0,
      "department": {
        "id": "uuid",
        "code": "technical",
        "name_th": "ฝ่ายช่าง",
        "name_en": "Technical"
      }
    }
  }
}
```

**Errors:**
- `400` - Invalid UUID
- `404` - ไม่พบข้อมูลพนักงาน

---

### Get Employee Summary

```
GET /api-employees/employee-summary
```

**Auth:** Level 0+

Returns lightweight list of all active employees for dropdowns.

**Response:** `200 OK`
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "John Doe",
      "email": "john@example.com",
      "role_name": "ช่างเทคนิค",
      "is_link_auth": true,
      "profile_image_url": "https://..."
    }
  ]
}
```

**Notes:**
- Returns only active employees (`is_active=true`)
- NOT paginated - returns all active employees
- Use search endpoints for filtered/paginated results

---

### Get Technician Availability

```
GET /api-employees/technicians/availability
```

**Auth:** Level 1+

Returns technicians with workload status for a date.

**Query Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| date | string | No | Date in YYYY-MM-DD format |

**Response:** `200 OK`
```json
{
  "data": [
    { "id": "uuid", "name": "ช่างสมชาย", "workload": "light" },
    { "id": "uuid", "name": "ช่างสมหญิง", "workload": "heavy" }
  ]
}
```

**Workload Levels:**
- `no_work` - 0 appointments
- `light` - 1-2 appointments
- `medium` - 3-4 appointments
- `heavy` - 5+ appointments

**Notes:**
- If no date is provided, returns all technicians with `no_work` status
- Only returns employees from the "technical" department

**Errors:**
- `400` - Invalid date format (must be YYYY-MM-DD)
- `500` - Technical department not found

---

### Create Employee

```
POST /api-employees
```

**Auth:** Level 2+ (Admin, Superadmin)

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | Yes | Full name |
| code | string | Yes | Employee code (unique) |
| nickname | string | No | Nickname |
| email | string | No | Email address |
| role_id | uuid | No | Role UUID (preferred) |
| role | string | No | Role code (legacy, converted to role_id) |
| profile_image_url | string | No | Profile image URL |
| cover_image_url | string | No | Cover image URL |
| supervisor_id | uuid | No | Supervisor employee ID |
| is_active | boolean | No | Active status (default: true) |

**Response:** `201 Created`
```json
{
  "data": {
    "id": "uuid",
    "name": "John Doe",
    "code": "EMP001",
    "role_data": { ... }
  }
}
```

**Notes:**
- Creates initial leave balances (sick: 30, vacation: 6, personal: 3)
- If `role` (code) is provided, converts to `role_id`
- If both `role` and `role_id` are provided, `role_id` takes precedence

**Errors:**
- `400` - Missing name or code
- `500` - Role code not found or creation fails

---

### Update Employee

```
PUT /api-employees/:id
```

**Auth:** Variable (see notes)

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | No | Full name |
| code | string | No | Employee code |
| nickname | string | No | Nickname |
| email | string | No | Email address |
| role_id | uuid | No | Role UUID |
| role | string | No | Role code (legacy) |
| profile_image_url | string | No | Profile image URL |
| cover_image_url | string | No | Cover image URL |
| supervisor_id | uuid | No | Supervisor employee ID |
| is_active | boolean | No | Active status |

**Response:** `200 OK`

**Permission Notes:**
- **Self-update (own profile):** Can update `name`, `nickname`, `email`, `profile_image_url` without admin permissions
- **Admin (Level 2+):** Can update all fields including role, is_active, code, etc.
- If a non-admin tries to update restricted fields, a 403 error is returned

**Errors:**
- `400` - Invalid UUID
- `403` - Trying to update restricted fields without admin permissions
- `404` - ไม่พบข้อมูลพนักงาน

---

### Delete Employee

```
DELETE /api-employees/:id
```

**Auth:** Level 2+

**Response:** `200 OK`
```json
{
  "data": {
    "message": "ลบพนักงานสำเร็จ"
  }
}
```

**Notes:**
- Soft delete (sets `is_active=false`)
- Does NOT delete the auth account
- Does NOT remove any historical data or relationships

---

## Auth Account Management

### Link Auth (Create New)

```
POST /api-employees/:id/link-auth
```

**Auth:** Level 2+

Creates new Supabase auth user and links to employee.

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| email | string | Yes | Email for auth account |
| password | string | Yes | Password for auth account |

**Response:** `200 OK` - Updated employee with role_data

**Notes:**
- Creates auth user with `email_confirm=true` (pre-verified)
- Updates employee's `auth_user_id` and `email`

**Errors:**
- `400` - Missing email/password or invalid email format
- `500` - Auth user creation fails (e.g., email already exists)

---

### Link Existing Auth

```
POST /api-employees/:id/link-existing-auth
```

**Auth:** Level 2+

Links existing Supabase auth user to employee.

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| auth_user_id | uuid | Yes | Existing auth user UUID |
| email | string | Yes | Email to set on employee |

**Response:** `200 OK` - Updated employee with role_data

**Errors:**
- `400` - Missing auth_user_id/email or invalid email format
- `500` - Auth user not found or already linked to another employee

**Error Messages:**
- `ไม่พบบัญชี Auth ที่ระบุ` - Auth user doesn't exist
- `บัญชีนี้ถูกเชื่อมต่อกับพนักงาน {name} ({code}) อยู่แล้ว` - Already linked to another employee

---

### Unlink Auth

```
POST /api-employees/:id/unlink-auth
```

**Auth:** Level 2+

Removes auth account link from employee.

**Response:** `200 OK` - Updated employee with role_data

**Notes:**
- Sets `auth_user_id` to null
- Does NOT delete the auth account
- Employee can no longer log in
- The auth account can be linked to a different employee

---

## Achievement System

### Get Achievement Progress

```
GET /api-employees/achievements/progress
```

**Auth:** Level 0+ (current user only)

Returns the current employee's progress toward all active achievement goals.

**Response:** `200 OK`
```json
{
  "data": [
    {
      "goal": {
        "id": "uuid",
        "name": "Daily Creator",
        "description": "Create 5 tickets in a day",
        "period_type": "daily",
        "target_count": 5,
        "reward_type": "coffee",
        "reward_description": "Free coffee"
      },
      "current_count": 3,
      "target_count": 5,
      "period_start": "2026-01-18",
      "period_end": "2026-01-18",
      "status": "in_progress",
      "percentage": 60
    }
  ]
}
```

**Period Types:**
- `daily` - Resets every day
- `weekly` - Monday to Sunday
- `monthly` - First to last day of month

---

### Track Achievement Action

```
POST /api-employees/achievements/track
```

**Auth:** Level 0+ (current user only)

Called when an employee performs a trackable action.

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| action_type | string | Yes | Action type (currently only: `ticket_create`) |

**Response:** `200 OK`
```json
{
  "data": {
    "goals_updated": 2,
    "coupons_earned": 1,
    "progress": [
      {
        "goal": { ... },
        "current_count": 5,
        "target_count": 5,
        "status": "completed",
        "percentage": 100
      }
    ]
  }
}
```

**Supported Action Types:**
- `ticket_create` - Tracked when creating tickets

**Notes:**
- Counts actual tickets created in the current period
- Issues coupon automatically when goal is completed

**Errors:**
- `400` - Missing or invalid action_type
  - `กรุณาระบุ action_type`
  - `action_type ไม่ถูกต้อง (รองรับเฉพาะ ticket_create)`

---

### Get Coupons

```
GET /api-employees/achievements/coupons
```

**Auth:** Level 0+ (current user only)

**Query Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| status | string | No | Filter: `available`, `redeemed`, or `expired` |

**Response:** `200 OK`
```json
{
  "data": [
    {
      "id": "uuid",
      "coupon_type": "coffee",
      "coupon_description": "Free coffee at cafeteria",
      "status": "available",
      "issued_at": "2026-01-15T10:00:00Z",
      "expires_at": "2026-02-14T10:00:00Z"
    }
  ]
}
```

**Coupon Statuses:**
- `available` - Can be redeemed
- `redeemed` - Already used
- `expired` - Past expiration date (30 days from issuance)

**Notes:**
- Expired coupons are automatically updated when fetched

---

## Authorization Levels

| Level | Role | Permissions |
|-------|------|-------------|
| 0 | Technician L1 | Read own/summary, achievements, network-search |
| 1 | Assigner, PM, Sales | Master search, technician availability |
| 2+ | Admin, Superadmin | Create, Update, Delete, Auth management |

## Error Responses

All errors return:
```json
{
  "error": "ข้อความภาษาไทย"
}
```

| Status | Description |
|--------|-------------|
| 400 | Validation error (invalid UUID, missing required fields) |
| 401 | Not authenticated |
| 403 | Insufficient permissions |
| 404 | Resource not found |
| 500 | Server error (database errors, auth failures) |
