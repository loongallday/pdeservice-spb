# API Sites

## Overview

The Sites API manages customer site (location) data in the Field Service Management system. Sites represent physical customer locations where service work is performed, and are linked to companies with Thai administrative location data (province, district, sub-district codes).

This API allows users to:
- Search and retrieve sites with pagination and filtering
- Create, update, and delete sites
- Manage site comments with photos and file attachments
- Get quick site hints for autocomplete functionality

---

## Base URL

```
/api-sites
```

---

## Authentication

All endpoints require a valid JWT token in the Authorization header.

```
Authorization: Bearer <jwt_token>
```

### Permission Levels

| Level | Role | Capabilities |
|-------|------|--------------|
| 0 | Technician L1 | Read sites, search, view/add comments |
| 1 | Assigner, PM, Sales | Create and update sites |
| 2 | Admin | All Level 1 capabilities |
| 3 | Superadmin | Delete sites |

---

## Endpoints Summary

| Method | Path | Description | Min Level |
|--------|------|-------------|-----------|
| GET | `/global-search` | Search sites with pagination | 0 |
| GET | `/hint` | Quick search (up to 5 results) | 0 |
| GET | `/:id` | Get site by ID with related data | 0 |
| POST | `/` | Create new site | 1 |
| POST | `/create-or-replace` | Upsert site by ID | 1 |
| PUT | `/:id` | Update site | 1 |
| DELETE | `/:id` | Delete site | 3 |
| GET | `/:id/comments` | List site comments | 0 |
| POST | `/:id/comments` | Create comment | 0 |
| PUT | `/:id/comments/:commentId` | Update comment | 0 |
| DELETE | `/:id/comments/:commentId` | Delete comment | 0 |

---

## Endpoints

### 1. Global Search Sites

Search sites with pagination and filtering. Searches across site name, address details, and company name.

**Request**

```
GET /api-sites/global-search
```

**Query Parameters**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `page` | integer | No | 1 | Page number (minimum: 1) |
| `limit` | integer | No | 20 | Items per page (1-100) |
| `q` | string | No | - | Search text (name, address, company name) |
| `company_id` | uuid | No | - | Filter by company ID |
| `min_ticket_count` | integer | No | - | Minimum ticket count filter |
| `max_ticket_count` | integer | No | - | Maximum ticket count filter |

**Response**

```json
{
  "data": {
    "data": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "name": "สำนักงานใหญ่ กรุงเทพ",
        "description": "123 ถนนสุขุมวิท",
        "company_id": "550e8400-e29b-41d4-a716-446655440001",
        "is_main_branch": true,
        "company_name": "บริษัท ABC จำกัด",
        "ticket_count": 15
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 100,
      "totalPages": 5,
      "hasNext": true,
      "hasPrevious": false
    }
  }
}
```

**Response Fields**

| Field | Type | Description |
|-------|------|-------------|
| `id` | uuid | Site unique identifier |
| `name` | string | Site name |
| `description` | string | Address detail |
| `company_id` | uuid | Linked company ID |
| `is_main_branch` | boolean | Whether this is the company's main branch |
| `company_name` | string | Company name (Thai or English) |
| `ticket_count` | integer | Number of tickets (only when using ticket count filters) |

**Example Request**

```bash
# Search sites with text query
curl -X GET "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-sites/global-search?q=กรุงเทพ&page=1&limit=10" \
  -H "Authorization: Bearer <token>"

# Filter by company and ticket count
curl -X GET "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-sites/global-search?company_id=uuid&min_ticket_count=5" \
  -H "Authorization: Bearer <token>"
```

---

### 2. Site Hints

Quick search returning up to 5 sites for autocomplete functionality.

**Request**

```
GET /api-sites/hint
```

**Query Parameters**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `q` | string | No | - | Search query |
| `company_id` | uuid | No | - | Filter by company ID |

**Response**

