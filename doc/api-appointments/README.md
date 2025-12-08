# Appointments API

## Overview

The Appointments API handles all appointment scheduling and management operations. Appointments are linked to tickets and can be scheduled for customer visits.

**Base URL**: `/functions/v1/api-appointments`

**Authentication**: All endpoints require Bearer token authentication.

---

## Endpoints

### List Appointments

Get a paginated list of all appointments.

**Endpoint**: `GET /`

**Required Level**: 0 (all authenticated users)

**Query Parameters**:
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)
- `ticket_id` (optional): Filter by ticket ID (UUID)

**Example Request**:
```http
GET /functions/v1/api-appointments?page=1&limit=20&ticket_id=123e4567-e89b-12d3-a456-426614174000
Authorization: Bearer <token>
```

**Example Response**:
```json
{
  "data": {
    "data": [
      {
        "id": "123e4567-e89b-12d3-a456-426614174000",
        "ticket_id": "123e4567-e89b-12d3-a456-426614174001",
        "appointment_type": "full_day",
        "appointment_date": "2025-01-15",
        "appointment_time_start": "14:00:00",
        "appointment_time_end": null,
        "is_approved": false,
        "created_at": "2025-01-10T10:00:00Z",
        "updated_at": "2025-01-10T10:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 1,
      "totalPages": 1,
      "hasNext": false,
      "hasPrevious": false
    }
  }
}
```

---

### Get Appointment by ID

Get a single appointment by its ID.

**Endpoint**: `GET /:id`

**Required Level**: 0 (all authenticated users)

**Path Parameters**:
- `id` (required): Appointment ID (UUID)

**Example Request**:
```http
GET /functions/v1/api-appointments/123e4567-e89b-12d3-a456-426614174000
Authorization: Bearer <token>
```

**Example Response**:
```json
{
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "ticket_id": "123e4567-e89b-12d3-a456-426614174001",
    "appointment_type": "full_day",
    "appointment_date": "2025-01-15",
    "appointment_time_start": "14:00:00",
    "appointment_time_end": null,
    "is_approved": false,
    "created_at": "2025-01-10T10:00:00Z",
    "updated_at": "2025-01-10T10:00:00Z"
  }
}
```

---

### Search Appointments

Search for appointments by notes or appointment type.

**Endpoint**: `GET /search`

**Required Level**: 0 (all authenticated users)

**Query Parameters**:
- `q` (required): Search query string (1+ characters)

**Example Request**:
```http
GET /functions/v1/api-appointments/search?q=meeting
Authorization: Bearer <token>
```

**Example Response**:
```json
{
  "data": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "ticket_id": "123e4567-e89b-12d3-a456-426614174001",
      "appointment_type": "meeting",
      "appointment_date": "2024-01-15",
      "appointment_time_start": null,
      "appointment_time_end": null,
      "is_approved": false,
      "notes": "Initial meeting with client",
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

**Searchable Fields**:
- `notes` - Appointment notes (partial match)
- `appointment_type` - Appointment type (partial match)

**Notes**:
- Search is case-insensitive
- Returns up to 20 results
- Results are sorted by appointment date (newest first)
- Empty query returns empty array
- Partial matches are supported

---

### Get Appointment by Ticket ID

Get appointment(s) associated with a specific ticket.

**Endpoint**: `GET /ticket/:ticketId`

**Required Level**: 0 (all authenticated users)

**Path Parameters**:
- `ticketId` (required): Ticket ID (UUID)

**Example Request**:
```http
GET /functions/v1/api-appointments/ticket/123e4567-e89b-12d3-a456-426614174001
Authorization: Bearer <token>
```

**Example Response**:
```json
{
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "ticket_id": "123e4567-e89b-12d3-a456-426614174001",
    "appointment_type": "full_day",
    "appointment_date": "2025-01-15",
    "appointment_time_start": "14:00:00",
    "appointment_time_end": null,
    "is_approved": false,
    "created_at": "2025-01-10T10:00:00Z",
    "updated_at": "2025-01-10T10:00:00Z"
  }
}
```

---

### Create Appointment

Create a new appointment.

**Endpoint**: `POST /`

**Required Level**: 1 (non-technician_l1 and above)

**Request Body**:
```json
{
  "ticket_id": "123e4567-e89b-12d3-a456-426614174001",
  "appointment_type": "full_day",
  "appointment_date": "2025-01-15",
  "appointment_time": "14:00:00",
  "notes": "Customer requested morning visit"
}
```

**Required Fields**:
- `appointment_type`: Type of appointment (`full_day`, `time_range`, `half_morning`, `half_afternoon`, `call_to_schedule`)

**Optional Fields**:
- `ticket_id`: Associated ticket ID (UUID)
- `appointment_date`: Date in YYYY-MM-DD format
- `appointment_time_start`: Start time in HH:MM:SS format
- `appointment_time_end`: End time in HH:MM:SS format
- `notes`: Additional notes

**Example Request**:
```http
POST /functions/v1/api-appointments
Authorization: Bearer <token>
Content-Type: application/json

