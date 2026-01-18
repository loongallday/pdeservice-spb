# API Reference Data

## Overview

The Reference Data API provides read-only access to lookup tables and reference data used throughout the Field Service Management system. All reference data is static or rarely changes, making it suitable for client-side caching.

This API is used for:
- Populating dropdown/select fields in the frontend
- Validating data submissions
- Displaying human-readable names for codes

**Note:** For bootstrapping all constants in a single request, use `GET /api-initialize/me` instead. This is recommended for initial app loading to minimize API calls.

---

## Base URL

```
/api-reference-data
```

---

## Authentication

All endpoints require a valid JWT token in the Authorization header.

```
Authorization: Bearer <jwt_token>
```

**Required Permission Level:** 0 (Technician L1 or higher)

All authenticated users can access reference data. This is read-only data with no level-based restrictions.

---

## Endpoints Summary

| Method | Path | Description | Auth Required |
|--------|------|-------------|---------------|
| GET | `/work-types` | List all work types | Yes |
| GET | `/statuses` | List all ticket statuses | Yes |
| GET | `/leave-types` | List all active leave types | Yes |
| GET | `/provinces` | List Thai provinces | Yes |
| GET | `/work-givers` | List all active work givers | Yes |

---

## Endpoints

### 1. Get Work Types

Retrieve all work types used for categorizing tickets/service requests.

**Request**

```
GET /api-reference-data/work-types
```

**Response**

```json
{
  "data": [
    {
      "id": "a0f4a887-dfe7-496b-851b-e09165ce343f",
      "code": "account",
      "name": "Account",
      "is_active": true,
      "created_at": "2025-11-17T02:27:44.271967+00:00",
      "updated_at": "2026-01-02T07:02:19.950952+00:00"
    },
    {
      "id": "ae14043e-3ca0-4afc-b5d4-341f6f3e06ca",
      "code": "ags_battery",
      "name": "AGS",
      "is_active": true,
      "created_at": "2025-11-17T02:27:44.271967+00:00",
      "updated_at": "2026-01-02T07:02:19.950952+00:00"
    }
  ]
}
```

**Work Type Object Fields**

| Field | Type | Description |
|-------|------|-------------|
| `id` | uuid | Unique work type identifier |
| `code` | string | Machine-readable code (e.g., `pm`, `rma`, `sales`) |
| `name` | string | Display name |
| `is_active` | boolean | Whether this work type is active |
| `created_at` | timestamp | Creation timestamp |
| `updated_at` | timestamp | Last update timestamp |

**Common Work Types**

| Code | Name | Thai | Description |
|------|------|------|-------------|
| `account` | Account | บัญชี/วางบิล | Billing/account related |
| `pm` | PM | บำรุงรักษา | Preventive maintenance |
| `rma` | RMA | เคลม/ซ่อม | Return merchandise authorization |
| `sales` | Sales | ขาย/ติดตั้ง | Sales and installation |
| `start_up` | Start UP | เริ่มระบบ | System startup |
| `survey` | Survey | สำรวจ | Site survey |
| `pickup` | Package | รับ-ส่งเครื่อง | Equipment pickup/delivery |
| `ags_battery` | AGS | แบตเตอรี่ AGS | AGS battery service |

**Example Request**

```bash
curl -X GET "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-reference-data/work-types" \
  -H "Authorization: Bearer <token>"
```

---

### 2. Get Ticket Statuses

Retrieve all ticket statuses used in the ticket lifecycle.

**Request**

```
GET /api-reference-data/statuses
```

**Response**

```json
{
  "data": [
    {
      "id": "36491478-9c1f-4635-90e2-a293968314df",
      "code": "normal",
      "name": "ปกติ",
      "is_active": true,
      "created_at": "2026-01-02T07:02:19.950952+00:00",
      "updated_at": "2026-01-02T07:02:19.950952+00:00"
    },
    {
      "id": "6798860c-4555-456a-a995-d89522b8982b",
      "code": "urgent",
      "name": "เร่งด่วน",
      "is_active": true,
      "created_at": "2026-01-02T07:02:19.950952+00:00",
      "updated_at": "2026-01-02T07:02:19.950952+00:00"
    }
  ]
}
```

