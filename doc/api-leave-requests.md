# API Leave Requests

## Overview

The Leave Requests API manages employee leave requests with approval workflow in the Field Service Management system. It supports various leave types including vacation, sick leave, personal leave, and more.

This API allows users to:
- Create, view, update, and delete leave requests
- Search leave requests by reason
- Approve or reject leave requests (admin only)
- Cancel pending leave requests

---

## Base URL

```
/api-leave-requests
```

---

## Authentication

All endpoints require a valid JWT token in the Authorization header.

```
Authorization: Bearer <jwt_token>
```

**Permission Levels:**

| Operation | Required Level | Role |
|-----------|----------------|------|
| List, Get, Search, Create, Update, Cancel | 0 | Technician L1 or higher |
| Approve, Reject | 2 | Admin or higher |
| Delete | 2 | Admin or higher |

---

## Leave Request Statuses

| Status | Description (Thai) | Description |
|--------|-------------------|-------------|
| `pending` | รอการอนุมัติ | Awaiting approval |
| `approved` | อนุมัติแล้ว | Approved by manager |
| `rejected` | ปฏิเสธ | Rejected by manager |
| `cancelled` | ยกเลิก | Cancelled by employee |

---

## Half Day Types

| Value | Description |
|-------|-------------|
| `morning` | Morning half-day leave |
| `afternoon` | Afternoon half-day leave |
| `null` | Full day leave |

---

## Endpoints Summary

| Method | Path | Description | Auth Level |
|--------|------|-------------|------------|
| GET | `/` | List leave requests | 0 |
| GET | `/search` | Search leave requests | 0 |
| GET | `/:id` | Get leave request by ID | 0 |
| POST | `/` | Create new leave request | 0 |
| PUT | `/:id` | Update leave request | 0 |
| DELETE | `/:id` | Delete leave request | 2 |
| POST | `/:id/approve` | Approve leave request | 2 |
| POST | `/:id/reject` | Reject leave request | 2 |
| POST | `/:id/cancel` | Cancel leave request | 0 |

---

## Endpoints

### 1. List Leave Requests

Retrieve a paginated list of leave requests with optional filters.

**Request**

```
GET /api-leave-requests
```

**Query Parameters**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `page` | integer | No | 1 | Page number (minimum: 1) |
| `limit` | integer | No | 20 | Items per page (1-100) |
| `status` | string | No | - | Filter by status (pending, approved, rejected, cancelled, all) |
| `leave_type_id` | uuid | No | - | Filter by leave type ID |
| `employee_id` | uuid | No | - | Filter by employee ID |
| `start_date` | date | No | - | Filter leave requests that end on or after this date |
| `end_date` | date | No | - | Filter leave requests that start on or before this date |

**Response**

```json
{
  "data": {
    "data": [
      {
        "id": "uuid",
        "employee_id": "uuid",
        "employee_code": "EMP001",
        "employee_name": "สมชาย ใจดี",
        "leave_type_id": "uuid",
        "leave_type_code": "vacation",
        "leave_type_name": "พักร้อน",
        "start_date": "2024-01-15",
        "end_date": "2024-01-17",
        "reason": "ลาพักผ่อนประจำปี",
        "status": "pending",
        "approved_by": null,
        "approved_by_code": null,
        "approved_by_name": null,
        "approved_at": null,
        "created_at": "2024-01-10T10:30:00Z",
        "updated_at": "2024-01-10T10:30:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 45,
      "totalPages": 3,
      "hasNext": true,
      "hasPrevious": false
    }
  }
}
```

**Example Request**

```bash
# Get all leave requests
curl -X GET "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-leave-requests" \
  -H "Authorization: Bearer <token>"

# Filter by status
curl -X GET "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-leave-requests?status=pending" \
  -H "Authorization: Bearer <token>"

# Filter by employee and date range
curl -X GET "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-leave-requests?employee_id=uuid&start_date=2024-01-01&end_date=2024-01-31" \
  -H "Authorization: Bearer <token>"
```

---

### 2. Search Leave Requests

Search leave requests by reason.