```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "สำนักงานใหญ่ กรุงเทพ",
      "description": "123 ถนนสุขุมวิท",
      "company_id": "550e8400-e29b-41d4-a716-446655440001",
      "is_main_branch": true,
      "company_name": "บริษัท ABC จำกัด"
    }
  ]
}
```

**Example Request**

```bash
curl -X GET "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-sites/hint?q=สำนักงาน" \
  -H "Authorization: Bearer <token>"
```

---

### 3. Get Site by ID

Retrieve a single site with related tickets, merchandise, and contacts.

**Request**

```
GET /api-sites/:id
```

**Path Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | uuid | Yes | Site ID |

**Response**

```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "สำนักงานใหญ่ กรุงเทพ",
    "address_detail": "123 ถนนสุขุมวิท",
    "subdistrict_code": "100101",
    "district_code": "1001",
    "province_code": "10",
    "postal_code": "10110",
    "map_url": "https://maps.google.com/?q=...",
    "map_embed_url": "https://www.google.com/maps/embed?...",
    "latitude": 13.7563,
    "longitude": 100.5018,
    "company_id": "550e8400-e29b-41d4-a716-446655440001",
    "is_main_branch": true,
    "safety_standard": "standard",
    "company": {
      "tax_id": "0123456789012",
      "name_th": "บริษัท ABC จำกัด",
      "name_en": "ABC Company Limited"
    },
    "tickets": [
      {
        "id": "uuid",
        "description": "ซ่อมเครื่อง UPS",
        "created_at": "2024-01-15T10:30:00Z",
        "updated_at": "2024-01-15T14:00:00Z",
        "work_type": {
          "name": "ซ่อม",
          "code": "rma"
        },
        "status": {
          "name": "เสร็จสิ้น",
          "code": "completed"
        },
        "appointment": {
          "appointment_date": "2024-01-16",
          "appointment_time_start": "09:00",
          "appointment_time_end": "12:00",
          "appointment_type": "onsite",
          "is_approved": true
        }
      }
    ],
    "ticket_count": 25,
    "merchandise": [
      {
        "id": "uuid",
        "model": "UPS-3000",
        "serial": "SN123456"
      }
    ],
    "contacts": [
      {
        "id": "uuid",
        "contact_name": "คุณสมชาย"
      }
    ]
  }
}
```

**Site Object Fields**

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `id` | uuid | No | Site unique identifier |
| `name` | string | No | Site name |
| `address_detail` | string | Yes | Full address |
| `subdistrict_code` | string | Yes | Thai sub-district code |
| `district_code` | string | Yes | Thai district code |
| `province_code` | string | Yes | Thai province code |
| `postal_code` | string | Yes | Postal code |
| `map_url` | string | Yes | Google Maps URL |
| `map_embed_url` | string | Yes | Embeddable map URL |
| `latitude` | number | Yes | GPS latitude |
| `longitude` | number | Yes | GPS longitude |
| `company_id` | uuid | Yes | Linked company ID |
| `is_main_branch` | boolean | Yes | Main branch flag |
| `safety_standard` | string | Yes | Safety standard level |
| `company` | object | Yes | Company details |
| `tickets` | array | No | Recent tickets (max 10) |
| `ticket_count` | integer | No | Total ticket count |
| `merchandise` | array | No | Equipment at site |
| `contacts` | array | No | Site contacts |

**Example Request**

```bash
curl -X GET "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-sites/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer <token>"
```

---

### 4. Create Site

Create a new site.

**Request**

```
POST /api-sites
```

**Required Permission Level:** 1 (Assigner, PM, Sales or higher)

**Request Body**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Site name |
| `subdistrict_code` | string | Yes | Thai sub-district code |
| `district_code` | string | Yes | Thai district code |
| `province_code` | string | Yes | Thai province code |
| `postal_code` | string | Yes | Postal code |
| `address_detail` | string | No | Full address |
| `map_url` | string | No | Google Maps URL |
| `map_embed_url` | string | No | Embeddable map URL |
| `latitude` | number | No | GPS latitude |
| `longitude` | number | No | GPS longitude |
| `company_id` | uuid | No | Company ID to link |
| `contact_ids` | array | No | Array of contact IDs |
| `is_main_branch` | boolean | No | Main branch flag |
| `safety_standard` | string | No | Safety standard level |

