# API Staging

## Overview

The Staging API manages file uploads from LINE messaging integration, providing a staging and approval workflow before files are linked to tickets. This enables technicians to send images and files via LINE, which are then reviewed by administrators before being attached as ticket comments.

**File Workflow:**
1. Technician sends image/file via LINE
2. n8n webhook creates staged file (service_role auth)
3. File is linked to a specific ticket
4. Admin reviews and approves/rejects (JWT auth)
5. Approved files are attached to ticket comments

This API supports two authentication modes:
- **Service role (n8n)**: For automated file creation and ticket lookup
- **JWT (web app)**: For file approval/rejection workflow

---

## Base URL

```
/api-staging
```

---

## Authentication

### JWT Authentication (Web App)
Most endpoints require a valid JWT token in the Authorization header.

```
Authorization: Bearer <jwt_token>
```

**Required Permissions:**
- File management endpoints: `canApproveAppointments` permission
- LINE account endpoints: Level 2 (Admin) or higher

### Service Role Authentication (n8n)
Automated endpoints use the Supabase service role key.

```
Authorization: Bearer <service_role_key>
```

---

## File Statuses

| Status | Description | Allowed Actions |
|--------|-------------|-----------------|
| `pending` | File uploaded, not yet linked to ticket | Link to ticket, Delete |
| `linked` | File linked to ticket, awaiting approval | Approve, Reject, Delete |
| `approved` | File approved and attached to ticket comment | None |
| `rejected` | File rejected by admin | Delete |
| `expired` | File expired without action | Delete |

---

## Endpoints Summary

### n8n Integration (service_role auth)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/files` | Create staged file |
| PUT | `/files/:id/link` | Link file to ticket |
| GET | `/tickets/carousel` | Get tickets for LINE carousel |
| GET | `/tickets/by-code/:code` | Get ticket by code |
| GET | `/employee/:lineUserId` | Get employee by LINE user ID |

### File Management (JWT auth, canApproveAppointments)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/files` | List staged files |
| GET | `/files/grouped` | List files grouped by ticket |
| GET | `/files/:id` | Get single staged file |
| POST | `/files/:id/approve` | Approve file |
| POST | `/files/:id/reject` | Reject file |
| POST | `/files/bulk-approve` | Bulk approve files |
| POST | `/files/bulk-delete` | Bulk delete files |
| DELETE | `/files/:id` | Delete staged file |

### LINE Account Management (admin)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/line-accounts` | List LINE accounts |
| POST | `/line-accounts` | Create LINE account |
| PUT | `/line-accounts/:id` | Update LINE account |
| DELETE | `/line-accounts/:id` | Delete LINE account |

---

## Endpoints

### 1. Create Staged File

Create a new staged file from LINE. Called by n8n workflow.

**Request**

```
POST /api-staging/files
```

**Auth:** Service role

**Request Body**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `line_user_id` | string | Yes | LINE user ID of the sender |
| `file_url` | string | Yes | URL of the uploaded file |
| `file_name` | string | Yes | Name of the file |
| `file_size` | number | No | File size in bytes |
| `mime_type` | string | No | MIME type (e.g., "image/jpeg") |
| `source` | string | No | Source of upload (default: "line") |
| `metadata` | object | No | Additional metadata |

**Request Body Example**

```json
{
  "line_user_id": "U1234567890abcdef",
  "file_url": "https://storage.example.com/files/photo.jpg",
  "file_name": "site-photo.jpg",
  "file_size": 245678,
  "mime_type": "image/jpeg",
  "source": "line"
}
```

**Response**

```json
{
  "data": {
    "id": "uuid",
    "employee_id": "uuid",
    "file_url": "https://storage.example.com/files/photo.jpg",
    "file_name": "site-photo.jpg",
    "file_size": 245678,
    "mime_type": "image/jpeg",
    "ticket_id": null,
    "status": "pending",
    "approved_by": null,
    "approved_at": null,
    "rejection_reason": null,
    "result_comment_id": null,
    "expires_at": "2024-01-22T10:30:00Z",
    "source": "line",
    "metadata": {},
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T10:30:00Z",
    "employee": {
      "id": "uuid",
      "name": "สมชาย ใจดี",
      "code": "EMP001",
      "nickname": "ชาย",
      "profile_image_url": "https://..."
    }
  }
}
```