{
  "ticket_id": "123e4567-e89b-12d3-a456-426614174001",
  "appointment_type": "full_day",
  "appointment_date": "2025-01-15",
  "appointment_time_start": "14:00:00",
  "appointment_time_end": "17:00:00",
  "notes": "Customer requested morning visit"
}
```

**Example Response** (201 Created):
```json
{
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "ticket_id": "123e4567-e89b-12d3-a456-426614174001",
    "appointment_type": "full_day",
    "appointment_date": "2025-01-15",
    "appointment_time_start": "14:00:00",
    "appointment_time_end": null,
    "is_approved": false,
    "created_at": "2025-01-10T10:00:00Z",
    "updated_at": "2025-01-10T10:00:00Z"
  }
}
```

---

### Update Appointment

Update an existing appointment.

**Endpoint**: `PUT /:id`

**Required Level**: 1 (non-technician_l1 and above)

**Path Parameters**:
- `id` (required): Appointment ID (UUID)

**Request Body**:
```json
{
  "appointment_date": "2025-01-16",
  "appointment_time_start": "15:00:00",
  "appointment_time_end": "16:00:00",
  "appointment_type": "time_range",
  "notes": "Updated appointment time"
}
```

**Example Request**:
```http
PUT /functions/v1/api-appointments/123e4567-e89b-12d3-a456-426614174000
Authorization: Bearer <token>
Content-Type: application/json

{
  "appointment_date": "2025-01-16",
  "appointment_time_start": "15:00:00",
  "appointment_time_end": "16:00:00",
  "appointment_type": "time_range"
}
```

**Example Response**:
```json
{
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "ticket_id": "123e4567-e89b-12d3-a456-426614174001",
    "appointment_type": "time_range",
    "appointment_date": "2025-01-16",
    "appointment_time_start": "15:00:00",
    "appointment_time_end": "16:00:00",
    "is_approved": false,
    "created_at": "2025-01-10T10:00:00Z",
    "updated_at": "2025-01-10T11:00:00Z"
  }
}
```

**Important Notes**:
- If a **non-approver** edits an appointment, `is_approved` will automatically be set to `false`
- If an **approver** edits an appointment, the `is_approved` status remains unchanged (unless explicitly set in the request body)
- Use the `/approve` endpoint if you need to approve/un-approve appointments

**Optional Fields**:
- `appointment_date`: Date in YYYY-MM-DD format
- `appointment_time_start`: Start time in HH:MM:SS format
- `appointment_time_end`: End time in HH:MM:SS format
- `appointment_type`: Type of appointment
- `ticket_id`: Associated ticket ID (UUID)
- `is_approved`: Approval status (boolean) - only approvers can set this

---

### Approve/Un-approve Appointment

Approve or un-approve an appointment and optionally update appointment details. Only users with roles that have approval permissions can use this endpoint.

**Endpoint**: `POST /approve`

**Required Permission**: Role must be in `appointment_approval_roles` table (check role's `can_approve` field)

**Request Body**:
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "is_approved": true,
  "appointment_date": "2025-01-16",
  "appointment_time_start": "14:00:00",
  "appointment_time_end": "15:00:00",
  "appointment_type": "time_range"
}
```

**Required Fields**:
- `id`: Appointment ID (UUID)

**Optional Fields**:
- `is_approved`: Approval status - `true` to approve, `false` to un-approve (defaults to `true` if not provided)
- `appointment_date`: Date in YYYY-MM-DD format
- `appointment_time_start`: Start time in HH:MM:SS format
- `appointment_time_end`: End time in HH:MM:SS format
- `appointment_type`: Type of appointment (`full_day`, `time_range`, `half_morning`, `half_afternoon`, `call_to_schedule`)