**Status Object Fields**

| Field | Type | Description |
|-------|------|-------------|
| `id` | uuid | Unique status identifier |
| `code` | string | Machine-readable code |
| `name` | string | Display name (Thai) |
| `is_active` | boolean | Whether this status is active |
| `created_at` | timestamp | Creation timestamp |
| `updated_at` | timestamp | Last update timestamp |

**Example Request**

```bash
curl -X GET "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-reference-data/statuses" \
  -H "Authorization: Bearer <token>"
```

---

### 3. Get Leave Types

Retrieve all active leave types for employee leave requests.

**Request**

```
GET /api-reference-data/leave-types
```

**Response**

```json
{
  "data": [
    {
      "id": "06a5468b-6082-48c4-993c-f42076644c42",
      "code": "personal_leave",
      "name": "ลากิจ",
      "days_per_year": 3,
      "requires_approval": true,
      "is_active": true,
      "created_at": "2025-11-17T02:27:44.271967+00:00",
      "updated_at": "2026-01-02T07:02:19.950952+00:00"
    },
    {
      "id": "7d1dc398-eb6a-440c-9189-48453c3cb969",
      "code": "sick_leave",
      "name": "ลาป่วย",
      "days_per_year": 30,
      "requires_approval": true,
      "is_active": true,
      "created_at": "2025-11-17T02:27:44.271967+00:00",
      "updated_at": "2026-01-02T07:02:19.950952+00:00"
    },
    {
      "id": "fb27ad28-34d1-47e3-9417-52e856869c23",
      "code": "vacation_leave",
      "name": "ลาพักร้อน",
      "days_per_year": 5,
      "requires_approval": true,
      "is_active": true,
      "created_at": "2025-11-17T02:27:44.271967+00:00",
      "updated_at": "2026-01-02T07:02:19.950952+00:00"
    }
  ]
}
```

**Leave Type Object Fields**

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `id` | uuid | No | Unique leave type identifier |
| `code` | string | Yes | Machine-readable code |
| `name` | string | No | Display name (Thai) |
| `days_per_year` | integer | Yes | Maximum allowed days per year |
| `requires_approval` | boolean | Yes | Whether leave requests require approval |
| `is_active` | boolean | Yes | Whether this leave type is active |
| `created_at` | timestamp | Yes | Creation timestamp |
| `updated_at` | timestamp | No | Last update timestamp |

**Common Leave Types**

| Code | Name (Thai) | Days/Year | Description |
|------|-------------|-----------|-------------|
| `personal_leave` | ลากิจ | 3 | Personal leave |
| `sick_leave` | ลาป่วย | 30 | Sick leave |
| `vacation_leave` | ลาพักร้อน | 5 | Annual vacation |

**Example Request**

```bash
curl -X GET "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-reference-data/leave-types" \
  -H "Authorization: Bearer <token>"
```

---

### 4. Get Provinces

Retrieve Thai provinces with their districts.

**Note:** This endpoint is currently under development and returns an empty array.

**Request**

```
GET /api-reference-data/provinces
```

**Response**

```json
{
  "data": []
}
```

**Expected Response (when implemented)**

```json
{
  "data": [
    {
      "id": "uuid",
      "code": "10",
      "name_th": "กรุงเทพมหานคร",
      "name_en": "Bangkok",
      "districts": [
        {
          "id": "uuid",
          "code": "1001",
          "name_th": "พระนคร",
          "name_en": "Phra Nakhon"
        }
      ]
    }
  ]
}
```

**Example Request**

```bash
curl -X GET "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-reference-data/provinces" \
  -H "Authorization: Bearer <token>"
```

---

### 5. Get Work Givers

Retrieve all active work givers (external work assignment sources).

**Request**

```
GET /api-reference-data/work-givers
```

**Response**

