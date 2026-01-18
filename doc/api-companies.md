# API Companies

## Overview

The Companies API manages company data in the Field Service Management system. Companies are business entities identified by their Thai tax ID (13-digit) as a natural key.

This API allows users to:
- Search and retrieve company information
- Create, update, and delete companies
- Manage company comments with photos and file attachments
- Quick search (hint) for autocomplete functionality

---

## Base URL

```
/api-companies
```

---

## Authentication

All endpoints require a valid JWT token in the Authorization header.

```
Authorization: Bearer <jwt_token>
```

**Permission Levels:**
| Level | Role | Capabilities |
|-------|------|--------------|
| 0 | Technician L1 | Read-only (search, get, list comments) |
| 1 | Assigner, PM, Sales | Create, update, delete companies |
| 2+ | Admin | Delete any comment (not just own) |

---

## Endpoints Summary

| Method | Path | Description | Min Level |
|--------|------|-------------|-----------|
| GET | `/global-search` | Search companies with pagination | 0 |
| GET | `/hint` | Quick search (up to 5 results) | 0 |
| GET | `/:id` | Get company by ID or tax_id | 0 |
| POST | `/` | Create new company | 1 |
| POST | `/create-or-update` | Upsert company by tax_id | 1 |
| PUT | `/:id` | Update company | 1 |
| DELETE | `/:id` | Delete company | 1 |
| GET | `/:id/comments` | Get company comments | 0 |
| POST | `/:id/comments` | Add comment | 0 |
| PUT | `/:id/comments/:commentId` | Update comment | 0 |
| DELETE | `/:id/comments/:commentId` | Delete comment | 0 |

---

## Endpoints

### 1. Global Search Companies

Search companies by name or tax ID with pagination.

**Request**

```
GET /api-companies/global-search
```

**Query Parameters**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `q` | string | No | - | Search query (min 2 characters). Searches name_th, name_en, and tax_id |
| `page` | integer | No | 1 | Page number (minimum: 1) |
| `limit` | integer | No | 20 | Items per page (1-100) |

**Response**

```json
{
  "data": {
    "data": [
      {
        "id": "uuid",
        "tax_id": "1234567890123",
        "name_th": "บริษัท ตัวอย่าง จำกัด",
        "name_en": "Example Company Co., Ltd.",
        "description": "123 ถนนสุขุมวิท เขตวัฒนา กรุงเทพฯ 10110"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "totalPages": 8,
      "hasNext": true,
      "hasPrevious": false
    }
  }
}
```

**Example Request**

```bash
# Search companies containing "ABC"
curl -X GET "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-companies/global-search?q=ABC&page=1&limit=10" \
  -H "Authorization: Bearer <token>"

# List all companies (no search filter)
curl -X GET "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-companies/global-search" \
  -H "Authorization: Bearer <token>"
```

---

### 2. Get Company Hints

Quick search for autocomplete functionality. Returns up to 5 companies.

**Request**

```
GET /api-companies/hint
```

**Query Parameters**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `q` | string | No | "" | Search query. If empty, returns 5 most recent companies |

**Response**

```json
{
  "data": [
    {
      "id": "uuid",
      "tax_id": "1234567890123",
      "name_th": "บริษัท ตัวอย่าง จำกัด",
      "name_en": "Example Company Co., Ltd.",
      "type": "บริษัทจำกัด",
      "status": "active",
      "address_detail": "123 ถนนสุขุมวิท เขตวัฒนา กรุงเทพฯ 10110",
      "created_at": "2024-01-15T10:30:00Z",
      "updated_at": "2024-01-15T10:30:00Z"
    }
  ]
}
```

**Example Request**

```bash
# Search companies with "บริษัท"
curl -X GET "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-companies/hint?q=บริษัท" \
  -H "Authorization: Bearer <token>"

# Get 5 most recent companies
curl -X GET "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-companies/hint" \
  -H "Authorization: Bearer <token>"
```

---

### 3. Get Company by ID

Retrieve a single company with its associated sites.

**Request**

```
GET /api-companies/:id
```

**Path Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Company UUID or tax_id (13-digit) |

**Response**

