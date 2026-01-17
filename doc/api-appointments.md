# API Appointments

Appointments API for managing scheduled visits linked to tickets.

## Overview

| Attribute | Value |
|-----------|-------|
| Base URL | `/api-appointments` |
| Auth | JWT required |
| Content-Type | `application/json` |

## Database Schema

**Table:** `main_appointments`

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | uuid | NO | Primary key |
| appointment_date | date | YES | Scheduled date |
| appointment_time_start | time | YES | Start time |
| appointment_time_end | time | YES | End time |
| appointment_type | enum | NO | Type of scheduling |
| is_approved | boolean | NO | Approval status |
| created_at | timestamptz | YES | Created timestamp |
| updated_at | timestamptz | YES | Updated timestamp |

**Relationship:** `main_tickets.appointment_id` → `main_appointments.id`

### Appointment Types

| Type | Description |
|------|-------------|
| `full_day` | Available all day |
| `time_range` | Specific time window |
| `half_morning` | Morning only (AM) |
| `half_afternoon` | Afternoon only (PM) |
| `call_to_schedule` | Call customer to arrange |

## Endpoints

### List Appointments

```
GET /api-appointments
```

**Auth:** Level 0+ (all authenticated)

**Query Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| page | number | 1 | Page number |
| limit | number | 50 | Items per page |
| ticket_id | uuid | - | Filter by ticket |

**Response:** `200 OK`
```json
{
  "data": {
    "data": [
      {
        "id": "uuid",
        "appointment_type": "time_range",
        "appointment_date": "2026-01-20",
        "appointment_time_start": "09:00:00",
        "appointment_time_end": "12:00:00",
        "is_approved": true,
        "created_at": "2026-01-10T10:00:00Z",
        "updated_at": "2026-01-10T10:00:00Z"
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

---

### Get Appointment by ID

```
GET /api-appointments/:id
```

**Auth:** Level 0+

**Response:** `200 OK`
```json
{
  "data": {
    "id": "uuid",
    "appointment_type": "time_range",
    "appointment_date": "2026-01-20",
    "appointment_time_start": "09:00:00",
    "appointment_time_end": "12:00:00",
    "is_approved": true,
    "created_at": "2026-01-10T10:00:00Z",
    "updated_at": "2026-01-10T10:00:00Z"
  }
}
```

**Errors:**
- `400` - Invalid UUID
- `404` - ไม่พบข้อมูลการนัดหมาย

---

### Get Appointment by Ticket

```
GET /api-appointments/ticket/:ticketId
```

**Auth:** Level 0+

Gets the appointment linked to a specific ticket.

**Response:** `200 OK`
```json
{
  "data": { ... } // Appointment object or null
}
```

---

### Search Appointments

```
GET /api-appointments/search?q=:query
```

**Auth:** Level 0+

Searches appointments by `appointment_type`. Returns max 20 results.

**Query Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| q | string | Yes | Search query |

**Response:** `200 OK`
```json
{
  "data": [ ... ] // Array of appointments
}
```

---

### Create Appointment

```
POST /api-appointments
```

**Auth:** Level 1+ (Assigner, PM, Sales, Admin, Superadmin)

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| appointment_type | enum | Yes | Type of scheduling |
| appointment_date | string | No | Date (YYYY-MM-DD) |
| appointment_time_start | string | No | Start time (HH:MM) |
| appointment_time_end | string | No | End time (HH:MM) |
| ticket_id | uuid | No | Link to ticket |

**Example:**
```json
{
  "appointment_type": "time_range",
  "appointment_date": "2026-01-25",
  "appointment_time_start": "09:00",
  "appointment_time_end": "12:00",
  "ticket_id": "uuid-of-ticket"
}
```

**Response:** `201 Created`

**Notes:**
- If `ticket_id` provided, updates `main_tickets.appointment_id`
- New appointments are created with `is_approved: false`

---

### Update Appointment

```
PUT /api-appointments/:id
```

**Auth:** Level 1+

**Request Body:** Same fields as create (all optional)

**Response:** `200 OK`

**Important:** If a non-approver edits an appointment:
- `is_approved` automatically set to `false`
- Confirmed technicians are removed from the ticket
- Ticket requires re-approval

---

### Delete Appointment

```
DELETE /api-appointments/:id
```

**Auth:** Level 1+

**Response:** `200 OK`
```json
{
  "data": {
    "message": "ลบการนัดหมายสำเร็จ"
  }
}
```

**Notes:**
- Clears `appointment_id` from linked ticket
- Hard delete - cannot be recovered

---

### Approve/Unapprove Appointment

```
POST /api-appointments/approve
```

**Auth:** Appointment approver role only

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | uuid | Yes | Appointment ID |
| is_approved | boolean | No | Approval status (default: true) |
| appointment_date | string | No | Update date while approving |
| appointment_time_start | string | No | Update start time |
| appointment_time_end | string | No | Update end time |
| appointment_type | enum | No | Update type |

**Example - Approve:**
```json
{
  "id": "appointment-uuid"
}
```

**Example - Approve and update:**
```json
{
  "id": "appointment-uuid",
  "appointment_date": "2026-01-28",
  "appointment_time_start": "10:00"
}
```

**Example - Unapprove:**
```json
{
  "id": "appointment-uuid",
  "is_approved": false
}
```

**Response:** `200 OK`

**Side Effects:**
- Creates audit log on linked ticket
- Sends notifications to confirmed technicians

---

## Authorization Levels

| Level | Role | Permissions |
|-------|------|-------------|
| 0 | Technician L1 | Read only |
| 1 | Assigner, PM, Sales | Create, Update, Delete |
| 2+ | Admin, Superadmin | All + Approve |

## Error Responses

All errors return:
```json
{
  "error": "ข้อความภาษาไทย"
}
```

| Status | Description |
|--------|-------------|
| 400 | Validation error |
| 401 | Not authenticated |
| 403 | Insufficient permissions |
| 404 | Resource not found |
| 500 | Server error |
