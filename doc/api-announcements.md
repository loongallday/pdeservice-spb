# API Announcements

## Overview

The Announcements API manages system-wide announcements for the Field Service Management system. Announcements can include text messages, photos, and file attachments to communicate important information to all users.

This API allows:
- All authenticated users to view announcements
- Superadmins (level 3) to create, update, and delete announcements

---

## Base URL

```
/api-announcements
```

---

## Authentication

All endpoints require a valid JWT token in the Authorization header.

```
Authorization: Bearer <jwt_token>
```

**Permission Levels:**

| Operation | Required Level |
|-----------|---------------|
| List/View | 0 (Technician L1 or higher) |
| Create | 3 (Superadmin only) |
| Update | 3 (Superadmin only) |
| Delete | 3 (Superadmin only) |

---

## Endpoints Summary

| Method | Path | Description | Auth Required | Min Level |
|--------|------|-------------|---------------|-----------|
| GET | `/` | List all announcements | Yes | 0 |
| GET | `/:id` | Get announcement by ID | Yes | 0 |
| POST | `/` | Create announcement | Yes | 3 |
| PUT | `/:id` | Update announcement | Yes | 3 |
| DELETE | `/:id` | Delete announcement | Yes | 3 |

---

## Endpoints

### 1. List Announcements

Retrieve all announcements with their associated photos and files, ordered by creation date (newest first).

**Request**

```
GET /api-announcements
```

**Response**

```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "message": "ประกาศสำคัญ: ระบบจะปิดปรับปรุงในวันเสาร์ที่ 20 มกราคม 2567",
      "created_at": "2024-01-15T10:30:00Z",
      "updated_at": "2024-01-15T10:30:00Z",
      "photos": [
        {
          "id": "uuid",
          "announcement_id": "550e8400-e29b-41d4-a716-446655440000",
          "image_url": "https://example.com/photo1.jpg",
          "display_order": 0,
          "created_at": "2024-01-15T10:30:00Z"
        }
      ],
      "files": [
        {
          "id": "uuid",
          "announcement_id": "550e8400-e29b-41d4-a716-446655440000",
          "file_url": "https://example.com/document.pdf",
          "file_name": "รายละเอียดการปรับปรุง.pdf",
          "file_size": 102400,
          "mime_type": "application/pdf",
          "created_at": "2024-01-15T10:30:00Z"
        }
      ]
    }
  ]
}
```

**Example Request**

```bash
curl -X GET "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-announcements" \
  -H "Authorization: Bearer <token>"
```

---

### 2. Get Announcement by ID

Retrieve a single announcement by its ID with associated photos and files.

**Request**

```
GET /api-announcements/:id
```

**Path Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | uuid | Yes | Announcement unique identifier |

**Response**

```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "message": "ประกาศสำคัญ: ระบบจะปิดปรับปรุงในวันเสาร์ที่ 20 มกราคม 2567",
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T10:30:00Z",
    "photos": [],
    "files": []
  }
}
```

**Example Request**

```bash
curl -X GET "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-announcements/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer <token>"
```

---

### 3. Create Announcement

Create a new announcement with optional photos and file attachments.

**Request**

```
POST /api-announcements
```

**Request Body**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `message` | string | Yes | Announcement message (max 5000 characters) |
| `photos` | array | No | Array of photo objects |
| `files` | array | No | Array of file objects |

**Photo Object**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `image_url` | string | Yes | URL of the image |
| `display_order` | integer | No | Order for display (defaults to array index) |

**File Object**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file_url` | string | Yes | URL of the file |
| `file_name` | string | Yes | Display name for the file |
| `file_size` | integer | No | File size in bytes |
| `mime_type` | string | No | MIME type of the file |

**Request Body Example**

```json
{
  "message": "ประกาศสำคัญ: ระบบจะปิดปรับปรุงในวันเสาร์ที่ 20 มกราคม 2567 ตั้งแต่เวลา 22:00 - 06:00 น.",
  "photos": [
    {
      "image_url": "https://example.com/maintenance-notice.jpg",
      "display_order": 0
    }
  ],
  "files": [
    {
      "file_url": "https://example.com/maintenance-schedule.pdf",
      "file_name": "ตารางการปรับปรุงระบบ.pdf",
      "file_size": 51200,
      "mime_type": "application/pdf"
    }
  ]
}
```

**Response**

```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "message": "ประกาศสำคัญ: ระบบจะปิดปรับปรุงในวันเสาร์ที่ 20 มกราคม 2567 ตั้งแต่เวลา 22:00 - 06:00 น.",
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T10:30:00Z",
    "photos": [
      {
        "id": "uuid",
        "announcement_id": "550e8400-e29b-41d4-a716-446655440000",
        "image_url": "https://example.com/maintenance-notice.jpg",
        "display_order": 0,
        "created_at": "2024-01-15T10:30:00Z"
      }
    ],
    "files": [
      {
        "id": "uuid",
        "announcement_id": "550e8400-e29b-41d4-a716-446655440000",
        "file_url": "https://example.com/maintenance-schedule.pdf",
        "file_name": "ตารางการปรับปรุงระบบ.pdf",
        "file_size": 51200,
        "mime_type": "application/pdf",
        "created_at": "2024-01-15T10:30:00Z"
      }
    ]
  }
}
```

**Example Request**

```bash
curl -X POST "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-announcements" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "ประกาศสำคัญ: ระบบจะปิดปรับปรุงในวันเสาร์ที่ 20 มกราคม 2567"
  }'
