# API Ticket Work Estimates

## Overview

The Ticket Work Estimates API manages estimated work duration for tickets in the Field Service Management system. These estimates are used in route optimization to calculate realistic ETAs and help planners create efficient technician schedules.

Work estimates help planners:
- Calculate realistic technician schedules
- Account for on-site work time in route optimization
- Track historical work duration patterns

---

## Base URL

```
/api-ticket-work-estimates
```

---

## Authentication

All endpoints require a valid JWT token in the Authorization header.

```
Authorization: Bearer <jwt_token>
```

**Required Permission Level:** 1 (Assigner, PM, Sales or higher)

Only users with level 1+ permissions can create, view, update, or delete work estimates.

---

## Endpoints Summary

| Method | Path | Description | Auth Required |
|--------|------|-------------|---------------|
| GET | `/ticket/:ticketId` | Get estimate by ticket ID | Yes |
| GET | `/:id` | Get estimate by ID | Yes |
| POST | `/` | Create estimate | Yes |
| POST | `/upsert` | Create or update estimate | Yes |
| POST | `/bulk` | Bulk create/update estimates | Yes |
| PUT | `/:id` | Update estimate | Yes |
| DELETE | `/:id` | Delete by ID | Yes |
| DELETE | `/ticket/:ticketId` | Delete by ticket ID | Yes |

---

## Data Model

### Work Estimate Object

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `id` | uuid | No | Unique work estimate identifier |
| `ticket_id` | uuid | No | Related ticket ID |
| `estimated_minutes` | integer | No | Estimated work duration (1-480 minutes) |
| `notes` | string | Yes | Additional notes about the estimate |
| `created_at` | timestamp | No | Creation timestamp |
| `updated_at` | timestamp | No | Last update timestamp |
| `created_by` | uuid | Yes | User who created the estimate |

### Work Estimate With Ticket Object

Extended object returned by GET endpoints with additional ticket information:

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `id` | uuid | No | Unique work estimate identifier |
| `ticket_id` | uuid | No | Related ticket ID |
| `estimated_minutes` | integer | No | Estimated work duration (1-480 minutes) |
| `notes` | string | Yes | Additional notes about the estimate |
| `created_at` | timestamp | No | Creation timestamp |
| `updated_at` | timestamp | No | Last update timestamp |
| `created_by` | uuid | Yes | User who created the estimate |
| `ticket_code` | string | Yes | Ticket code (e.g., "TK-001") |
| `site_name` | string | Yes | Site name where work will be performed |
| `work_type_name` | string | Yes | Work type name (e.g., "PM", "RMA") |

---

## Endpoints

### 1. Get Work Estimate by Ticket ID

Retrieve a work estimate for a specific ticket.

**Request**

```
GET /api-ticket-work-estimates/ticket/:ticketId
```

**Path Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `ticketId` | uuid | Yes | Ticket UUID |

**Response**

```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "ticket_id": "660e8400-e29b-41d4-a716-446655440001",
    "estimated_minutes": 60,
    "notes": "ต้องเปลี่ยนชิ้นส่วน 2 ชิ้น",
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T10:30:00Z",
    "created_by": "770e8400-e29b-41d4-a716-446655440002",
    "ticket_code": "TK-2024-001",
    "site_name": "บริษัท ABC จำกัด",
    "work_type_name": "PM"
  }
}
```

**Example Request**

```bash
curl -X GET "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-ticket-work-estimates/ticket/660e8400-e29b-41d4-a716-446655440001" \
  -H "Authorization: Bearer <token>"
```

---

### 2. Get Work Estimate by ID

Retrieve a work estimate by its unique ID.

**Request**

```
GET /api-ticket-work-estimates/:id
```

**Path Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | uuid | Yes | Work estimate UUID |

**Response**

```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "ticket_id": "660e8400-e29b-41d4-a716-446655440001",
    "estimated_minutes": 60,
    "notes": "ต้องเปลี่ยนชิ้นส่วน 2 ชิ้น",
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T10:30:00Z",
    "created_by": "770e8400-e29b-41d4-a716-446655440002",
    "ticket_code": "TK-2024-001",
    "site_name": "บริษัท ABC จำกัด",
    "work_type_name": "PM"
  }
}
```

**Example Request**

```bash
curl -X GET "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-ticket-work-estimates/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer <token>"
```

---

### 3. Create Work Estimate

Create a new work estimate for a ticket. Each ticket can only have one work estimate.

**Request**

```
POST /api-ticket-work-estimates
```

**Request Body**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `ticket_id` | uuid | Yes | Ticket UUID |
| `estimated_minutes` | integer | Yes | Estimated duration (1-480 minutes) |
| `notes` | string | No | Additional notes |

**Request Body Example**

```json
{
  "ticket_id": "660e8400-e29b-41d4-a716-446655440001",
  "estimated_minutes": 90,
  "notes": "รวมเวลาติดตั้งและทดสอบ"
}
```

**Response**