```json
{
  "data": {
    "id": "uuid",
    "tax_id": "1234567890123",
    "name_th": "บริษัท ตัวอย่าง จำกัด",
    "name_en": "Example Company Co., Ltd.",
    "type": "บริษัทจำกัด",
    "status": "active",
    "objective": "ประกอบธุรกิจบริการ",
    "objective_code": "123456",
    "register_date": "2020-01-01",
    "register_capital": 1000000,
    "branch_name": "สำนักงานใหญ่",
    "address_full": "123 ถนนสุขุมวิท แขวงคลองตัน เขตวัฒนา กรุงเทพมหานคร 10110",
    "address_no": "123",
    "address_moo": null,
    "address_building": "อาคารตัวอย่าง",
    "address_floor": "5",
    "address_room_no": "501",
    "address_soi": "สุขุมวิท 21",
    "address_yaek": null,
    "address_trok": null,
    "address_village": null,
    "address_road": "สุขุมวิท",
    "address_tambon": "คลองตัน",
    "address_district": "วัฒนา",
    "address_province": "กรุงเทพมหานคร",
    "address_tambon_code": "103901",
    "address_district_code": "1039",
    "address_province_code": "10",
    "address_detail": "123 ถนนสุขุมวิท เขตวัฒนา กรุงเทพฯ 10110",
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T10:30:00Z",
    "main-site": {
      "id": "uuid",
      "name": "สำนักงานใหญ่"
    },
    "sites": [
      {
        "id": "uuid",
        "name": "สาขาสาทร"
      },
      {
        "id": "uuid",
        "name": "สาขาพระราม 9"
      }
    ]
  }
}
```

**Example Request**

```bash
# Get by UUID
curl -X GET "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-companies/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer <token>"

# Get by tax_id
curl -X GET "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-companies/1234567890123" \
  -H "Authorization: Bearer <token>"
```

---

### 4. Create Company

Create a new company. If a company with the same tax_id already exists, it will be updated (upsert behavior).

**Request**

```
POST /api-companies
```

**Request Body**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `tax_id` | string | No | 13-digit Thai tax ID (used as natural key) |
| `name_th` | string | Yes | Company name in Thai |
| `name_en` | string | Yes | Company name in English |
| `type` | string | No | Company type (e.g., "บริษัทจำกัด") |
| `status` | string | No | Company status |
| `objective` | string | No | Business objective |
| `objective_code` | string | No | Objective code |
| `register_date` | date | No | Registration date |
| `register_capital` | number | No | Registered capital |
| `branch_name` | string | No | Branch name |
| `address_full` | string | No | Full address |
| `address_no` | string | No | House/building number |
| `address_moo` | string | No | Moo (village number) |
| `address_building` | string | No | Building name |
| `address_floor` | string | No | Floor number |
| `address_room_no` | string | No | Room number |
| `address_soi` | string | No | Soi (lane) |
| `address_yaek` | string | No | Yaek (sub-lane) |
| `address_trok` | string | No | Trok (alley) |
| `address_village` | string | No | Village name |
| `address_road` | string | No | Road name |
| `address_tambon` | string | No | Sub-district name |
| `address_district` | string | No | District name |
| `address_province` | string | No | Province name |
| `address_tambon_code` | string | No | Sub-district code |
| `address_district_code` | string | No | District code |
| `address_province_code` | string | No | Province code |
| `address_detail` | string | No | Aggregated address description |

**Response**

```json
{
  "data": {
    "id": "uuid",
    "tax_id": "1234567890123",
    "name_th": "บริษัท ตัวอย่าง จำกัด",
    "name_en": "Example Company Co., Ltd.",
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T10:30:00Z"
  }
}
```

**Example Request**

```bash
curl -X POST "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-companies" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "tax_id": "1234567890123",
    "name_th": "บริษัท ตัวอย่าง จำกัด",
    "name_en": "Example Company Co., Ltd.",
    "type": "บริษัทจำกัด",
    "address_province": "กรุงเทพมหานคร"
  }'
```

---

### 5. Create or Update Company

Explicitly upsert a company by tax_id. If tax_id exists, updates the record; otherwise creates new.

**Request**

```
POST /api-companies/create-or-update
```

**Request Body**

Same as Create Company endpoint.

**Response**