**Request Body Example**

```json
{
  "name": "สำนักงานใหญ่ กรุงเทพ",
  "address_detail": "123 ถนนสุขุมวิท แขวงคลองเตย",
  "subdistrict_code": "100101",
  "district_code": "1001",
  "province_code": "10",
  "postal_code": "10110",
  "company_id": "550e8400-e29b-41d4-a716-446655440001",
  "is_main_branch": true,
  "latitude": 13.7563,
  "longitude": 100.5018
}
```

**Response**

```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "สำนักงานใหญ่ กรุงเทพ",
    "address_detail": "123 ถนนสุขุมวิท แขวงคลองเตย",
    "subdistrict_code": "100101",
    "district_code": "1001",
    "province_code": "10",
    "postal_code": "10110",
    "company_id": "550e8400-e29b-41d4-a716-446655440001",
    "is_main_branch": true,
    "latitude": 13.7563,
    "longitude": 100.5018
  }
}
```

**Example Request**

```bash
curl -X POST "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-sites" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "สำนักงานใหญ่ กรุงเทพ",
    "subdistrict_code": "100101",
    "district_code": "1001",
    "province_code": "10",
    "postal_code": "10110"
  }'
```

---

### 5. Create or Replace Site

Upsert a site by ID. If a site with the given ID exists, it will be replaced; otherwise, a new site is created.

**Request**

```
POST /api-sites/create-or-replace
```

**Required Permission Level:** 1 (Assigner, PM, Sales or higher)

**Request Body**

Same as Create Site, but with `id` as a required field.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | uuid | Yes | Site ID for upsert |
| `name` | string | Yes | Site name |
| `subdistrict_code` | string | Yes | Thai sub-district code |
| `district_code` | string | Yes | Thai district code |
| `province_code` | string | Yes | Thai province code |
| `postal_code` | string | Yes | Postal code |
| ... | ... | ... | Same optional fields as Create |

**Request Body Example**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "สำนักงานใหญ่ กรุงเทพ (ปรับปรุง)",
  "subdistrict_code": "100101",
  "district_code": "1001",
  "province_code": "10",
  "postal_code": "10110"
}
```

**Example Request**

```bash
curl -X POST "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-sites/create-or-replace" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "สำนักงานใหญ่ กรุงเทพ",
    "subdistrict_code": "100101",
    "district_code": "1001",
    "province_code": "10",
    "postal_code": "10110"
  }'