```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "ticket_id": "660e8400-e29b-41d4-a716-446655440001",
    "estimated_minutes": 90,
    "notes": "รวมเวลาติดตั้งและทดสอบ",
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T10:30:00Z",
    "created_by": "770e8400-e29b-41d4-a716-446655440002"
  }
}
```

**Example Request**

```bash
curl -X POST "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-ticket-work-estimates" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "ticket_id": "660e8400-e29b-41d4-a716-446655440001",
    "estimated_minutes": 90,
    "notes": "รวมเวลาติดตั้งและทดสอบ"
  }'
```

---

### 4. Upsert Work Estimate

Create a new work estimate or update an existing one for the specified ticket. This is useful when you want to set a work estimate without checking if one already exists.

**Request**

```
POST /api-ticket-work-estimates/upsert
```

**Request Body**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `ticket_id` | uuid | Yes | Ticket UUID |
| `estimated_minutes` | integer | Yes | Estimated duration (1-480 minutes) |
| `notes` | string | No | Additional notes |

**Request Body Example**

```json
{
  "ticket_id": "660e8400-e29b-41d4-a716-446655440001",
  "estimated_minutes": 120,
  "notes": "อัปเดตเวลาหลังตรวจสอบหน้างาน"
}
```

**Response**

```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "ticket_id": "660e8400-e29b-41d4-a716-446655440001",
    "estimated_minutes": 120,
    "notes": "อัปเดตเวลาหลังตรวจสอบหน้างาน",
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T11:00:00Z",
    "created_by": "770e8400-e29b-41d4-a716-446655440002",
    "is_new": false
  }
}
```

**Response Fields**

| Field | Type | Description |
|-------|------|-------------|
| `is_new` | boolean | `true` if a new record was created, `false` if an existing record was updated |

**Example Request**

```bash
curl -X POST "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-ticket-work-estimates/upsert" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "ticket_id": "660e8400-e29b-41d4-a716-446655440001",
    "estimated_minutes": 120,
    "notes": "อัปเดตเวลาหลังตรวจสอบหน้างาน"
  }'
```

---

### 5. Bulk Create/Update Work Estimates

Create or update multiple work estimates in a single request. Each estimate is processed using upsert logic.

**Request**

```
POST /api-ticket-work-estimates/bulk
```

**Request Body**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `estimates` | array | Yes | Array of work estimate objects (max 100 items) |

**Estimate Object**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `ticket_id` | uuid | Yes | Ticket UUID |
| `estimated_minutes` | integer | Yes | Estimated duration (1-480 minutes) |
| `notes` | string | No | Additional notes |

**Request Body Example**

```json
{
  "estimates": [
    {
      "ticket_id": "660e8400-e29b-41d4-a716-446655440001",
      "estimated_minutes": 60,
      "notes": "งาน PM ปกติ"
    },
    {
      "ticket_id": "660e8400-e29b-41d4-a716-446655440002",
      "estimated_minutes": 120,
      "notes": "ต้องเปลี่ยนอะไหล่"
    },
    {
      "ticket_id": "660e8400-e29b-41d4-a716-446655440003",
      "estimated_minutes": 45
    }
  ]
}
```

**Response**

```json
{
  "data": {
    "created": 2,
    "updated": 1,
    "errors": []
  }
}
```

**Response Fields**

| Field | Type | Description |
|-------|------|-------------|
| `created` | integer | Number of new records created |
| `updated` | integer | Number of existing records updated |
| `errors` | array | Array of error objects for failed items |

**Error Object**

| Field | Type | Description |
|-------|------|-------------|
| `ticket_id` | string | Ticket ID that failed (or "unknown" if not provided) |
| `error` | string | Error message (Thai) |

**Response with Errors**

```json
{
  "data": {
    "created": 1,
    "updated": 0,
    "errors": [
      {
        "ticket_id": "invalid-uuid",
        "error": "ไม่พบ ticket ที่ระบุ"
      },
      {
        "ticket_id": "660e8400-e29b-41d4-a716-446655440004",
        "error": "เวลาทำงานต้องอยู่ระหว่าง 1-480 นาที"
      }
    ]
  }
}
```

**Example Request**

```bash
curl -X POST "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-ticket-work-estimates/bulk" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "estimates": [
      {"ticket_id": "660e8400-e29b-41d4-a716-446655440001", "estimated_minutes": 60},
      {"ticket_id": "660e8400-e29b-41d4-a716-446655440002", "estimated_minutes": 90}
    ]
  }'
```

---

### 6. Update Work Estimate

Update an existing work estimate.

**Request**

```
PUT /api-ticket-work-estimates/:id
```

**Path Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | uuid | Yes | Work estimate UUID |

**Request Body**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `estimated_minutes` | integer | No | New estimated duration (1-480 minutes) |
| `notes` | string | No | Updated notes |

At least one field must be provided.

**Request Body Example**

```json
{
  "estimated_minutes": 75,
  "notes": "อัปเดตหลังจากตรวจสอบเพิ่มเติม"
}
```