Same as Create Company endpoint.

**Example Request**

```bash
curl -X POST "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-companies/create-or-update" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "tax_id": "1234567890123",
    "name_th": "บริษัท ตัวอย่างใหม่ จำกัด",
    "name_en": "New Example Company Co., Ltd."
  }'
```

---

### 6. Update Company

Update an existing company.

**Request**

```
PUT /api-companies/:id
```

**Path Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Company UUID or tax_id (13-digit) |

**Request Body**

Any fields from the Create Company request body (except `tax_id` which cannot be changed).

**Response**

Returns the updated company object.

**Example Request**

```bash
curl -X PUT "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-companies/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name_th": "บริษัท ตัวอย่างอัพเดท จำกัด",
    "address_detail": "456 ถนนสีลม เขตบางรัก กรุงเทพฯ"
  }'
```

---

### 7. Delete Company

Delete a company by ID or tax_id.

**Request**

```
DELETE /api-companies/:id
```

**Path Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Company UUID or tax_id (13-digit) |

**Response**

```json
{
  "data": {
    "message": "ลบบริษัทสำเร็จ"
  }
}
```

**Example Request**

```bash
curl -X DELETE "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-companies/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer <token>"
```

---

## Comment Endpoints

### 8. Get Company Comments

Retrieve comments for a company with pagination.

**Request**

```
GET /api-companies/:id/comments
```

**Path Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | uuid | Company UUID |

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
        "company_id": "uuid",
        "author_id": "uuid",
        "content": "นี่คือความคิดเห็นตัวอย่าง @[employee-uuid]",
        "mentioned_employee_ids": ["employee-uuid"],
        "is_edited": false,
        "created_at": "2024-01-15T10:30:00Z",
        "updated_at": "2024-01-15T10:30:00Z",
        "author": {
          "id": "uuid",
          "name": "สมชาย ใจดี",
          "code": "EMP001",
          "nickname": "ชาย",
          "profile_image_url": "https://example.com/photo.jpg"
        },
        "photos": [
          {
            "id": "uuid",
            "image_url": "https://storage.example.com/photo1.jpg",
            "display_order": 0,
            "created_at": "2024-01-15T10:30:00Z"
          }
        ],
        "files": [
          {
            "id": "uuid",
            "file_url": "https://storage.example.com/document.pdf",
            "file_name": "document.pdf",
            "file_size": 1024000,
            "mime_type": "application/pdf",
            "created_at": "2024-01-15T10:30:00Z"
          }
        ]
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

**Example Request**

```bash
curl -X GET "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-companies/550e8400-e29b-41d4-a716-446655440000/comments?page=1&limit=20" \
  -H "Authorization: Bearer <token>"
```

---

### 9. Create Company Comment

Add a new comment to a company.

**Request**

```
POST /api-companies/:id/comments
```

**Path Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | uuid | Company UUID |

**Request Body**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `content` | string | Yes | Comment text. Supports @mentions: `@[uuid]` or `@employee_code` |
| `photos` | array | No | Array of photo objects |
| `photos[].image_url` | string | Yes | URL of the image |
| `photos[].display_order` | integer | No | Display order (default: array index) |
| `files` | array | No | Array of file objects |
| `files[].file_url` | string | Yes | URL of the file |
| `files[].file_name` | string | Yes | File name |
| `files[].file_size` | integer | No | File size in bytes |
| `files[].mime_type` | string | No | MIME type |

**Response**

Returns the created comment object (HTTP 201).

**Example Request**

```bash
curl -X POST "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-companies/550e8400-e29b-41d4-a716-446655440000/comments" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "ติดต่อลูกค้าแล้ว รอการตอบกลับ @EMP001",
    "photos": [
      {
        "image_url": "https://storage.example.com/photo1.jpg",
        "display_order": 0
      }
    ],
    "files": [
      {
        "file_url": "https://storage.example.com/contract.pdf",
        "file_name": "contract.pdf",
        "file_size": 2048000,
        "mime_type": "application/pdf"
      }
    ]
  }'
```

---

### 10. Update Company Comment

Update an existing comment. Only the comment author can update.

**Request**

```
PUT /api-companies/:id/comments/:commentId
```