```

---

### 4. Update Announcement

Update an existing announcement. When updating photos or files, the entire array is replaced (not merged).

**Request**

```
PUT /api-announcements/:id
```

**Path Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | uuid | Yes | Announcement unique identifier |

**Request Body**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `message` | string | No | Updated announcement message (max 5000 characters) |
| `photos` | array | No | Array of photo objects (replaces existing photos) |
| `files` | array | No | Array of file objects (replaces existing files) |

**Request Body Example**

```json
{
  "message": "อัปเดต: การปรับปรุงระบบเลื่อนเป็นวันอาทิตย์ที่ 21 มกราคม 2567",
  "photos": []
}
```

**Response**

```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "message": "อัปเดต: การปรับปรุงระบบเลื่อนเป็นวันอาทิตย์ที่ 21 มกราคม 2567",
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T14:00:00Z",
    "photos": [],
    "files": [
      {
        "id": "uuid",
        "announcement_id": "550e8400-e29b-41d4-a716-446655440000",
        "file_url": "https://example.com/maintenance-schedule.pdf",
        "file_name": "ตารางการปรับปรุงระบบ.pdf",
        "file_size": 51200,
        "mime_type": "application/pdf",
        "created_at": "2024-01-15T10:30:00Z"
      }
    ]
  }
}
```

**Example Request**

```bash
curl -X PUT "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-announcements/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "อัปเดต: การปรับปรุงระบบเลื่อนเป็นวันอาทิตย์ที่ 21 มกราคม 2567"
  }'
```

---

### 5. Delete Announcement

Delete an announcement and all associated photos and files.

**Request**

```
DELETE /api-announcements/:id
```

**Path Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | uuid | Yes | Announcement unique identifier |

**Response**

```json
{
  "data": {
    "message": "ลบประกาศสำเร็จ"
  }
}
```

**Example Request**

```bash
curl -X DELETE "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-announcements/550e8400-e29b-41d4-a716-446655440000" \
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
| 400 | กรุณาระบุข้อความประกาศ | Message is required but not provided |
| 400 | ข้อความประกาศต้องไม่ว่างเปล่า | Message cannot be empty |
| 400 | ข้อความประกาศต้องไม่เกิน 5000 ตัวอักษร | Message exceeds 5000 character limit |
| 401 | ไม่มีสิทธิ์เข้าถึง | Missing or invalid authentication token |
| 403 | ไม่มีสิทธิ์ในการดำเนินการ | Insufficient permission level |
| 404 | ไม่พบประกาศที่ระบุ | Announcement not found |
| 404 | Not found | Invalid endpoint path |
| 500 | ไม่สามารถดึงข้อมูลประกาศได้ | Database error fetching announcements |
| 500 | ไม่สามารถสร้างประกาศได้ | Database error creating announcement |
| 500 | ไม่สามารถอัปเดตประกาศได้ | Database error updating announcement |
| 500 | ไม่สามารถลบประกาศได้ | Database error deleting announcement |

---

## Data Models

### Announcement Object

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `id` | uuid | No | Unique announcement identifier |
| `message` | string | No | Announcement message content |
| `created_at` | timestamp | No | Creation timestamp |
| `updated_at` | timestamp | No | Last update timestamp |
| `photos` | array | No | Array of photo objects (sorted by display_order) |
| `files` | array | No | Array of file objects |

### Photo Object

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `id` | uuid | No | Unique photo identifier |
| `announcement_id` | uuid | No | Parent announcement ID |
| `image_url` | string | No | URL of the image |
| `display_order` | integer | No | Order for display |
| `created_at` | timestamp | No | Creation timestamp |

### File Object

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `id` | uuid | No | Unique file identifier |
| `announcement_id` | uuid | No | Parent announcement ID |
| `file_url` | string | No | URL of the file |
| `file_name` | string | No | Display name for the file |
| `file_size` | integer | Yes | File size in bytes |
| `mime_type` | string | Yes | MIME type of the file |
| `created_at` | timestamp | No | Creation timestamp |

---

## Database Tables

### main_announcements

Main table for storing announcements.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| message | text | Announcement message |
| created_at | timestamptz | Creation timestamp |
| updated_at | timestamptz | Last update timestamp |

### child_announcement_photos

Child table for announcement photos.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| announcement_id | uuid | FK to main_announcements |
| image_url | text | URL of the image |
| display_order | integer | Display order |
| created_at | timestamptz | Creation timestamp |

### child_announcement_files

Child table for announcement file attachments.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| announcement_id | uuid | FK to main_announcements |
| file_url | text | URL of the file |
| file_name | text | Display name |
| file_size | integer | File size in bytes |
| mime_type | text | MIME type |
| created_at | timestamptz | Creation timestamp |

---

## Usage Notes

### Frontend Integration

1. **Display**: Announcements are returned in descending order by creation date (newest first). Display photos in `display_order` order.

2. **Rich Content**: The message field can contain plain text. Consider formatting for display in the UI.

3. **Media Handling**: Photos and files are stored as URLs. Ensure proper storage (e.g., Supabase Storage) before creating announcements.

4. **Update Behavior**: When updating photos or files, provide the complete array. Omitting the field keeps existing data; providing an empty array removes all.

### Admin Features

1. **Superadmin Only**: Only users with permission level 3 can create, update, or delete announcements.

2. **Audit Trail**: Track changes via `created_at` and `updated_at` timestamps.

---

## Related Endpoints

- **Notifications API** (`/api-notifications`) - Notifications for individual users
- **Initialize API** (`/api-initialize`) - May include recent announcements in app initialization