**Request**

```
GET /api-leave-requests/search
```

**Query Parameters**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `q` | string | No | "" | Search query (searches in reason field) |

**Response**

```json
{
  "data": [
    {
      "id": "uuid",
      "employee_id": "uuid",
      "employee_code": "EMP001",
      "employee_name": "สมชาย ใจดี",
      "leave_type_id": "uuid",
      "start_date": "2024-01-15",
      "end_date": "2024-01-17",
      "reason": "ลาพักผ่อนประจำปี",
      "status": "pending",
      "created_at": "2024-01-10T10:30:00Z",
      "updated_at": "2024-01-10T10:30:00Z"
    }
  ]
}
```

**Notes**
- Returns maximum 20 results
- Results are ordered by creation date (newest first)
- Returns empty array if query is empty

**Example Request**

```bash
curl -X GET "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-leave-requests/search?q=พักร้อน" \
  -H "Authorization: Bearer <token>"
```

---

### 3. Get Leave Request by ID

Retrieve a single leave request with full details.

**Request**

```
GET /api-leave-requests/:id
```

**Path Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | uuid | Yes | Leave request ID |

**Response**

```json
{
  "data": {
    "id": "uuid",
    "employee_id": "uuid",
    "leave_type_id": "uuid",
    "start_date": "2024-01-15",
    "end_date": "2024-01-17",
    "total_days": 3,
    "half_day_type": null,
    "reason": "ลาพักผ่อนประจำปี",
    "status": "approved",
    "approved_by": "uuid",
    "approved_at": "2024-01-11T09:00:00Z",
    "rejected_reason": null,
    "created_at": "2024-01-10T10:30:00Z",
    "updated_at": "2024-01-11T09:00:00Z",
    "employee": {
      "id": "uuid",
      "code": "EMP001",
      "name": "สมชาย ใจดี",
      "nickname": "ชาย"
    },
    "leave_type": {
      "id": "uuid",
      "code": "vacation",
      "name": "พักร้อน"
    },
    "approved_by_employee": {
      "id": "uuid",
      "code": "ADM001",
      "name": "สมหญิง รักงาน"
    }
  }
}
```

**Example Request**

```bash
curl -X GET "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-leave-requests/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer <token>"
```

---

### 4. Create Leave Request

Create a new leave request.

**Request**

```
POST /api-leave-requests
```

**Request Body**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `employee_id` | uuid | Yes | Employee requesting leave |
| `leave_type_id` | uuid | Yes | Type of leave (from ref_leave_types) |
| `start_date` | date | Yes | Leave start date (YYYY-MM-DD) |
| `end_date` | date | Yes | Leave end date (YYYY-MM-DD) |
| `total_days` | number | No | Total number of leave days |
| `reason` | string | No | Reason for leave |
| `status` | string | No | Initial status (default: "pending") |
| `half_day_type` | string | No | Half day type (morning, afternoon, or null for full day) |

**Request Body Example**

```json
{
  "employee_id": "550e8400-e29b-41d4-a716-446655440000",
  "leave_type_id": "550e8400-e29b-41d4-a716-446655440001",
  "start_date": "2024-01-15",
  "end_date": "2024-01-17",
  "total_days": 3,
  "reason": "ลาพักผ่อนประจำปี"
}
```

**Response**

```json
{
  "data": {
    "id": "uuid",
    "employee_id": "uuid",
    "leave_type_id": "uuid",
    "start_date": "2024-01-15",
    "end_date": "2024-01-17",
    "total_days": 3,
    "half_day_type": null,
    "reason": "ลาพักผ่อนประจำปี",
    "status": "pending",
    "approved_by": null,
    "approved_at": null,
    "created_at": "2024-01-10T10:30:00Z",
    "updated_at": "2024-01-10T10:30:00Z",
    "employee": { ... },
    "leave_type": { ... }
  }
}
```

**Example Request**