```json
{
  "data": [
    {
      "id": "8a4e624f-7bf0-4cfa-ab75-f477ce17331a",
      "code": "APC",
      "name": "APC",
      "is_active": true,
      "created_at": "2026-01-05T07:01:00.459104+00:00",
      "updated_at": "2026-01-05T07:01:00.459104+00:00"
    },
    {
      "id": "decc730c-3a9e-4051-91f6-0a06b2a20f72",
      "code": "APC_INGRAM",
      "name": "APC - INGRAM",
      "is_active": true,
      "created_at": "2026-01-06T06:52:19.959879+00:00",
      "updated_at": "2026-01-06T06:52:19.959879+00:00"
    },
    {
      "id": "7e3d2b9c-9970-4e75-8994-f54e0d1ec51d",
      "code": "APC_S_DISTRIBUTION",
      "name": "APC - S Distribution",
      "is_active": true,
      "created_at": "2026-01-06T06:53:01.192842+00:00",
      "updated_at": "2026-01-06T06:53:01.192842+00:00"
    }
  ]
}
```

**Work Giver Object Fields**

| Field | Type | Description |
|-------|------|-------------|
| `id` | uuid | Unique work giver identifier |
| `code` | string | Machine-readable code |
| `name` | string | Display name |
| `is_active` | boolean | Whether this work giver is active |
| `created_at` | timestamp | Creation timestamp |
| `updated_at` | timestamp | Last update timestamp |

**Example Request**

```bash
curl -X GET "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-reference-data/work-givers" \
  -H "Authorization: Bearer <token>"
```

---

## Error Responses

All errors follow the standard API error format:

```json
{
  "error": "Error message"
}
```

### Common Errors

| HTTP Status | Error Message | Description |
|-------------|---------------|-------------|
| 401 | Unauthorized | Missing or invalid authentication token |
| 404 | Not found | Invalid endpoint path |
| 405 | Method not allowed | Only GET method is allowed |
| 500 | Database error message | Database query failed |

---

## Usage Notes

### Frontend Integration

1. **Caching**: Reference data rarely changes. Cache responses on the client side with a reasonable TTL (e.g., 1 hour) to reduce API calls.

2. **Initial Load**: Use `GET /api-initialize/me` for bootstrapping all constants in a single request. This endpoint returns all reference data along with user information.

3. **Dropdown Population**: Use the `code` field as the value and `name` as the display text in select/dropdown components.

4. **Filtering**: Only active items are returned for leave types and work givers. Work types and statuses return all items regardless of `is_active` status.

### Code-to-Name Mapping

When displaying reference data in the UI, map the `code` to the corresponding `name`:

```typescript
// Example: Map work type code to name
const workTypeMap = new Map(workTypes.map(wt => [wt.code, wt.name]));
const displayName = workTypeMap.get('pm'); // Returns "PM"
```

---

## Related Endpoints

- **Initialize API** (`/api-initialize/me`) - Bootstrap all constants including roles, departments, work types, statuses, leave types, and work givers in a single request
- **Tickets API** (`/api-tickets`) - Uses work types and statuses
- **Leave Requests API** (`/api-leave-requests`) - Uses leave types
- **Employees API** (`/api-employees`) - Uses roles and departments

---

## Database Tables

### ref_ticket_work_types

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| code | varchar | Machine-readable code |
| name | varchar | Display name |
| is_active | boolean | Active status |
| created_at | timestamptz | Creation timestamp |
| updated_at | timestamptz | Last update timestamp |

### ref_ticket_statuses

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| code | varchar | Machine-readable code |
| name | varchar | Display name (Thai) |
| is_active | boolean | Active status |
| created_at | timestamptz | Creation timestamp |
| updated_at | timestamptz | Last update timestamp |

### ref_leave_types

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| code | varchar | Machine-readable code |
| name | varchar | Display name (Thai) |
| days_per_year | integer | Maximum days allowed per year |
| requires_approval | boolean | Whether approval is required |
| is_active | boolean | Active status |
| created_at | timestamptz | Creation timestamp |
| updated_at | timestamptz | Last update timestamp |

### ref_work_givers

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| code | varchar | Machine-readable code |
| name | varchar | Display name |
| is_active | boolean | Active status |
| created_at | timestamptz | Creation timestamp |
| updated_at | timestamptz | Last update timestamp |
