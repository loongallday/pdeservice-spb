# Announcements API

## Overview

The Announcements API provides read-only access to global announcements. Announcements can include text messages, photos, and file attachments. Create, update, and delete operations are managed directly via the Supabase dashboard.

**Base URL**: `/functions/v1/api-announcements`

**Authentication**: All endpoints require Bearer token authentication.

**Note**: This API is read-only. To create, update, or delete announcements, use the Supabase dashboard.

---

## Endpoints

### List Announcements

Get all announcements with their photos and file attachments, ordered by creation date (newest first).

**Endpoint**: `GET /`

**Required Level**: 0 (all authenticated users)

**Example Request**:
```http
GET /functions/v1/api-announcements
Authorization: Bearer <token>
```

**Example Response**:
```json
{
  "data": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "message": "System maintenance scheduled for this weekend",
      "created_at": "2025-12-04T10:00:00Z",
      "updated_at": "2025-12-04T10:00:00Z",
      "photos": [
        {
          "id": "223e4567-e89b-12d3-a456-426614174001",
          "announcement_id": "123e4567-e89b-12d3-a456-426614174000",
          "image_url": "https://storage.supabase.co/object/public/announcements/123e4567-e89b-12d3-a456-426614174000/photo1.jpg",
          "display_order": 0,
          "created_at": "2025-12-04T10:05:00Z"
        }
      ],
      "files": [
        {
          "id": "323e4567-e89b-12d3-a456-426614174002",
          "announcement_id": "123e4567-e89b-12d3-a456-426614174000",
          "file_url": "https://storage.supabase.co/object/public/announcements/123e4567-e89b-12d3-a456-426614174000/document.pdf",
          "file_name": "maintenance_schedule.pdf",
          "file_size": 524288,
          "mime_type": "application/pdf",
          "created_at": "2025-12-04T10:05:00Z"
        }
      ]
    }
  ]
}
```

---

## Data Structure

### Announcement Object

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Unique identifier for the announcement |
| `message` | string | The announcement message content |
| `created_at` | timestamp | When the announcement was created |
| `updated_at` | timestamp | When the announcement was last updated |
| `photos` | array | Array of photo attachments (see Photo Object below) |
| `files` | array | Array of file attachments (see File Object below) |

### Photo Object

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Unique identifier for the photo |
| `announcement_id` | UUID | Reference to the parent announcement |
| `image_url` | string | URL to the photo in Supabase Storage |
| `display_order` | integer | Order in which the photo should be displayed (0 = first) |
| `created_at` | timestamp | When the photo was uploaded |

### File Object

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Unique identifier for the file |
| `announcement_id` | UUID | Reference to the parent announcement |
| `file_url` | string | URL to the file in Supabase Storage |
| `file_name` | string | Original filename |
| `file_size` | integer | File size in bytes |
| `mime_type` | string | MIME type of the file (e.g., "application/pdf") |
| `created_at` | timestamp | When the file was uploaded |

---

## Storage

Announcement photos and files are stored in the `announcements` Supabase Storage bucket.

**Bucket Name**: `announcements`

**File Organization**: `announcements/{announcement_id}/{filename}`

**Supported File Types**:
- Images: JPEG, JPG, PNG, WebP, GIF
- Documents: PDF, Word, Excel, PowerPoint
- Text: Plain text, CSV

**File Size Limit**: 50MB per file

**Access**:
- **Read**: Level 0+ (all authenticated employees)
- **Upload**: Level 1+ (via Supabase dashboard)
- **Update/Delete**: Level 2+ (via Supabase dashboard)

---

## Managing Announcements

### Creating Announcements

1. Go to Supabase Dashboard → Table Editor → `announcements`
2. Click "Insert" → "Insert row"
3. Enter the `message` text
4. Click "Save"

### Adding Photos

1. Upload photos to Supabase Storage bucket `announcements`:
   - Path: `announcements/{announcement_id}/{filename}`
2. Go to Table Editor → `announcement_photos`
3. Insert a new row with:
   - `announcement_id`: The announcement ID
   - `image_url`: The storage URL
   - `display_order`: Order for display (0 = first)

### Adding Files

1. Upload files to Supabase Storage bucket `announcements`:
   - Path: `announcements/{announcement_id}/{filename}`
2. Go to Table Editor → `announcement_files`
3. Insert a new row with:
   - `announcement_id`: The announcement ID
   - `file_url`: The storage URL
   - `file_name`: Original filename
   - `file_size`: Size in bytes (optional)
   - `mime_type`: MIME type (optional)

### Updating Announcements

1. Go to Supabase Dashboard → Table Editor → `announcements`
2. Find the announcement and click "Edit"
3. Update the `message` field
4. Click "Save"

### Deleting Announcements

1. Go to Supabase Dashboard → Table Editor → `announcements`
2. Find the announcement and click "Delete"
3. Confirm deletion

**Note**: Deleting an announcement will cascade delete all associated photos and files.

---

## Error Responses

### 401 Unauthorized

```json
{
  "error": "ไม่ได้รับอนุญาต"
}
```

**Cause**: Missing or invalid authentication token.

### 403 Forbidden

```json
{
  "error": "ไม่มีสิทธิ์เข้าถึง"
}
```

**Cause**: User does not have sufficient permission level.

### 500 Internal Server Error

```json
{
  "error": "ไม่สามารถดึงข้อมูลประกาศได้"
}
```

**Cause**: Database error or server issue.

---

## Authorization Levels

| Operation | Required Level | Description |
|-----------|---------------|-------------|
| Read announcements | 0+ | All authenticated employees can view announcements |
| Create announcements | 1+ | Level 1+ can create (via Supabase dashboard) |
| Update announcements | 2+ | Level 2+ can update (via Supabase dashboard) |
| Delete announcements | 2+ | Level 2+ can delete (via Supabase dashboard) |

---

## Notes

- Announcements are **global** and not tied to any specific employee
- Photos are automatically sorted by `display_order` (ascending)
- Files are returned in the order they were created
- All timestamps are in UTC
- The API returns announcements ordered by `created_at` (newest first)

