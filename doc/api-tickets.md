# API Tickets Documentation

## Overview

The **Tickets API** (`api-tickets`) is a comprehensive Supabase Edge Function that manages work order tickets (service tickets) for the PDE Field Service Management system. It provides full CRUD operations for tickets along with extended functionality for comments, attachments, watchers, ratings, technician confirmations, and audit logging.

**Base URL:** `/api-tickets`

---

## Authentication

All endpoints require JWT authentication via the `Authorization` header, except for the warmup endpoint:

```
Authorization: Bearer <JWT_TOKEN>
```

The authenticated user must be a valid employee in the system.

---

## Authorization Levels

| Level | Role | Capabilities |
|-------|------|--------------|
| 0 | Technician L1 | Read-only access, can comment, watch, add attachments, manage extra fields |
| 1 | Assigner, PM, Sales | Create, update, delete tickets and ratings |
| 2 | Admin | User management, delete ratings, remove employee assignments, access all audit logs, backfill summaries |
| 3 | Superadmin | Full access |

---

## Table of Contents

1. [Core Ticket Operations](#core-ticket-operations)
   - [Search Tickets](#search-tickets)
   - [Search by Duration](#search-by-duration)
   - [Get Ticket by ID](#get-ticket-by-id)
   - [Create Ticket](#create-ticket)
   - [Update Ticket](#update-ticket)
   - [Delete Ticket](#delete-ticket)
2. [Comments](#comments)
   - [Get Comments](#get-comments)
   - [Create Comment](#create-comment)
   - [Update Comment](#update-comment)
   - [Delete Comment](#delete-comment)
3. [Watchers](#watchers)
   - [Get Watchers](#get-watchers)
   - [Add Watch](#add-watch)
   - [Remove Watch](#remove-watch)
4. [Attachments](#attachments)
   - [Get Attachments](#get-attachments)
   - [Add Attachments](#add-attachments)
   - [Delete Attachment](#delete-attachment)
5. [Ratings](#ratings)
   - [Get Rating](#get-rating)
   - [Create Rating](#create-rating)
   - [Update Rating](#update-rating)
   - [Delete Rating](#delete-rating)
6. [Technician Confirmations](#technician-confirmations)
   - [Confirm Technicians](#confirm-technicians)
   - [Get Confirmed Technicians](#get-confirmed-technicians)
   - [Get Summaries](#get-summaries)
7. [Employee Assignments](#employee-assignments)
   - [Remove Employee Assignment](#remove-employee-assignment)
8. [Audit Logs](#audit-logs)
   - [Get Ticket Audit Logs](#get-ticket-audit-logs)
   - [Get Recent Audit Logs](#get-recent-audit-logs)
9. [Backfill Summaries](#backfill-summaries)
   - [Start Backfill Job](#start-backfill-job)
   - [Check Backfill Status](#check-backfill-status)
10. [Extra Fields](#extra-fields)
    - [Get Extra Fields](#get-extra-fields)
    - [Create Extra Field](#create-extra-field)
    - [Update Extra Field](#update-extra-field)
    - [Delete Extra Field](#delete-extra-field)
    - [Bulk Upsert Extra Fields](#bulk-upsert-extra-fields)
11. [Utility](#utility)
    - [Warmup](#warmup)

---

## Core Ticket Operations

### Search Tickets

Search and filter tickets with pagination. Returns display-ready data with pre-resolved location names and employee details.

**Endpoint:** `GET /api-tickets/search`

**Permission Level:** 0 (All authenticated users)

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | number | Page number (default: 1) |
| `limit` | number | Items per page (default: 50, max: 100) |
| `id` | string | Filter by ticket ID (UUID, exact match) |
| `details` | string | Text search in ticket details |
| `work_type_id` | string | Filter by work type UUID |
| `assigner_id` | string | Filter by assigner UUID |
| `status_id` | string | Filter by status UUID |
| `additional` | string | Search in additional field |
| `site_id` | string | Filter by site UUID |
| `contact_id` | string | Filter by contact UUID |
| `appointment_id` | string | Filter by appointment UUID |
| `department_id` | string | Filter by department(s), use `%` separator for multiple |
| `employee_id` | string | Filter by assigned employee(s), use `%` separator for multiple |
| `start_date` | string | Start date (YYYY-MM-DD) for date range filter |
| `end_date` | string | End date (YYYY-MM-DD) for date range filter |
| `date_type` | string | Date field to filter: `create`, `update`, or `appointed` (default: `appointed` when dates provided) |
| `exclude_backlog` | boolean | Exclude backlog tickets when true |
| `appointment_is_approved` | boolean | Filter by appointment approval status |
| `watching` | boolean | When true, filter only tickets the user is watching |
| `include` | string | Response mode: `full` (default) or `minimal` |
| `sort` | string | Field to sort by |
| `order` | string | Sort direction: `asc` or `desc` (default: `desc`) |

**Response:**

```json
{
  "data": {
    "data": [
      {
        "id": "uuid",
        "ticket_code": "PDE-001",
        "ticket_number": 1,
        "site_name": "ABC Building",
        "company_name": "ABC Company",
        "work_type_name": "PM",
        "work_type_code": "pm",
        "status_name": "In Progress",
        "status_code": "in_progress",
        "assigner_name": "John Doe",
        "creator_name": "Jane Smith",
        "location": {
          "province_code": 10,
          "province_name": "Bangkok",
          "district_code": 1001,
          "district_name": "Phra Nakhon",
          "subdistrict_code": 100101,
          "subdistrict_name": "Phra Borom Maha Ratchawang",
          "address_detail": "123 Main Street",
          "display": "Phra Nakhon, Bangkok"
        },
        "appointment": {
          "id": "uuid",
          "date": "2025-01-15",
          "time_start": "09:00",
          "time_end": "12:00",
          "type": "time_range",
          "type_display": "09:00 - 12:00",
          "is_approved": true
        },
        "employees": [
          {
            "id": "uuid",
            "name": "Technician A",
            "code": "TECH001",
            "is_key": true,
            "profile_image_url": "https://..."
          }
        ],
        "employee_count": 1,
        "cf_employees": [],
        "cf_employee_count": 0,
        "details": "PM service for UPS system",
        "details_summary": "AI-generated summary",
        "additional": "Additional notes",
        "merchandise": [
          {
            "id": "uuid",
            "serial_no": "SN123456",
            "model_name": "Model XYZ"
          }
        ],
        "merchandise_count": 1,
        "work_giver": {
          "id": "uuid",
          "code": "PDE",
          "name": "PDE"
        },
        "created_at": "2025-01-01T00:00:00Z",
        "updated_at": "2025-01-10T00:00:00Z",
        "_ids": {
          "site_id": "uuid",
          "status_id": "uuid",
          "work_type_id": "uuid",
          "assigner_id": "uuid",
          "creator_id": "uuid",
          "contact_id": "uuid"
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 100,
      "totalPages": 5,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

---

### Search by Duration

Search tickets within a specific date range, selecting which date field to filter on.

**Endpoint:** `GET /api-tickets/search-duration`

**Permission Level:** 0 (All authenticated users)

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `startDate` | string | Yes | Start date (YYYY-MM-DD) |
| `endDate` | string | Yes | End date (YYYY-MM-DD) |
| `date_type` | string | No | Date field: `create`, `update`, or `appointed` (default: `create`) |
| `page` | number | No | Page number (default: 1) |
| `limit` | number | No | Items per page (default: 50, max: 100) |
| `include` | string | No | Response mode: `full` (default) or `minimal` |
| `sort` | string | No | Field to sort by |
| `order` | string | No | Sort direction: `asc` or `desc` (default: `desc`) |

**Description:**

Searches tickets within a specific date range. The date field used for filtering is configurable via `date_type` parameter:
- `create`: Filter by ticket creation date (created_at)
- `update`: Filter by last update date (updated_at)
- `appointed`: Filter by appointment date

Returns display-ready data with pre-resolved location names, employee details, and pre-formatted appointment strings.

**Response:** Same format as Search Tickets

---

### Get Ticket by ID

Retrieve a single ticket with all related data.

**Endpoint:** `GET /api-tickets/:id`

**Permission Level:** 0 (All authenticated users)

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Ticket UUID |

**Response:**

```json
{
  "data": {
    "id": "uuid",
    "ticket_code": "PDE-001",
    "ticket_number": 1,
    "site_name": "ABC Building",
    "company_name": "ABC Company",
    "work_type_name": "PM",
    "status_name": "In Progress",
    "assigner_name": "John Doe",
    "location": { ... },
    "appointment": { ... },
    "employees": [ ... ],
    "details": "...",
    "created_at": "...",
    "updated_at": "..."
  }
}
```

---

### Create Ticket

Create a new ticket with all related data (company, site, contact, appointment, employees, merchandise).

**Endpoint:** `POST /api-tickets`

**Permission Level:** 1 (Assigner and above)

**Headers:**

| Header | Description |
|--------|-------------|
| `Idempotency-Key` | Optional. Unique key to prevent duplicate submissions |

**Request Body:**

```json
{
  "ticket": {
    "details": "PM service for UPS system",
    "work_type_id": "uuid",
    "assigner_id": "uuid",
    "status_id": "uuid",
    "additional": "Additional notes",
    "work_giver_id": "uuid"
  },
  "summarize": true,
  "company": {
    "tax_id": "1234567890123",
    "name_th": "ABC Company",
    "name_en": "ABC Company Ltd."
  },
  "site": {
    "id": "uuid",
    "name": "ABC Building",
    "address_detail": "123 Main Street",
    "province_code": 10,
    "district_code": 1001,
    "subdistrict_code": 100101,
    "postal_code": 10200,
    "map_url": "https://maps.google.com/..."
  },
  "contact": {
    "id": "uuid",
    "person_name": "John Smith",
    "nickname": "John",
    "phone": ["0812345678"],
    "email": ["john@example.com"],
    "line_id": "john_line",
    "note": "Preferred morning contact"
  },
  "appointment": {
    "appointment_date": "2025-01-15",
    "appointment_time_start": "09:00:00",
    "appointment_time_end": "12:00:00",
    "appointment_type": "scheduled"
  },
  "employee_ids": [
    { "id": "uuid", "is_key": true },
    { "id": "uuid", "is_key": false }
  ],
  "merchandise_ids": ["uuid", "uuid"]
}
```

**Required Fields:**
- `ticket.work_type_id` - Work type UUID
- `ticket.assigner_id` - Assigner employee UUID
- `ticket.status_id` - Status UUID

**Appointment Types:**
- `call_to_schedule` - Needs to call customer to schedule
- `scheduled` - Time slot scheduled
- `backlog` - Backlog item

**Response (201 Created):**

```json
{
  "data": {
    "id": "uuid",
    "ticket_code": "PDE-123",
    "message": "Created successfully"
  }
}
```

---

### Update Ticket

Update an existing ticket and its related data.

**Endpoint:** `PUT /api-tickets/:id`

**Permission Level:** 1 (Assigner and above)

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Ticket UUID |

**Request Body:**

```json
{
  "ticket": {
    "details": "Updated details",
    "status_id": "new-status-uuid",
    "work_giver_id": null
  },
  "summarize": true,
  "site": {
    "id": "existing-site-uuid",
    "name": "Updated Site Name"
  },
  "contact": null,
  "appointment": {
    "appointment_date": "2025-01-20",
    "appointment_time_start": "14:00:00",
    "appointment_type": "scheduled"
  },
  "employee_ids": [
    { "id": "uuid", "is_key": true }
  ],
  "merchandise_ids": ["uuid"]
}
```

**Notes:**
- Set `contact: null` to unlink the contact
- Set `appointment: null` to unlink the appointment
- `employee_ids` replaces all existing assignments
- `merchandise_ids` replaces all existing links

**Response:**

```json
{
  "data": {
    "id": "uuid",
    "message": "Updated successfully"
  }
}
```

---

### Delete Ticket

Delete a ticket and optionally its related appointment and contact. This is a hard delete - the ticket and selected related data are permanently removed from the database.

**Endpoint:** `DELETE /api-tickets/:id`

**Permission Level:** 1 (Assigner and above)

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Ticket UUID |

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `delete_appointment` | boolean | Also delete the linked appointment (default: false) |
| `delete_contact` | boolean | Also delete the linked contact (default: false) |

**Description:**

Deletes a ticket and cleans up all directly related data:
- Always deleted: employee assignments, watchers, attachments, comments
- Optional: appointment (when `delete_appointment=true`)
- Optional: contact (when `delete_contact=true`)

**Response:**

```json
{
  "data": {
    "message": "ลบตั๋วงานสำเร็จ"
  }
}
```

---

## Comments

### Get Comments

Get all comments for a ticket with pagination.

**Endpoint:** `GET /api-tickets/:id/comments`

**Permission Level:** 0 (All authenticated users)

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Ticket UUID |

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | number | Page number (default: 1) |
| `limit` | number | Items per page (default: 50) |

**Response:**

```json
{
  "data": {
    "data": [
      {
        "id": "uuid",
        "ticket_id": "uuid",
        "author_id": "uuid",
        "content": "Comment text with @[uuid] mention",
        "mentioned_employee_ids": ["uuid"],
        "is_edited": false,
        "created_at": "2025-01-01T00:00:00Z",
        "updated_at": "2025-01-01T00:00:00Z",
        "author": {
          "id": "uuid",
          "name": "John Doe",
          "code": "EMP001",
          "nickname": "John",
          "profile_image_url": "https://..."
        },
        "photos": [
          {
            "id": "uuid",
            "image_url": "https://...",
            "display_order": 0,
            "created_at": "..."
          }
        ],
        "files": [
          {
            "id": "uuid",
            "file_url": "https://...",
            "file_name": "document.pdf",
            "file_size": 1024,
            "mime_type": "application/pdf",
            "created_at": "..."
          }
        ]
      }
    ],
    "pagination": { ... }
  }
}
```

---

### Create Comment

Add a new comment to a ticket. Supports @mentions and file attachments.

**Endpoint:** `POST /api-tickets/:id/comments`

**Permission Level:** 0 (All authenticated users)

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Ticket UUID |

**Request Body:**

```json
{
  "content": "This is a comment mentioning @[uuid] and @employee_code",
  "photos": [
    {
      "image_url": "https://storage.example.com/photo.jpg",
      "display_order": 0
    }
  ],
  "files": [
    {
      "file_url": "https://storage.example.com/doc.pdf",
      "file_name": "document.pdf",
      "file_size": 1024,
      "mime_type": "application/pdf"
    }
  ]
}
```

**Mention Formats:**
- `@[uuid]` - Mention by employee UUID
- `@employee_code` - Mention by employee code

**Response (201 Created):**

```json
{
  "data": {
    "id": "uuid",
    "ticket_id": "uuid",
    "content": "...",
    "author": { ... },
    "photos": [ ... ],
    "files": [ ... ]
  }
}
```

---

### Update Comment

Update a comment. Only the original author can update their comment.

**Endpoint:** `PUT /api-tickets/:ticketId/comments/:commentId`

**Permission Level:** 0 (Author only)

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `ticketId` | string | Ticket UUID |
| `commentId` | string | Comment UUID |

**Request Body:**

```json
{
  "content": "Updated comment text",
  "photos": [...],
  "files": [...]
}
```

**Note:** Providing `photos` or `files` replaces all existing attachments.

**Response:**

```json
{
  "data": {
    "id": "uuid",
    "content": "Updated comment text",
    "is_edited": true,
    ...
  }
}
```

---

### Delete Comment

Delete a comment. Only the author or admin can delete.

**Endpoint:** `DELETE /api-tickets/:ticketId/comments/:commentId`

**Permission Level:** 0 (Author or Admin Level 2+)

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `ticketId` | string | Ticket UUID |
| `commentId` | string | Comment UUID |

**Response:**

```json
{
  "data": {
    "message": "Comment deleted successfully"
  }
}
```

---

## Watchers

### Get Watchers

Get all watchers for a ticket and check if current user is watching.

**Endpoint:** `GET /api-tickets/:id/watchers`

**Permission Level:** 0 (All authenticated users)

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Ticket UUID |

**Response:**

```json
{
  "data": {
    "watchers": [
      {
        "employee_id": "uuid",
        "employee_name": "John Doe",
        ...
      }
    ],
    "is_watching": true
  }
}
```

---

### Add Watch

Add the current user as a watcher on a ticket.

**Endpoint:** `POST /api-tickets/:id/watch`

**Permission Level:** 0 (All authenticated users)

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Ticket UUID |

**Response (201 Created):**

```json
{
  "data": {
    "message": "Now watching ticket"
  }
}
```

---

### Remove Watch

Remove the current user from watchers.

**Endpoint:** `DELETE /api-tickets/:id/watch`

**Permission Level:** 0 (All authenticated users)

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Ticket UUID |

**Response:**

```json
{
  "data": {
    "message": "Stopped watching ticket"
  }
}
```

---

## Attachments

### Get Attachments

Get all photos and files attached to a ticket.

**Endpoint:** `GET /api-tickets/:id/attachments`

**Permission Level:** 0 (All authenticated users)

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Ticket UUID |

**Response:**

```json
{
  "data": {
    "photos": [
      {
        "id": "uuid",
        "ticket_id": "uuid",
        "uploaded_by": "uuid",
        "image_url": "https://...",
        "caption": "Photo caption",
        "display_order": 0,
        "created_at": "...",
        "uploader": {
          "id": "uuid",
          "name": "John Doe",
          "code": "EMP001",
          "nickname": "John",
          "profile_image_url": "..."
        }
      }
    ],
    "files": [
      {
        "id": "uuid",
        "ticket_id": "uuid",
        "uploaded_by": "uuid",
        "file_url": "https://...",
        "file_name": "document.pdf",
        "file_size": 1024,
        "mime_type": "application/pdf",
        "created_at": "...",
        "uploader": { ... }
      }
    ]
  }
}
```

---

### Add Attachments

Add photos and/or files to a ticket.

**Endpoint:** `POST /api-tickets/:id/attachments`

**Permission Level:** 0 (All authenticated users)

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Ticket UUID |

**Request Body:**

```json
{
  "photos": [
    {
      "image_url": "https://storage.example.com/image.jpg",
      "caption": "Photo caption",
      "display_order": 0
    }
  ],
  "files": [
    {
      "file_url": "https://storage.example.com/doc.pdf",
      "file_name": "document.pdf",
      "file_size": 1024,
      "mime_type": "application/pdf"
    }
  ]
}
```

**Note:** At least one photo or file is required.

**Response (201 Created):**

```json
{
  "data": {
    "photos": [ ... ],
    "files": [ ... ]
  }
}
```

---

### Delete Attachment

Delete a photo or file attachment.

**Endpoint:** `DELETE /api-tickets/:ticketId/attachments/:attachmentId`

**Permission Level:** 0 (Uploader or Admin Level 2+)

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `ticketId` | string | Ticket UUID |
| `attachmentId` | string | Attachment UUID |

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `type` | string | Yes | `photo` or `file` |

**Response:**

```json
{
  "data": {
    "message": "Attachment deleted successfully"
  }
}
```

---

## Ratings

### Get Rating

Get the customer rating for a ticket.

**Endpoint:** `GET /api-tickets/:id/rating`

**Permission Level:** 0 (All authenticated users)

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Ticket UUID |

**Response:**

```json
{
  "data": {
    "rating": {
      "id": "uuid",
      "ticketId": "uuid",
      "serviceQualityRating": 5,
      "responseTimeRating": 4,
      "professionalismRating": 5,
      "averageRating": 4.67,
      "customerComment": "Great service!",
      "callNotes": "Customer was satisfied",
      "ratedAt": "2025-01-01T00:00:00Z",
      "ratedBy": {
        "id": "uuid",
        "code": "EMP001",
        "name": "John Doe",
        "nickname": "John"
      },
      "createdAt": "...",
      "updatedAt": "..."
    },
    "hasRating": true
  }
}
```

---

### Create Rating

Create a rating for a ticket.

**Endpoint:** `POST /api-tickets/:id/rating`

**Permission Level:** 1 (Assigner and above)

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Ticket UUID |

**Request Body:**

```json
{
  "serviceQualityRating": 5,
  "responseTimeRating": 4,
  "professionalismRating": 5,
  "customerComment": "Great service!",
  "callNotes": "Called customer on 2025-01-01"
}
```

**Rating Values:** 1-5 (integers only)

**Response (201 Created):**

```json
{
  "data": {
    "rating": { ... }
  }
}
```

---

### Update Rating

Update an existing rating.

**Endpoint:** `PUT /api-tickets/:id/rating`

**Permission Level:** 1 (Assigner and above)

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Ticket UUID |

**Request Body:** Same as Create Rating

**Response:**

```json
{
  "data": {
    "rating": { ... }
  }
}
```

---

### Delete Rating

Delete a ticket's rating.

**Endpoint:** `DELETE /api-tickets/:id/rating`

**Permission Level:** 2 (Admin and above)

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Ticket UUID |

**Response:**

```json
{
  "data": {
    "message": "Rating deleted successfully"
  }
}
```

---

## Technician Confirmations

### Confirm Technicians

Confirm which technicians will work on a ticket. This is separate from initial assignment and represents the final approved technician list for scheduling.

**Endpoint:** `POST /api-tickets/:id/confirm-technicians`

**Permission Level:** Appointment Approver (users with appointment approval permission)

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Ticket UUID |

**Request Body:**

```json
{
  "employee_ids": [
    { "id": "uuid", "is_key": true },
    { "id": "uuid", "is_key": false }
  ],
  "notes": "Confirmation notes"
}
```

**Alternative Format (simple string array):**

```json
{
  "employee_ids": ["uuid", "uuid"],
  "notes": "Confirmation notes"
}
```

**Fields:**
- `employee_ids` - Required. Array of employee UUIDs or objects with `id` and optional `is_key` flag
- `notes` - Optional. Notes for the confirmation
- `is_key` - When true, indicates the primary/lead technician for the job

**Response (201 Created):**

```json
{
  "data": [
    {
      "id": "uuid",
      "ticket_id": "uuid",
      "employee_id": "uuid",
      "confirmed_by": "uuid",
      "confirmed_at": "...",
      "date": "2025-01-15",
      "notes": "...",
      "employee": {
        "id": "uuid",
        "name": "Technician A",
        "code": "TECH001"
      },
      "confirmed_by_employee": {
        "id": "uuid",
        "name": "Manager",
        "code": "MGR001"
      }
    }
  ]
}
```

---

### Get Confirmed Technicians

Get the list of confirmed technicians for a ticket.

**Endpoint:** `GET /api-tickets/:id/confirmed-technicians`

**Permission Level:** 0 (All authenticated users)

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Ticket UUID |

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `date` | string | Filter by date (YYYY-MM-DD) |

**Response:**

```json
{
  "data": [
    {
      "id": "uuid",
      "ticket_id": "uuid",
      "employee_id": "uuid",
      "confirmed_at": "...",
      "date": "2025-01-15",
      "employee": {
        "id": "uuid",
        "name": "Technician A",
        "code": "TECH001",
        "profile_image_url": "..."
      },
      "confirmed_by_employee": { ... }
    }
  ]
}
```

---

### Get Summaries

Get daily summaries grouped by technician teams. Useful for LINE messaging or daily dispatch reports.

**Endpoint:** `GET /api-tickets/summaries`

**Permission Level:** 0 (All authenticated users)

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `date` | string | Yes | Date to get summaries for (YYYY-MM-DD) |
| `format` | string | No | `full` (default) or `compact` |

**Description:**

Returns ticket summaries for a specific date, grouped by assigned technician. Each technician group contains:
- Technician details (name, code, contact info)
- List of assigned tickets for the date
- Ticket count and status breakdown

**Response:**

```json
{
  "data": {
    "date": "2025-01-15",
    "date_display": "Wednesday, January 15, 2568",
    "team_count": 3,
    "groups": [
      {
        "team_number": 1,
        "technician_ids": ["uuid", "uuid"],
        "technicians": [
          { "id": "uuid", "name": "Tech A", "code": "T001" },
          { "id": "uuid", "name": "Tech B", "code": "T002" }
        ],
        "technician_display": "Tech A + Tech B",
        "tickets": [
          {
            "ticket_id": "uuid",
            "summary": "-PDE - ABC Company - Contact 081-234-5678 - PM\nService UPS system\nLocation: ABC Building, Bangkok",
            "appointment_time": "09:00-12:00",
            "appointment_type": "Scheduled",
            "site_name": "ABC Building",
            "company_name": "ABC Company"
          }
        ]
      }
    ],
    "full_summary": "Wednesday, January 15, 2568 (3 teams total)\n\n1. Tech A + Tech B\n-PDE - ABC Company..."
  }
}
```

---

## Employee Assignments

### Remove Employee Assignment

Remove a technician from a ticket assignment. This is an admin-only operation used to correct scheduling mistakes or reassign work.

**Endpoint:** `DELETE /api-tickets/employees`

**Permission Level:** 2 (Admin and above)

**Request Body:**

```json
{
  "ticket_id": "uuid",
  "employee_id": "uuid",
  "date": "2025-01-15"
}
```

**Fields:**
- `ticket_id` - Required. Ticket UUID
- `employee_id` - Required. Employee UUID to remove
- `date` - Required. Assignment date (YYYY-MM-DD)

**Note:** This endpoint uses DELETE method but accepts a body with the assignment details to identify the specific record to remove.

**Response:**

```json
{
  "data": {
    "message": "ลบการมอบหมายพนักงานสำเร็จ"
  }
}
```

---

## Audit Logs

### Get Ticket Audit Logs

Get audit history for a specific ticket. Tracks all changes including status changes, field updates, employee assignments, comments, and attachments.

**Endpoint:** `GET /api-tickets/:id/audit`

**Permission Level:** 0 (All authenticated users)

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Ticket UUID |

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | number | Page number (default: 1) |
| `limit` | number | Items per page (default: 50, max: 100) |

**Description:**

Each audit log entry includes: action, old_value, new_value, changed_by, and timestamp.

**Response:**

```json
{
  "data": {
    "data": [
      {
        "id": "uuid",
        "ticket_id": "uuid",
        "action": "status_changed",
        "changed_by": "uuid",
        "old_values": { "status_id": "old-uuid" },
        "new_values": { "status_id": "new-uuid" },
        "metadata": { ... },
        "created_at": "..."
      }
    ],
    "pagination": { ... }
  }
}
```

**Audit Actions:**
- `created` - Ticket created
- `updated` - Ticket fields updated
- `status_changed` - Status changed
- `comment_added` - Comment added
- `technician_confirmed` - Technicians confirmed
- `employee_assigned` - Employee assigned
- `employee_removed` - Employee removed

---

### Get Recent Audit Logs

Get recent audit logs across all tickets (admin dashboard).

**Endpoint:** `GET /api-tickets/audit`

**Permission Level:** 2 (Admin and above)

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | number | Page number (default: 1) |
| `limit` | number | Items per page (default: 50, max: 100) |

**Response:** Same format as Get Ticket Audit Logs

---

## Backfill Summaries

### Start Backfill Job

Start a background job to generate AI summaries for tickets. Operates as a background job to avoid timeout issues when processing many tickets.

**Endpoint:** `POST /api-tickets/backfill-summaries`

**Permission Level:** 2 (Admin and above)

**Request Body:**

```json
{
  "limit": 50,
  "forceRefresh": false,
  "ticketIds": ["uuid", "PDE-123"]
}
```

**Parameters:**
- `limit` - Maximum tickets to process (default: 50, max: 500)
- `forceRefresh` - Regenerate even if summary exists (default: false)
- `ticketIds` - Specific ticket IDs or codes (supports UUID or PDE-XXX format)

**Description:**

The AI summary is generated from comprehensive ticket data including:
- Ticket details and work type
- Site and company information
- Contact details
- Appointment schedule
- Assigned and confirmed technicians
- Merchandise/equipment details

**Response:**

```json
{
  "data": {
    "message": "Processing 50 tickets in background",
    "job_id": "uuid",
    "total": 50,
    "status_url": "/api-tickets/backfill-summaries?job_id=uuid"
  }
}
```

---

### Check Backfill Status

Check the status of a backfill job.

**Endpoint:** `GET /api-tickets/backfill-summaries`

**Permission Level:** 2 (Admin and above)

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `job_id` | string | Yes | Job UUID |

**Response:**

```json
{
  "data": {
    "job_id": "uuid",
    "status": "running",
    "started_at": "2025-01-01T00:00:00Z",
    "completed_at": null,
    "total": 50,
    "processed": 25,
    "succeeded": 23,
    "failed": 2,
    "skipped": 0,
    "errors": [
      "ticket-uuid-1: Error message",
      "ticket-uuid-2: Error message"
    ]
  }
}
```

**Job Statuses:**
- `running` - Job is in progress
- `completed` - Job finished

---

## Extra Fields

Extra fields allow dynamic, schema-less key-value data to be attached to tickets without database schema changes.

### Get Extra Fields

Get all extra fields for a ticket.

**Endpoint:** `GET /api-tickets/:id/extra-fields`

**Permission Level:** 0 (All authenticated users)

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Ticket UUID |

**Response:**

```json
{
  "data": [
    {
      "id": "uuid",
      "ticket_id": "uuid",
      "field_key": "custom_field_1",
      "field_value": "Custom value",
      "created_by": "uuid",
      "created_at": "2025-01-01T00:00:00Z",
      "updated_at": "2025-01-01T00:00:00Z"
    }
  ]
}
```

---

### Create Extra Field

Create a single extra field for a ticket.

**Endpoint:** `POST /api-tickets/:id/extra-fields`

**Permission Level:** 0 (All authenticated users)

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Ticket UUID |

**Request Body:**

```json
{
  "field_key": "custom_field_name",
  "field_value": "Custom value"
}
```

**Constraints:**
- `field_key` max length: 100 characters
- `field_key` must be unique per ticket
- `field_value` can be null (for flag-type fields)

**Response (201 Created):**

```json
{
  "data": {
    "id": "uuid",
    "ticket_id": "uuid",
    "field_key": "custom_field_name",
    "field_value": "Custom value",
    "created_by": "uuid",
    "created_at": "...",
    "updated_at": "..."
  }
}
```

---

### Update Extra Field

Update an existing extra field.

**Endpoint:** `PUT /api-tickets/:ticketId/extra-fields/:fieldId`

**Permission Level:** 0 (All authenticated users)

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `ticketId` | string | Ticket UUID |
| `fieldId` | string | Extra field UUID |

**Request Body:**

```json
{
  "field_key": "updated_key",
  "field_value": "Updated value"
}
```

**Response:**

```json
{
  "data": {
    "id": "uuid",
    "field_key": "updated_key",
    "field_value": "Updated value",
    "updated_at": "..."
  }
}
```

---

### Delete Extra Field

Delete an extra field.

**Endpoint:** `DELETE /api-tickets/:ticketId/extra-fields/:fieldId`

**Permission Level:** 0 (All authenticated users)

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `ticketId` | string | Ticket UUID |
| `fieldId` | string | Extra field UUID |

**Response:**

```json
{
  "data": {
    "message": "ลบ extra field สำเร็จ"
  }
}
```

---

### Bulk Upsert Extra Fields

Create or update multiple extra fields at once. Existing fields are updated based on `field_key`, new fields are created.

**Endpoint:** `POST /api-tickets/:id/extra-fields/bulk`

**Permission Level:** 0 (All authenticated users)

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Ticket UUID |

**Request Body:**

```json
{
  "fields": [
    { "field_key": "field_1", "field_value": "Value 1" },
    { "field_key": "field_2", "field_value": "Value 2" },
    { "field_key": "field_3", "field_value": null }
  ]
}
```

**Response:**

```json
{
  "data": [
    {
      "id": "uuid",
      "ticket_id": "uuid",
      "field_key": "field_1",
      "field_value": "Value 1",
      "created_by": "uuid",
      "created_at": "...",
      "updated_at": "..."
    },
    ...
  ]
}
```

---

## Utility

### Warmup

Keep the Edge Function warm to reduce cold start latency. This endpoint does not require authentication.

**Endpoint:** `GET /api-tickets/warmup`

**Permission Level:** None (public endpoint)

**Response:**

```json
{
  "status": "warm",
  "timestamp": "2025-01-15T10:30:00.000Z"
}
```

**Description:**

This endpoint is used by scheduled jobs or monitoring systems to keep the Edge Function warm and reduce response latency for subsequent requests.

---

## Error Responses

All endpoints return errors in the following format:

```json
{
  "error": "Error message in Thai"
}
```

**HTTP Status Codes:**

| Code | Description |
|------|-------------|
| 400 | Bad Request - Invalid input |
| 401 | Unauthorized - Invalid or missing token |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource not found |
| 409 | Conflict - Duplicate or conflict |
| 500 | Internal Server Error |

**Common Error Messages (Thai):**

| Message | Meaning |
|---------|---------|
| `ไม่พบตั๋วงาน` | Ticket not found |
| `ไม่พบตั๋วงานที่ระบุ` | Specified ticket not found |
| `ไม่มีสิทธิ์เข้าถึง` | Access denied |
| `ข้อมูล JSON ไม่ถูกต้อง` | Invalid JSON data |
| `กรุณาระบุข้อมูลตั๋วงาน` | Please provide ticket data |
| `กรุณาระบุประเภทงาน` | Please specify work type |
| `กรุณาระบุผู้มอบหมายงาน` | Please specify assigner |
| `กรุณาระบุสถานะตั๋วงาน` | Please specify ticket status |
| `ไม่มีสิทธิ์แก้ไขความคิดเห็นนี้` | Cannot edit this comment |
| `ไม่มีสิทธิ์ลบความคิดเห็นนี้` | Cannot delete this comment |
| `กรุณาระบุวันที่ (date parameter)` | Please specify date parameter |
| `รูปแบบวันที่ไม่ถูกต้อง ต้องเป็น YYYY-MM-DD` | Invalid date format, must be YYYY-MM-DD |
| `กรุณาระบุ startDate` | Please specify startDate |
| `กรุณาระบุ endDate` | Please specify endDate |
| `date_type ต้องเป็น create, update, หรือ appointed` | date_type must be create, update, or appointed |
| `กรุณาระบุช่างอย่างน้อย 1 คน` | Please specify at least 1 technician |
| `ลบ extra field สำเร็จ` | Extra field deleted successfully |
| `ลบตั๋วงานสำเร็จ` | Ticket deleted successfully |
| `ลบการมอบหมายพนักงานสำเร็จ` | Employee assignment removed successfully |

---

## Rate Limiting

Currently no explicit rate limiting is enforced. However, please use pagination appropriately for large result sets.

---

## Idempotency

For ticket creation (`POST /api-tickets`), you can provide an `Idempotency-Key` header to prevent duplicate submissions from network retries or user double-clicks.

```
Idempotency-Key: unique-request-id-12345
```

**Behavior:**
- When an `Idempotency-Key` header is provided, duplicate requests with the same key will return the cached response instead of creating duplicate tickets
- Cached responses include both success and error states
- Use unique keys per request (e.g., UUID or timestamp-based)
- Recommended for critical operations to prevent duplicate ticket creation