```

---

### 6. Update Site

Update an existing site.

**Request**

```
PUT /api-sites/:id
```

**Required Permission Level:** 1 (Assigner, PM, Sales or higher)

**Path Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | uuid | Yes | Site ID |

**Request Body**

All fields are optional. Only provided fields will be updated.

```json
{
  "name": "สำนักงานใหญ่ กรุงเทพ (อัปเดต)",
  "address_detail": "456 ถนนสุขุมวิท",
  "is_main_branch": false
}
```

**Example Request**

```bash
curl -X PUT "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-sites/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"name": "สำนักงานใหญ่ กรุงเทพ (อัปเดต)"}'
```

---

### 7. Delete Site

Delete a site permanently.

**Request**

```
DELETE /api-sites/:id
```

**Required Permission Level:** 3 (Superadmin only)

**Path Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | uuid | Yes | Site ID |

**Response**

```json
{
  "data": {
    "message": "ลบสถานที่สำเร็จ"
  }
}
```

**Example Request**

```bash
curl -X DELETE "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-sites/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer <token>"
```

---

## Comment Endpoints

### 8. Get Site Comments

Retrieve paginated comments for a site.

**Request**

```
GET /api-sites/:id/comments
```

**Path Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | uuid | Yes | Site ID |

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
        "site_id": "uuid",
        "author_id": "uuid",
        "content": "ติดต่อล่วงหน้า 1 วัน @[employee-uuid]",
        "mentioned_employee_ids": ["employee-uuid"],
        "is_edited": false,
        "created_at": "2024-01-15T10:30:00Z",
        "updated_at": "2024-01-15T10:30:00Z",
        "author": {
          "id": "uuid",
          "name": "สมชาย ใจดี",
          "code": "EMP001",
          "nickname": "ชาย",
          "profile_image_url": "https://..."
        },
        "photos": [
          {
            "id": "uuid",
            "image_url": "https://...",
            "display_order": 0,
            "created_at": "2024-01-15T10:30:00Z"
          }
        ],
        "files": [
          {
            "id": "uuid",
            "file_url": "https://...",
            "file_name": "document.pdf",
            "file_size": 102400,
            "mime_type": "application/pdf",
            "created_at": "2024-01-15T10:30:00Z"
          }
        ]
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

**Comment Object Fields**

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `id` | uuid | No | Comment ID |
| `site_id` | uuid | No | Parent site ID |
| `author_id` | uuid | No | Comment author's employee ID |
| `content` | string | No | Comment text (may contain @mentions) |
| `mentioned_employee_ids` | array | No | Array of mentioned employee UUIDs |
| `is_edited` | boolean | No | Whether comment was edited |
| `created_at` | timestamp | No | Creation time |
| `updated_at` | timestamp | No | Last update time |
| `author` | object | Yes | Author employee details |
| `photos` | array | No | Attached photos |
| `files` | array | No | Attached files |

**Example Request**

```bash
curl -X GET "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-sites/550e8400-e29b-41d4-a716-446655440000/comments?page=1&limit=20" \
  -H "Authorization: Bearer <token>"
```

---

### 9. Create Comment

Add a new comment to a site.

**Request**

```
POST /api-sites/:id/comments
```

**Path Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | uuid | Yes | Site ID |

**Request Body**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `content` | string | Yes | Comment text (supports @mentions) |
| `photos` | array | No | Array of photo objects |
| `files` | array | No | Array of file objects |

**Photo Object**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `image_url` | string | Yes | URL of the uploaded image |
| `display_order` | integer | No | Display order (defaults to array index) |

**File Object**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file_url` | string | Yes | URL of the uploaded file |
| `file_name` | string | Yes | Original file name |
| `file_size` | integer | No | File size in bytes |
| `mime_type` | string | No | MIME type |

**Request Body Example**

```json
{
  "content": "ติดต่อคุณสมชาย @[550e8400-e29b-41d4-a716-446655440002] ก่อนเข้าพื้นที่",
  "photos": [
    {
      "image_url": "https://storage.example.com/photo1.jpg",
      "display_order": 0
    }
  ],
  "files": [
    {
      "file_url": "https://storage.example.com/map.pdf",
      "file_name": "site-map.pdf",
      "file_size": 102400,
      "mime_type": "application/pdf"
    }
  ]
}
```

**Response**

Returns the created comment object with status code 201.

**Example Request**

```bash
curl -X POST "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-sites/550e8400-e29b-41d4-a716-446655440000/comments" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"content": "ติดต่อล่วงหน้า 1 วัน"}'
```

---

### 10. Update Comment

Update an existing comment (author only).

**Request**

```
PUT /api-sites/:id/comments/:commentId
```

**Path Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | uuid | Yes | Site ID |
| `commentId` | uuid | Yes | Comment ID |

**Request Body**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `content` | string | Yes | Updated comment text |
| `photos` | array | No | Replace all photos (if provided) |
| `files` | array | No | Replace all files (if provided) |

**Note:** If `photos` or `files` array is provided, it replaces all existing attachments. To keep existing attachments, omit the field.

**Example Request**

```bash
curl -X PUT "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-sites/550e8400-e29b-41d4-a716-446655440000/comments/comment-uuid" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"content": "ติดต่อล่วงหน้า 2 วัน (แก้ไข)"}'
```

---

### 11. Delete Comment

Delete a comment (author or admin level 2+).

**Request**

```
DELETE /api-sites/:id/comments/:commentId
```