---

### 2. Link File to Ticket

Link a pending staged file to a specific ticket.

**Request**

```
PUT /api-staging/files/:id/link
```

**Auth:** Service role

**Path Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | uuid | Staged file ID |

**Request Body**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `ticket_id` | uuid | Yes | Ticket ID to link the file to |

**Request Body Example**

```json
{
  "ticket_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response**

```json
{
  "data": {
    "id": "uuid",
    "employee_id": "uuid",
    "file_url": "https://storage.example.com/files/photo.jpg",
    "file_name": "site-photo.jpg",
    "file_size": 245678,
    "mime_type": "image/jpeg",
    "ticket_id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "linked",
    "approved_by": null,
    "approved_at": null,
    "rejection_reason": null,
    "result_comment_id": null,
    "expires_at": "2024-01-22T10:30:00Z",
    "source": "line",
    "metadata": {},
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T10:35:00Z",
    "employee": {
      "id": "uuid",
      "name": "สมชาย ใจดี",
      "code": "EMP001",
      "nickname": "ชาย",
      "profile_image_url": "https://..."
    },
    "ticket": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "ticket_code": "TK-2024-00001",
      "work_type": {
        "code": "pm",
        "name": "บำรุงรักษา"
      }
    }
  }
}
```

---

### 3. Get Tickets for LINE Carousel

Get active tickets assigned to an employee for LINE flex message carousel display.

**Request**

```
GET /api-staging/tickets/carousel
```

**Auth:** Service role

**Query Parameters**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `line_user_id` | string | Yes | - | LINE user ID |
| `limit` | integer | No | 10 | Maximum number of tickets |

**Response**

```json
{
  "data": {
    "tickets": [
      {
        "id": "uuid",
        "ticket_code": "TK-2024-00001",
        "site_name": "บริษัท ABC จำกัด",
        "work_type_name": "บำรุงรักษา",
        "status_name": "กำลังดำเนินการ",
        "appointment_date": "2024-01-20"
      },
      {
        "id": "uuid",
        "ticket_code": "TK-2024-00002",
        "site_name": "ร้าน XYZ",
        "work_type_name": "ซ่อมแซม",
        "status_name": "รอดำเนินการ",
        "appointment_date": null
      }
    ],
    "count": 2
  }
}
```

**Example Request**

```bash
curl -X GET "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-staging/tickets/carousel?line_user_id=U1234567890abcdef&limit=5" \
  -H "Authorization: Bearer <service_role_key>"