**Response**

```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "ticket_id": "660e8400-e29b-41d4-a716-446655440001",
    "estimated_minutes": 75,
    "notes": "อัปเดตหลังจากตรวจสอบเพิ่มเติม",
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T14:00:00Z",
    "created_by": "770e8400-e29b-41d4-a716-446655440002"
  }
}
```

**Example Request**

```bash
curl -X PUT "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-ticket-work-estimates/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"estimated_minutes": 75}'
```

---

### 7. Delete Work Estimate by ID

Delete a work estimate by its unique ID.

**Request**

```
DELETE /api-ticket-work-estimates/:id
```

**Path Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | uuid | Yes | Work estimate UUID |

**Response**

```json
{
  "data": {
    "message": "ลบข้อมูลสำเร็จ"
  }
}
```

**Example Request**

```bash
curl -X DELETE "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-ticket-work-estimates/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer <token>"
```

---

### 8. Delete Work Estimate by Ticket ID

Delete a work estimate associated with a specific ticket.

**Request**

```
DELETE /api-ticket-work-estimates/ticket/:ticketId
```

**Path Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `ticketId` | uuid | Yes | Ticket UUID |

**Response**

```json
{
  "data": {
    "message": "ลบข้อมูลสำเร็จ"
  }
}
```

**Example Request**

```bash
curl -X DELETE "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-ticket-work-estimates/ticket/660e8400-e29b-41d4-a716-446655440001" \
  -H "Authorization: Bearer <token>"
```

---

## Error Responses

All errors follow the standard API error format:

```json
{
  "error": "Error message in Thai"
}
```

### Common Errors

| HTTP Status | Error Message | Description |
|-------------|---------------|-------------|
| 400 | กรุณาระบุ ticket_id | Missing ticket_id in request |
| 400 | กรุณาระบุเวลาทำงาน (estimated_minutes) | Missing estimated_minutes in request |
| 400 | เวลาทำงานต้องอยู่ระหว่าง 1-480 นาที | estimated_minutes out of valid range |
| 400 | กรุณาระบุข้อมูลที่ต้องการอัปเดต | No fields provided for update |
| 400 | กรุณาระบุ estimates เป็น array | Invalid bulk request format |
| 400 | ต้องมีอย่างน้อย 1 รายการ | Empty estimates array in bulk request |
| 400 | สูงสุด 100 รายการต่อครั้ง | Bulk request exceeds 100 items limit |
| 400 | ticket นี้มีข้อมูลเวลาทำงานอยู่แล้ว | Duplicate work estimate for ticket (use upsert instead) |
| 401 | ไม่มีสิทธิ์เข้าถึง | Missing or invalid authentication token |
| 403 | ไม่มีสิทธิ์ดำเนินการ | Insufficient permission level |
| 404 | ไม่พบ endpoint ที่ระบุ | Invalid endpoint path |
| 404 | ไม่พบข้อมูลเวลาทำงาน | Work estimate not found |
| 404 | ไม่พบข้อมูลเวลาทำงานสำหรับ ticket นี้ | No work estimate exists for the ticket |
| 404 | ไม่พบ ticket ที่ระบุ | Ticket not found |
| 500 | ไม่สามารถดึงข้อมูลได้ | Database error fetching data |
| 500 | ไม่สามารถสร้างข้อมูลได้ | Database error creating data |
| 500 | ไม่สามารถอัปเดตข้อมูลได้ | Database error updating data |
| 500 | ไม่สามารถลบข้อมูลได้ | Database error deleting data |

---

## Usage Notes

### Estimated Minutes Constraints

- Minimum: 1 minute
- Maximum: 480 minutes (8 hours)
- Values outside this range will be rejected

### One Estimate Per Ticket

Each ticket can only have one work estimate. Attempting to create a duplicate will return an error. Use the `/upsert` endpoint to automatically handle create-or-update logic.

### Route Optimization Integration

Work estimates are used by the route optimization system to:
1. Calculate realistic travel + work schedules
2. Determine if a technician can complete all assigned tickets in a day
3. Provide accurate ETAs to customers

### Bulk Operations

The `/bulk` endpoint processes each estimate independently:
- Uses upsert logic (creates if not exists, updates if exists)
- Continues processing even if individual items fail
- Returns summary with created/updated counts and any errors
- Maximum 100 items per request

---

## Related Endpoints

- **Tickets API** (`/api-tickets`) - Main ticket operations
- **Route Optimization API** (`/api-route-optimization`) - Uses work estimates for scheduling

---

## Database Table

Work estimates are stored in the `child_ticket_work_estimates` table:

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| ticket_id | uuid | FK to main_tickets (unique constraint) |
| estimated_minutes | integer | Estimated work duration |
| notes | text | Additional notes (nullable) |
| created_by | uuid | FK to main_employees (nullable) |
| created_at | timestamptz | Creation timestamp |
| updated_at | timestamptz | Last update timestamp |