**Path Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | uuid | Yes | Site ID |
| `commentId` | uuid | Yes | Comment ID |

**Response**

```json
{
  "data": {
    "message": "ลบความคิดเห็นสำเร็จ"
  }
}
```

**Example Request**

```bash
curl -X DELETE "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-sites/550e8400-e29b-41d4-a716-446655440000/comments/comment-uuid" \
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
| 400 | กรุณาระบุ{field} | Missing required field |
| 401 | ไม่มีสิทธิ์เข้าถึง | Missing or invalid authentication token |
| 403 | ไม่มีสิทธิ์ดำเนินการนี้ | Insufficient permission level |
| 403 | ไม่มีสิทธิ์แก้ไขความคิดเห็นนี้ | Not the comment author |
| 403 | ไม่มีสิทธิ์ลบความคิดเห็นนี้ | Not the author and not admin |
| 404 | ไม่พบสถานที่ | Site not found |
| 404 | ไม่พบไซต์ที่ระบุ | Site not found (for comments) |
| 404 | ไม่พบความคิดเห็นที่ระบุ | Comment not found |
| 404 | Not found | Invalid endpoint path |
| 500 | Database error message | Database operation failed |

---

## Usage Notes

### Mention Format

Comments support @mentions in two formats:
- `@[uuid]` - Direct UUID mention (e.g., `@[550e8400-e29b-41d4-a716-446655440000]`)
- `@employee_code` - Code-based mention (e.g., `@EMP001`)

Mentioned employee IDs are automatically parsed and stored in `mentioned_employee_ids` array.

### Thai Administrative Codes

Sites use Thai administrative location codes:
- `province_code` - 2-digit province code (e.g., "10" for Bangkok)
- `district_code` - 4-digit district code (e.g., "1001")
- `subdistrict_code` - 6-digit sub-district code (e.g., "100101")

### Search Behavior

- Global search searches across: `name`, `address_detail`, and linked company name
- Commas in search queries are automatically converted to spaces
- Minimum 1 character required for search to filter results
- Company name search looks in both `name_th` and `name_en`

### Ticket Count Filtering

When using `min_ticket_count` or `max_ticket_count` parameters, the API uses a database RPC function (`search_sites_with_ticket_count`) for efficient querying. The response includes `ticket_count` field for each site.

---

## Database Tables

### main_sites

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| name | text | Site name (required) |
| address_detail | text | Full address |
| subdistrict_code | text | Thai sub-district code |
| district_code | text | Thai district code |
| province_code | text | Thai province code |
| postal_code | text | Postal code |
| map_url | text | Google Maps URL |
| map_embed_url | text | Embeddable map URL |
| latitude | numeric | GPS latitude |
| longitude | numeric | GPS longitude |
| company_id | uuid | FK to main_companies |
| contact_ids | uuid[] | Array of contact IDs |
| is_main_branch | boolean | Main branch flag |
| safety_standard | text | Safety standard level |

### child_site_comments

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| site_id | uuid | FK to main_sites |
| author_id | uuid | FK to main_employees |
| content | text | Comment text |
| mentioned_employee_ids | uuid[] | Mentioned employee IDs |
| is_edited | boolean | Edit flag |
| created_at | timestamptz | Creation timestamp |
| updated_at | timestamptz | Update timestamp |

### child_site_comment_photos

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| comment_id | uuid | FK to child_site_comments |
| image_url | text | Image URL |
| display_order | integer | Display order |
| created_at | timestamptz | Creation timestamp |

### child_site_comment_files

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| comment_id | uuid | FK to child_site_comments |
| file_url | text | File URL |
| file_name | text | Original file name |
| file_size | integer | File size in bytes |
| mime_type | text | MIME type |
| created_at | timestamptz | Creation timestamp |

---

## Related Endpoints

- **Companies API** (`/api-companies`) - Manage company data linked to sites
- **Tickets API** (`/api-tickets`) - Work orders assigned to sites
- **Merchandise API** (`/api-merchandise`) - Equipment installed at sites