```

---

### 4. Get Ticket by Code

Verify a ticket exists by its code. Used for LINE conversation flow.

**Request**

```
GET /api-staging/tickets/by-code/:code
```

**Auth:** Service role

**Path Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `code` | string | Ticket code (e.g., "TK-2024-00001") |

**Response**

```json
{
  "data": {
    "found": true,
    "ticket": {
      "id": "uuid",
      "ticket_code": "TK-2024-00001",
      "site_name": "บริษัท ABC จำกัด",
      "work_type_name": "บำรุงรักษา",
      "status_name": "กำลังดำเนินการ",
      "appointment_date": "2024-01-20"
    }
  }
}
```

**Response (Not Found)**

```json
{
  "data": {
    "found": false,
    "ticket": null
  }
}
```

---

### 5. Get Employee by LINE User ID

Get employee information from LINE user ID.

**Request**

```
GET /api-staging/employee/:lineUserId
```

**Auth:** Service role

**Path Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `lineUserId` | string | LINE user ID |

**Response**

```json
{
  "data": {
    "employee_id": "uuid",
    "display_name": "สมชาย ใจดี"
  }
}
```

---

### 6. List Staged Files

List staged files with optional filters and pagination.

**Request**

```
GET /api-staging/files
```

**Auth:** JWT (canApproveAppointments)

**Query Parameters**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `page` | integer | No | 1 | Page number |
| `limit` | integer | No | 50 | Items per page (1-100) |
| `status` | string | No | - | Filter by status (comma-separated for multiple) |
| `employee_id` | uuid | No | - | Filter by employee |
| `ticket_id` | uuid | No | - | Filter by ticket |

**Response**

```json
{
  "data": {
    "data": [
      {
        "id": "uuid",
        "employee_id": "uuid",
        "file_url": "https://storage.example.com/files/photo.jpg",
        "file_name": "site-photo.jpg",
        "file_size": 245678,
        "mime_type": "image/jpeg",
        "ticket_id": "uuid",
        "status": "linked",
        "approved_by": null,
        "approved_at": null,
        "rejection_reason": null,
        "result_comment_id": null,
        "expires_at": "2024-01-22T10:30:00Z",
        "source": "line",
        "metadata": {},
        "created_at": "2024-01-15T10:30:00Z",
        "updated_at": "2024-01-15T10:35:00Z",
        "employee": {
          "id": "uuid",
          "name": "สมชาย ใจดี",
          "code": "EMP001",
          "nickname": "ชาย",
          "profile_image_url": "https://..."
        },
        "ticket": {
          "id": "uuid",
          "ticket_code": "TK-2024-00001",
          "work_type": {
            "code": "pm",
            "name": "บำรุงรักษา"
          }
        },
        "approver": null
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 25,
      "totalPages": 1
    }
  }
}
```

**Example Requests**

```bash
# Get all linked files
curl -X GET "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-staging/files?status=linked" \
  -H "Authorization: Bearer <token>"

# Get pending and linked files
curl -X GET "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-staging/files?status=pending,linked" \
  -H "Authorization: Bearer <token>"

# Get files for specific employee
curl -X GET "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-staging/files?employee_id=uuid&status=linked" \
  -H "Authorization: Bearer <token>"
```

---

### 7. List Files Grouped by Ticket

List staged files grouped by their associated ticket. Useful for approval workflows.

**Request**

```
GET /api-staging/files/grouped
```

**Auth:** JWT (canApproveAppointments)

**Query Parameters**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `status` | string | No | - | Filter by status (comma-separated for multiple) |
| `employee_id` | uuid | No | - | Filter by employee |

**Response**

```json
{
  "data": {
    "groups": [
      {
        "ticket": {
          "id": "uuid",
          "ticket_code": "TK-2024-00001",
          "work_type": {
            "code": "pm",
            "name": "บำรุงรักษา"
          }
        },
        "files": [
          {
            "id": "uuid",
            "employee_id": "uuid",
            "file_url": "https://...",
            "file_name": "photo1.jpg",
            "status": "linked",
            "employee": { "id": "uuid", "name": "สมชาย ใจดี", "code": "EMP001" }
          },
          {
            "id": "uuid",
            "employee_id": "uuid",
            "file_url": "https://...",
            "file_name": "photo2.jpg",
            "status": "linked",
            "employee": { "id": "uuid", "name": "สมชาย ใจดี", "code": "EMP001" }
          }
        ],
        "file_count": 2
      },
      {
        "ticket": null,
        "files": [
          {
            "id": "uuid",
            "file_name": "unlinked-photo.jpg",
            "status": "pending"
          }
        ],
        "file_count": 1
      }
    ],
    "summary": {
      "total_files": 3,
      "total_groups": 2,
      "by_status": {
        "pending": 1,
        "linked": 2,
        "approved": 0,
        "rejected": 0,
        "expired": 0
      }
    }
  }
}
```

---

### 8. Get Single Staged File

Get details of a single staged file by ID.

**Request**

```
GET /api-staging/files/:id
```

**Auth:** JWT (authenticated user)

**Path Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | uuid | Staged file ID |

**Response**

```json
{
  "data": {
    "id": "uuid",
    "employee_id": "uuid",
    "file_url": "https://storage.example.com/files/photo.jpg",
    "file_name": "site-photo.jpg",
    "file_size": 245678,
    "mime_type": "image/jpeg",
    "ticket_id": "uuid",
    "status": "linked",
    "approved_by": null,
    "approved_at": null,
    "rejection_reason": null,
    "result_comment_id": null,
    "expires_at": "2024-01-22T10:30:00Z",
    "source": "line",
    "metadata": {},
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T10:35:00Z",
    "employee": {
      "id": "uuid",
      "name": "สมชาย ใจดี",
      "code": "EMP001",
      "nickname": "ชาย",
      "profile_image_url": "https://..."
    },
    "ticket": {
      "id": "uuid",
      "ticket_code": "TK-2024-00001",
      "work_type": {
        "code": "pm",
        "name": "บำรุงรักษา"
      }
    },
    "approver": null
  }
}
```

---

### 9. Approve File

Approve a linked file and create a comment on the associated ticket.

**Request**

```
POST /api-staging/files/:id/approve
```

**Auth:** JWT (canApproveAppointments)

**Path Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | uuid | Staged file ID |

**Request Body**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `comment_content` | string | No | Custom comment text (default: auto-generated) |

**Request Body Example**

```json
{
  "comment_content": "รูปภาพการติดตั้งอุปกรณ์"
}
```

**Response**

```json
{
  "data": {
    "id": "uuid",
    "employee_id": "uuid",
    "file_url": "https://storage.example.com/files/photo.jpg",
    "file_name": "site-photo.jpg",
    "file_size": 245678,
    "mime_type": "image/jpeg",
    "ticket_id": "uuid",
    "status": "approved",
    "approved_by": "uuid",
    "approved_at": "2024-01-15T11:00:00Z",
    "rejection_reason": null,
    "result_comment_id": "uuid",
    "expires_at": "2024-01-22T10:30:00Z",
    "source": "line",
    "metadata": {},
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T11:00:00Z",
    "employee": { ... },
    "ticket": { ... },
    "approver": {
      "id": "uuid",
      "name": "ผู้จัดการ สมศรี",
      "code": "MGR001",
      "nickname": "ศรี",
      "profile_image_url": "https://..."
    }
  }
}
```

**Note:** Upon approval:
- A comment is created on the ticket
- Images are attached as photos (`child_comment_photos`)
- Other files are attached as files (`child_comment_files`)

---

### 10. Reject File

Reject a linked file with a reason.

**Request**

```
POST /api-staging/files/:id/reject
```

**Auth:** JWT (canApproveAppointments)

**Path Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | uuid | Staged file ID |

**Request Body**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `reason` | string | Yes | Rejection reason |

**Request Body Example**

```json
{
  "reason": "รูปภาพไม่ชัดเจน กรุณาถ่ายใหม่"
}
```

**Response**

```json
{
  "data": {
    "id": "uuid",
    "status": "rejected",
    "approved_by": "uuid",
    "approved_at": "2024-01-15T11:00:00Z",
    "rejection_reason": "รูปภาพไม่ชัดเจน กรุณาถ่ายใหม่",
    ...
  }
}
```

---

### 11. Bulk Approve Files

Approve multiple files at once. Files are grouped by ticket, and one comment is created per ticket with all attached files.

**Request**

```
POST /api-staging/files/bulk-approve
```

**Auth:** JWT (canApproveAppointments)

**Request Body**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file_ids` | uuid[] | Yes | Array of file IDs to approve |
| `comment_content` | string | No | Custom comment text for all files |

**Request Body Example**

```json
{
  "file_ids": [
    "550e8400-e29b-41d4-a716-446655440000",
    "550e8400-e29b-41d4-a716-446655440001",
    "550e8400-e29b-41d4-a716-446655440002"
  ],
  "comment_content": "ไฟล์แนบจากช่างเทคนิค"
}
```

**Response**

```json
{
  "data": {
    "approved": [
      "550e8400-e29b-41d4-a716-446655440000",
      "550e8400-e29b-41d4-a716-446655440001"
    ],
    "failed": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440002",
        "error": "ไฟล์นี้ต้องอยู่ในสถานะ \"linked\" ก่อนอนุมัติ"
      }
    ]
  }
}
```

---

### 12. Bulk Delete Files

Delete multiple staged files at once. Approved files cannot be deleted.

**Request**

```
POST /api-staging/files/bulk-delete
```

**Auth:** JWT (canApproveAppointments)

**Request Body**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file_ids` | uuid[] | Yes | Array of file IDs to delete |

**Request Body Example**

```json
{
  "file_ids": [
    "550e8400-e29b-41d4-a716-446655440000",
    "550e8400-e29b-41d4-a716-446655440001"
  ]
}
```

**Response**

```json
{
  "data": {
    "deleted": [
      "550e8400-e29b-41d4-a716-446655440000"
    ],
    "failed": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440001",
        "error": "ไม่สามารถลบไฟล์ที่อนุมัติแล้วได้"
      }
    ]
  }
}
```

---

### 13. Delete Staged File

Delete a single staged file.

**Request**

```
DELETE /api-staging/files/:id
```

**Auth:** JWT (authenticated user)

**Path Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | uuid | Staged file ID |

**Response**

```json
{
  "data": {
    "deleted": true
  }
}
```

**Note:** Approved files cannot be deleted (returns 400 error).

---

### 14. List LINE Accounts

List all LINE account mappings with pagination.

**Request**

```
GET /api-staging/line-accounts
```

**Auth:** JWT (Level 2 - Admin)

**Query Parameters**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `page` | integer | No | 1 | Page number |
| `limit` | integer | No | 50 | Items per page |

**Response**

```json
{
  "data": {
    "data": [
      {
        "id": "uuid",
        "employee_id": "uuid",
        "line_user_id": "U1234567890abcdef",
        "display_name": "สมชาย ใจดี",
        "profile_picture_url": "https://profile.line-scdn.net/...",
        "linked_at": "2024-01-10T08:00:00Z",
        "created_at": "2024-01-10T08:00:00Z",
        "updated_at": "2024-01-10T08:00:00Z",
        "employee": {
          "id": "uuid",
          "name": "สมชาย ใจดี",
          "code": "EMP001",
          "nickname": "ชาย",
          "profile_image_url": "https://..."
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 15,
      "totalPages": 1
    }
  }
}
```

---

### 15. Create LINE Account

Create a new LINE account mapping for an employee.

**Request**

```
POST /api-staging/line-accounts
```

**Auth:** JWT (Level 2 - Admin)

**Request Body**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `employee_id` | uuid | Yes | Employee ID |
| `line_user_id` | string | Yes | LINE user ID |
| `display_name` | string | No | LINE display name |
| `profile_picture_url` | string | No | LINE profile picture URL |

**Request Body Example**

```json
{
  "employee_id": "550e8400-e29b-41d4-a716-446655440000",
  "line_user_id": "U1234567890abcdef",
  "display_name": "สมชาย ใจดี",
  "profile_picture_url": "https://profile.line-scdn.net/..."
}
```

**Response**

```json
{
  "data": {
    "id": "uuid",
    "employee_id": "uuid",
    "line_user_id": "U1234567890abcdef",
    "display_name": "สมชาย ใจดี",
    "profile_picture_url": "https://profile.line-scdn.net/...",
    "linked_at": "2024-01-15T10:30:00Z",
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T10:30:00Z",
    "employee": {
      "id": "uuid",
      "name": "สมชาย ใจดี",
      "code": "EMP001",
      "nickname": "ชาย",
      "profile_image_url": "https://..."
    }
  }
}
```

---

### 16. Update LINE Account

Update LINE account display name or profile picture.

**Request**

```
PUT /api-staging/line-accounts/:id
```

**Auth:** JWT (Level 2 - Admin)

**Path Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | uuid | LINE account ID |

**Request Body**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `display_name` | string | No | New display name |
| `profile_picture_url` | string | No | New profile picture URL |

**Request Body Example**

```json
{
  "display_name": "สมชาย (ชาย)",
  "profile_picture_url": "https://profile.line-scdn.net/new-url"
}
```

**Response**

```json
{
  "data": {
    "id": "uuid",
    "employee_id": "uuid",
    "line_user_id": "U1234567890abcdef",
    "display_name": "สมชาย (ชาย)",
    "profile_picture_url": "https://profile.line-scdn.net/new-url",
    ...
  }
}
```

---

### 17. Delete LINE Account

Delete a LINE account mapping.

**Request**

```
DELETE /api-staging/line-accounts/:id
```

**Auth:** JWT (Level 2 - Admin)

**Path Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | uuid | LINE account ID |

**Response**

```json
{
  "data": {
    "deleted": true
  }
}
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
| 400 | กรุณาระบุ line_user_id | Missing required LINE user ID |
| 400 | กรุณาระบุ file_url | Missing required file URL |
| 400 | กรุณาระบุ file_name | Missing required file name |
| 400 | กรุณาระบุ ticket_id | Missing required ticket ID |
| 400 | กรุณาระบุเหตุผลในการปฏิเสธ | Rejection reason required |
| 400 | กรุณาระบุรายการไฟล์ที่ต้องการอนุมัติ | Empty file list for bulk approve |
| 400 | กรุณาระบุรายการไฟล์ที่ต้องการลบ | Empty file list for bulk delete |
| 400 | ไฟล์นี้ไม่อยู่ในสถานะที่สามารถเชื่อมต่อกับตั๋วได้ | File not in pending status |
| 400 | ไฟล์นี้ต้องอยู่ในสถานะ "linked" ก่อนอนุมัติ | File must be linked before approval |
| 400 | ไฟล์นี้ยังไม่ได้เชื่อมต่อกับตั๋วงาน | File not linked to any ticket |
| 400 | ไม่สามารถลบไฟล์ที่ได้รับการอนุมัติแล้ว | Cannot delete approved files |
| 400 | พนักงานนี้มีบัญชี LINE เชื่อมต่ออยู่แล้ว | Employee already has LINE account |
| 400 | บัญชี LINE นี้เชื่อมต่อกับพนักงานอื่นอยู่แล้ว | LINE account already linked |
| 401 | ไม่มีสิทธิ์เข้าถึง | Missing or invalid authentication |
| 403 | ไม่มีสิทธิ์ในการดำเนินการ | Insufficient permissions |
| 404 | ไม่พบไฟล์ที่ระบุ | File not found |
| 404 | ไม่พบตั๋วงานที่ระบุ | Ticket not found |
| 404 | ไม่พบพนักงานที่ระบุ | Employee not found |
| 404 | ไม่พบการเชื่อมต่อบัญชี LINE | LINE account not found |
| 404 | Not found | Invalid endpoint path |
| 500 | ไม่สามารถดึงข้อมูลไฟล์ได้ | Database error fetching files |
| 500 | ไม่สามารถสร้างไฟล์ได้ | Database error creating file |
| 500 | ไม่สามารถสร้างความคิดเห็นได้ | Database error creating comment |

---

## Usage Notes

### n8n Integration Flow

1. **Receive LINE message**: n8n webhook receives file from LINE
2. **Create staged file**: POST `/files` with LINE user ID
3. **Show ticket selection**: GET `/tickets/carousel` to get user's tickets
4. **Link file to ticket**: PUT `/files/:id/link` with selected ticket
5. **Notify admin**: Admin sees pending files in web app

### Web App Approval Flow

1. **View pending files**: GET `/files/grouped?status=linked`
2. **Review files by ticket**: Files are grouped for easy review
3. **Approve or reject**:
   - Single: POST `/files/:id/approve` or `/files/:id/reject`
   - Bulk: POST `/files/bulk-approve` for multiple files
4. **Approved files appear as ticket comments**

### File Type Handling

When files are approved:
- **Images** (jpg, jpeg, png, gif, webp, bmp): Attached as photos in `child_comment_photos`
- **Other files**: Attached as files in `child_comment_files`

---

## Related Endpoints

- **Tickets API** (`/api-tickets`) - Ticket operations
- **Comments** - File attachments appear as ticket comments after approval
- **Employees API** (`/api-employees`) - Employee information

---

## Database Tables

### main_staged_files

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| employee_id | uuid | FK to main_employees |
| file_url | text | URL of the uploaded file |
| file_name | text | Original file name |
| file_size | bigint | File size in bytes |
| mime_type | text | MIME type |
| ticket_id | uuid | FK to main_tickets (nullable) |
| status | text | pending, linked, approved, rejected, expired |
| approved_by | uuid | FK to main_employees (approver) |
| approved_at | timestamptz | Approval timestamp |
| rejection_reason | text | Reason for rejection |
| result_comment_id | uuid | FK to child_ticket_comments (created on approval) |
| expires_at | timestamptz | Expiration timestamp |
| source | text | Upload source (e.g., "line") |
| metadata | jsonb | Additional metadata |
| created_at | timestamptz | Creation timestamp |
| updated_at | timestamptz | Last update timestamp |

### child_employee_line_accounts

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| employee_id | uuid | FK to main_employees |
| line_user_id | text | LINE user ID |
| display_name | text | LINE display name |
| profile_picture_url | text | LINE profile picture URL |
| linked_at | timestamptz | When account was linked |
| created_at | timestamptz | Creation timestamp |
| updated_at | timestamptz | Last update timestamp |