```bash
curl -X POST "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-leave-requests" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "employee_id": "550e8400-e29b-41d4-a716-446655440000",
    "leave_type_id": "550e8400-e29b-41d4-a716-446655440001",
    "start_date": "2024-01-15",
    "end_date": "2024-01-17",
    "total_days": 3,
    "reason": "ลาพักผ่อนประจำปี"
  }'
```

---

### 5. Update Leave Request

Update an existing leave request.

**Request**

```
PUT /api-leave-requests/:id
```

**Path Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | uuid | Yes | Leave request ID |

**Request Body**

All fields are optional. Only include fields you want to update.

| Field | Type | Description |
|-------|------|-------------|
| `leave_type_id` | uuid | Type of leave |
| `start_date` | date | Leave start date |
| `end_date` | date | Leave end date |
| `total_days` | number | Total number of leave days |
| `reason` | string | Reason for leave |
| `half_day_type` | string | Half day type (morning, afternoon) |

**Request Body Example**

```json
{
  "reason": "เปลี่ยนเหตุผล: ลาไปธุระส่วนตัว",
  "end_date": "2024-01-18"
}
```

**Response**

```json
{
  "data": {
    "id": "uuid",
    "employee_id": "uuid",
    "leave_type_id": "uuid",
    "start_date": "2024-01-15",
    "end_date": "2024-01-18",
    "total_days": 4,
    "reason": "เปลี่ยนเหตุผล: ลาไปธุระส่วนตัว",
    "status": "pending",
    "created_at": "2024-01-10T10:30:00Z",
    "updated_at": "2024-01-12T14:00:00Z",
    "employee": { ... },
    "leave_type": { ... },
    "approved_by_employee": null
  }
}
```

**Example Request**

```bash
curl -X PUT "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-leave-requests/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "เปลี่ยนเหตุผล: ลาไปธุระส่วนตัว"
  }'
```

---

### 6. Delete Leave Request

Delete a leave request. Requires admin permission (Level 2).

**Request**

```
DELETE /api-leave-requests/:id
```

**Path Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | uuid | Yes | Leave request ID |

**Response**

```json
{
  "data": {
    "message": "ลบคำขอลาสำเร็จ"
  }
}
```

**Example Request**

```bash
curl -X DELETE "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-leave-requests/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer <token>"
```

---

### 7. Approve Leave Request

Approve a pending leave request. Requires admin permission (Level 2).

**Request**

```
POST /api-leave-requests/:id/approve
```

**Path Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | uuid | Yes | Leave request ID |

**Response**

```json
{
  "data": {
    "id": "uuid",
    "employee_id": "uuid",
    "leave_type_id": "uuid",
    "start_date": "2024-01-15",
    "end_date": "2024-01-17",
    "reason": "ลาพักผ่อนประจำปี",
    "status": "approved",
    "approved_by": "uuid",
    "approved_at": "2024-01-11T09:00:00Z",
    "created_at": "2024-01-10T10:30:00Z",
    "updated_at": "2024-01-11T09:00:00Z",
    "employee": { ... },
    "leave_type": { ... },
    "approved_by_employee": { ... }
  }
}
```

**Example Request**

```bash
curl -X POST "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-leave-requests/550e8400-e29b-41d4-a716-446655440000/approve" \
  -H "Authorization: Bearer <token>"
```

---

### 8. Reject Leave Request

Reject a pending leave request. Requires admin permission (Level 2).

**Request**

```
POST /api-leave-requests/:id/reject
```

**Path Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | uuid | Yes | Leave request ID |

**Request Body**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `reason` | string | No | Reason for rejection |

**Request Body Example**

```json
{
  "reason": "มีงานด่วนที่ต้องทำในช่วงเวลานี้"
}
```

**Response**

```json
{
  "data": {
    "id": "uuid",
    "employee_id": "uuid",
    "leave_type_id": "uuid",
    "start_date": "2024-01-15",
    "end_date": "2024-01-17",
    "reason": "ลาพักผ่อนประจำปี",
    "status": "rejected",
    "approved_by": "uuid",
    "approved_at": "2024-01-11T09:00:00Z",
    "rejected_reason": "มีงานด่วนที่ต้องทำในช่วงเวลานี้",
    "created_at": "2024-01-10T10:30:00Z",
    "updated_at": "2024-01-11T09:00:00Z",
    "employee": { ... },
    "leave_type": { ... },
    "approved_by_employee": { ... }
  }
}
```