**Example Request - Approve**:
```http
POST /functions/v1/api-appointments/approve
Authorization: Bearer <token>
Content-Type: application/json

{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "is_approved": true,
  "appointment_date": "2025-01-16",
  "appointment_time_start": "14:00:00",
  "appointment_time_end": "15:00:00"
}
```

**Example Request - Un-approve**:
```http
POST /functions/v1/api-appointments/approve
Authorization: Bearer <token>
Content-Type: application/json

{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "is_approved": false
}
```

**Example Request - Approve and Edit**:
```http
POST /functions/v1/api-appointments/approve
Authorization: Bearer <token>
Content-Type: application/json

{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "is_approved": true,
  "appointment_date": "2025-01-17",
  "appointment_time_start": "10:00:00",
  "appointment_time_end": "11:00:00",
  "appointment_type": "time_range"
}
```

**Example Response**:
```json
{
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "ticket_id": "123e4567-e89b-12d3-a456-426614174001",
    "appointment_type": "time_range",
    "appointment_date": "2025-01-16",
    "appointment_time_start": "14:00:00",
    "appointment_time_end": "15:00:00",
    "is_approved": true,
    "created_at": "2025-01-10T10:00:00Z",
    "updated_at": "2025-01-10T11:00:00Z"
  }
}
```

**Notes**:
- This endpoint allows approvers to both approve/un-approve and edit appointment details in a single request
- If `is_approved` is not provided, it defaults to `true` (approve)
- Only roles configured in `appointment_approval_roles` can use this endpoint
- You can check if a role can approve by checking the `can_approve` field in the role summary or `/me` endpoint

---

### Delete Appointment

Delete an appointment.

**Endpoint**: `DELETE /:id`

**Required Level**: 1 (non-technician_l1 and above)

**Path Parameters**:
- `id` (required): Appointment ID (UUID)

**Example Request**:
```http
DELETE /functions/v1/api-appointments/123e4567-e89b-12d3-a456-426614174000
Authorization: Bearer <token>
```

**Example Response** (200 OK):
```json
{
  "data": {
    "message": "ลบข้อมูลสำเร็จ"
  }
}
```

---

## Error Responses

All endpoints may return the following error responses:

### 400 Bad Request
```json
{
  "error": "กรุณาระบุประเภทการนัดหมาย"
}
```

### 401 Unauthorized
```json
{
  "error": "ไม่ได้รับอนุญาต"
}
```

### 403 Forbidden
```json
{
  "error": "ต้องมีสิทธิ์ระดับ 1 ขึ้นไป"
}
```

**For Approve Endpoint**:
```json
{
  "error": "ไม่มีสิทธิ์อนุมัติการนัดหมาย"
}
```

### 404 Not Found
```json
{
  "error": "ไม่พบข้อมูล"
}
```

### 500 Internal Server Error
```json
{
  "error": "เกิดข้อผิดพลาดในการเข้าถึงข้อมูล"
}
```

---

## Appointment Types

The `appointment_type` field accepts the following values:

- `full_day`: Full day appointment
- `time_range`: Specific time range
- `half_morning`: Half day (morning)
- `half_afternoon`: Half day (afternoon)
- `call_to_schedule`: Call to schedule

---

## Appointment Approval

Appointments have an `is_approved` field that indicates whether the appointment has been approved:

- **Default**: New appointments are created with `is_approved: false`
- **Approval**: Only users with roles in `appointment_approval_roles` can approve/un-approve appointments
- **Auto-unapprove**: If a non-approver edits an appointment via `PUT /:id`, `is_approved` is automatically set to `false`
- **Approval Endpoint**: Use `POST /approve` to approve/un-approve appointments (and optionally edit details)

To check if a role can approve appointments:
- Check the `can_approve` field in the role summary (`GET /api-roles/role-summary`)
- Check the `can_approve` field in the role data from `/me` endpoint (`GET /api-initialize/me`)

## Notes

- All dates should be in `YYYY-MM-DD` format
- All times should be in `HH:MM:SS` format (24-hour)
- Appointment IDs are UUIDs
- Appointments can be linked to tickets via `ticket_id`
- Use `appointment_time_start` and `appointment_time_end` for time range appointments
- The `is_approved` field is a boolean indicating approval status

