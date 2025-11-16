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
        "appointment_time": "14:00:00",
        "notes": "Customer requested morning visit",
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
    "appointment_time": "14:00:00",
    "notes": "Customer requested morning visit",
    "created_at": "2025-01-10T10:00:00Z",
    "updated_at": "2025-01-10T10:00:00Z"
  }
}
```

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
    "appointment_time": "14:00:00",
    "notes": "Customer requested morning visit",
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
- `appointment_time`: Time in HH:MM:SS format
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
  "appointment_time": "14:00:00",
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
    "appointment_time": "14:00:00",
    "notes": "Customer requested morning visit",
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
  "appointment_time": "15:00:00",
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
  "appointment_time": "15:00:00",
  "notes": "Updated appointment time"
}
```

**Example Response**:
```json
{
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "ticket_id": "123e4567-e89b-12d3-a456-426614174001",
    "appointment_type": "full_day",
    "appointment_date": "2025-01-16",
    "appointment_time": "15:00:00",
    "notes": "Updated appointment time",
    "created_at": "2025-01-10T10:00:00Z",
    "updated_at": "2025-01-10T11:00:00Z"
  }
}
```

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

## Notes

- All dates should be in `YYYY-MM-DD` format
- All times should be in `HH:MM:SS` format (24-hour)
- Appointment IDs are UUIDs
- Appointments can be linked to tickets via `ticket_id`