**Example Request**

```bash
curl -X POST "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-leave-requests/550e8400-e29b-41d4-a716-446655440000/reject" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "มีงานด่วนที่ต้องทำในช่วงเวลานี้"
  }'
```

---

### 9. Cancel Leave Request

Cancel a leave request. Any authenticated user can cancel their own pending leave requests.

**Request**

```
POST /api-leave-requests/:id/cancel
```

**Path Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | uuid | Yes | Leave request ID |

**Response**

```json
{
  "data": {
    "id": "uuid",
    "employee_id": "uuid",
    "leave_type_id": "uuid",
    "start_date": "2024-01-15",
    "end_date": "2024-01-17",
    "reason": "ลาพักผ่อนประจำปี",
    "status": "cancelled",
    "created_at": "2024-01-10T10:30:00Z",
    "updated_at": "2024-01-11T10:00:00Z",
    "employee": { ... },
    "leave_type": { ... },
    "approved_by_employee": null
  }
}
```

**Example Request**

```bash
curl -X POST "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-leave-requests/550e8400-e29b-41d4-a716-446655440000/cancel" \
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
| 400 | ข้อมูลที่ส่งมาไม่ถูกต้อง | Invalid request body or parameters |
| 400 | Leave Request ID ต้องเป็น UUID | Invalid UUID format |
| 400 | Employee ID จำเป็นต้องระบุ | Missing required employee_id |
| 400 | Leave Type ID จำเป็นต้องระบุ | Missing required leave_type_id |
| 400 | Start Date จำเป็นต้องระบุ | Missing required start_date |
| 400 | End Date จำเป็นต้องระบุ | Missing required end_date |
| 401 | ไม่มีสิทธิ์เข้าถึง | Missing or invalid authentication |
| 403 | ไม่มีสิทธิ์ในการดำเนินการ | Insufficient permission level |
| 404 | ไม่พบคำขอลา | Leave request not found |
| 404 | Not found | Invalid endpoint path |
| 500 | Database error message | Database operation failed |

---

## Database Tables

### Main Table: `child_employee_leave_requests`

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | uuid | No | Primary key |
| employee_id | uuid | No | FK to main_employees |
| leave_type_id | uuid | No | FK to ref_leave_types |
| start_date | date | No | Leave start date |
| end_date | date | No | Leave end date |
| total_days | numeric | Yes | Total number of leave days |
| half_day_type | enum | Yes | morning, afternoon, or null |
| reason | text | Yes | Reason for leave |
| status | text | No | pending, approved, rejected, cancelled |
| approved_by | uuid | Yes | FK to main_employees (approver) |
| approved_at | timestamptz | Yes | Approval timestamp |
| rejected_reason | text | Yes | Reason for rejection |
| created_at | timestamptz | No | Creation timestamp |
| updated_at | timestamptz | No | Last update timestamp |

### Reference Table: `ref_leave_types`

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| code | text | Leave type code (e.g., vacation, sick) |
| name | text | Leave type name in Thai |

---

## Related Endpoints

- **Employees API** (`/api-employees`) - Employee data referenced by leave requests
- **Reference Data API** (`/api-reference-data`) - Leave types and other reference data

---

## Usage Notes

### Frontend Integration

1. **Leave Calendar**: Use the date range filters (`start_date`, `end_date`) to fetch leave requests for calendar display.

2. **Status Workflow**:
   - New requests start as `pending`
   - Admins can `approve` or `reject` pending requests
   - Employees can `cancel` their own pending requests
   - Approved/rejected/cancelled requests cannot be changed

3. **Half-Day Leave**: When creating half-day leave requests, set `half_day_type` to either `morning` or `afternoon`. For full-day leave, omit this field or set it to `null`.

4. **Filtering by Employee**: Use the `employee_id` filter to show only a specific employee's leave requests (useful for personal leave management).