**Path Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | uuid | Company UUID |
| `commentId` | uuid | Comment UUID |

**Request Body**

Same as Create Comment. Note: if `photos` or `files` arrays are provided, existing items are replaced entirely.

**Response**

Returns the updated comment object. `is_edited` will be set to `true`.

**Example Request**

```bash
curl -X PUT "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-companies/550e8400-e29b-41d4-a716-446655440000/comments/660e8400-e29b-41d4-a716-446655440001" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "อัพเดท: ลูกค้าตอบกลับแล้ว นัดประชุมวันพรุ่งนี้"
  }'
```

---

### 11. Delete Company Comment

Delete a comment. The comment author can delete their own comments. Admins (level 2+) can delete any comment.

**Request**

```
DELETE /api-companies/:id/comments/:commentId
```

**Path Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | uuid | Company UUID |
| `commentId` | uuid | Comment UUID |

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
curl -X DELETE "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-companies/550e8400-e29b-41d4-a716-446655440000/comments/660e8400-e29b-41d4-a716-446655440001" \
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
| 400 | กรุณาระบุ {field} | Required field is missing |
| 400 | กรุณาระบุเนื้อหาความคิดเห็น | Comment content is empty |
| 401 | ไม่มีสิทธิ์เข้าถึง | Missing or invalid authentication token |
| 403 | ไม่มีสิทธิ์แก้ไขความคิดเห็นนี้ | Not authorized to edit this comment |
| 403 | ไม่มีสิทธิ์ลบความคิดเห็นนี้ | Not authorized to delete this comment |
| 403 | ระดับสิทธิ์ไม่เพียงพอ | Insufficient permission level |
| 404 | ไม่พบข้อมูลบริษัท | Company not found |
| 404 | ไม่พบบริษัทที่ระบุ | Company not found (comments) |
| 404 | ไม่พบความคิดเห็นที่ระบุ | Comment not found |
| 404 | Not found | Invalid endpoint path |
| 500 | Database error message | Internal database error |

---

## Mention Syntax

Comments support @mentions in two formats:

1. **UUID format**: `@[uuid]` - Direct employee UUID reference
2. **Code format**: `@employee_code` - Employee code lookup

Example:
```
ติดต่อ @[550e8400-e29b-41d4-a716-446655440000] และ @EMP001 แล้ว
```

Mentioned employee IDs are stored in `mentioned_employee_ids` array for notification purposes.

---

## Database Tables

### main_companies

Primary company data table.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key (auto-generated) |
| tax_id | varchar(13) | Thai tax ID (unique natural key) |
| name_th | text | Company name in Thai |
| name_en | text | Company name in English |
| type | text | Company type |
| status | text | Company status |
| objective | text | Business objective |
| objective_code | text | Objective code |
| register_date | date | Registration date |
| register_capital | numeric | Registered capital |
| branch_name | text | Branch name |
| address_* | text | Various address fields |
| created_at | timestamptz | Creation timestamp |
| updated_at | timestamptz | Last update timestamp |

### child_company_comments

Company comments table (1:N relationship with main_companies).

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| company_id | uuid | FK to main_companies |
| author_id | uuid | FK to main_employees |
| content | text | Comment text |
| mentioned_employee_ids | uuid[] | Array of mentioned employee IDs |
| is_edited | boolean | Whether comment has been edited |
| created_at | timestamptz | Creation timestamp |
| updated_at | timestamptz | Last update timestamp |

### child_company_comment_photos

Comment photos table (1:N relationship with comments).

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| comment_id | uuid | FK to child_company_comments |
| image_url | text | Image URL |
| display_order | integer | Display order |
| created_at | timestamptz | Creation timestamp |

### child_company_comment_files

Comment files table (1:N relationship with comments).

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| comment_id | uuid | FK to child_company_comments |
| file_url | text | File URL |
| file_name | text | File name |
| file_size | bigint | File size in bytes |
| mime_type | text | MIME type |
| created_at | timestamptz | Creation timestamp |

---

## Related Endpoints

- **Sites API** (`/api-sites`) - Manage sites linked to companies
- **Contacts API** (`/api-contacts`) - Manage contacts for company sites
- **Tickets API** (`/api-tickets`) - Work orders linked to company sites
