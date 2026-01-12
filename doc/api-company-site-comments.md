# Company & Site Comments API

API สำหรับจัดการความคิดเห็นของบริษัท (Company) และไซต์ (Site) - ทำงานเหมือนกับ Ticket Comments ทุกประการ

## Overview

| Feature | Description |
|---------|-------------|
| @Mention Support | รองรับ `@[uuid]` หรือ `@employee_code` |
| Photo Attachments | รูปภาพพร้อม display order |
| File Attachments | ไฟล์พร้อม metadata (ชื่อไฟล์, ขนาด, mime type) |
| Pagination | รองรับ page และ limit |
| Edit Tracking | `is_edited` flag บอกว่าถูกแก้ไขหรือไม่ |
| Authorization | แก้ไขได้เฉพาะผู้เขียน, ลบได้โดยผู้เขียนหรือ admin |

---

## Company Comments API

### Base URL
```
/api-companies/:companyId/comments
```

### 1. Get Comments

```http
GET /api-companies/:companyId/comments?page=1&limit=50
```

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| page | number | 1 | หน้าที่ต้องการ |
| limit | number | 50 | จำนวนรายการต่อหน้า |

**Response:**
```json
{
  "data": {
    "data": [
      {
        "id": "uuid",
        "company_id": "uuid",
        "author_id": "uuid",
        "content": "ข้อความความคิดเห็น @[uuid] หรือ @employee_code",
        "mentioned_employee_ids": ["uuid1", "uuid2"],
        "is_edited": false,
        "created_at": "2026-01-12T10:00:00.000Z",
        "updated_at": "2026-01-12T10:00:00.000Z",
        "author": {
          "id": "uuid",
          "name": "นาย สมชาย ใจดี",
          "code": "EMP001",
          "nickname": "สมชาย",
          "profile_image_url": "https://..."
        },
        "photos": [
          {
            "id": "uuid",
            "image_url": "https://...",
            "display_order": 0,
            "created_at": "2026-01-12T10:00:00.000Z"
          }
        ],
        "files": [
          {
            "id": "uuid",
            "file_url": "https://...",
            "file_name": "document.pdf",
            "file_size": 1024,
            "mime_type": "application/pdf",
            "created_at": "2026-01-12T10:00:00.000Z"
          }
        ]
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 100,
      "totalPages": 2
    }
  }
}
```

---

### 2. Create Comment

```http
POST /api-companies/:companyId/comments
```

**Request Body:**
```json
{
  "content": "ข้อความความคิดเห็น สามารถ mention ได้ @[uuid] หรือ @EMP001",
  "photos": [
    {
      "image_url": "https://storage.../photo.jpg",
      "display_order": 0
    }
  ],
  "files": [
    {
      "file_url": "https://storage.../document.pdf",
      "file_name": "document.pdf",
      "file_size": 1024,
      "mime_type": "application/pdf"
    }
  ]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| content | string | ✅ | เนื้อหาความคิดเห็น |
| photos | array | ❌ | รูปภาพแนบ |
| photos[].image_url | string | ✅ | URL ของรูปภาพ |
| photos[].display_order | number | ❌ | ลำดับการแสดง (default: index) |
| files | array | ❌ | ไฟล์แนบ |
| files[].file_url | string | ✅ | URL ของไฟล์ |
| files[].file_name | string | ✅ | ชื่อไฟล์ |
| files[].file_size | number | ❌ | ขนาดไฟล์ (bytes) |
| files[].mime_type | string | ❌ | MIME type ของไฟล์ |

**Response (201 Created):**
```json
{
  "data": {
    "id": "uuid",
    "company_id": "uuid",
    "author_id": "uuid",
    "content": "ข้อความความคิดเห็น",
    "mentioned_employee_ids": ["uuid1"],
    "is_edited": false,
    "created_at": "2026-01-12T10:00:00.000Z",
    "updated_at": "2026-01-12T10:00:00.000Z",
    "author": {
      "id": "uuid",
      "name": "นาย สมชาย ใจดี",
      "code": "EMP001",
      "nickname": "สมชาย",
      "profile_image_url": "https://..."
    },
    "photos": [...],
    "files": [...]
  }
}
```

---

### 3. Update Comment

```http
PUT /api-companies/:companyId/comments/:commentId
```

**Authorization:** เฉพาะผู้เขียนเท่านั้น

**Request Body:**
```json
{
  "content": "ข้อความที่แก้ไขแล้ว",
  "photos": [
    {
      "image_url": "https://storage.../new-photo.jpg",
      "display_order": 0
    }
  ],
  "files": [
    {
      "file_url": "https://storage.../new-document.pdf",
      "file_name": "new-document.pdf",
      "file_size": 2048,
      "mime_type": "application/pdf"
    }
  ]
}
```

**Notes:**
- `is_edited` จะถูก set เป็น `true` อัตโนมัติ
- ถ้าส่ง `photos` มา จะลบรูปเก่าทั้งหมดและใส่รูปใหม่ (replace ไม่ใช่ merge)
- ถ้าส่ง `files` มา จะลบไฟล์เก่าทั้งหมดและใส่ไฟล์ใหม่ (replace ไม่ใช่ merge)
- ถ้าไม่ส่ง `photos` หรือ `files` มา จะคงของเดิมไว้

**Response:**
```json
{
  "data": {
    "id": "uuid",
    "company_id": "uuid",
    "author_id": "uuid",
    "content": "ข้อความที่แก้ไขแล้ว",
    "mentioned_employee_ids": [],
    "is_edited": true,
    "created_at": "2026-01-12T10:00:00.000Z",
    "updated_at": "2026-01-12T10:05:00.000Z",
    "author": {...},
    "photos": [...],
    "files": [...]
  }
}
```

---

### 4. Delete Comment

```http
DELETE /api-companies/:companyId/comments/:commentId
```

**Authorization:** ผู้เขียน หรือ Admin (level 2+)

**Response:**
```json
{
  "data": {
    "message": "ลบความคิดเห็นสำเร็จ"
  }
}
```

---

## Site Comments API

### Base URL
```
/api-sites/:siteId/comments
```

### 1. Get Comments

```http
GET /api-sites/:siteId/comments?page=1&limit=50
```

**Response:** เหมือนกับ Company Comments แต่ใช้ `site_id` แทน `company_id`

```json
{
  "data": {
    "data": [
      {
        "id": "uuid",
        "site_id": "uuid",
        "author_id": "uuid",
        "content": "...",
        ...
      }
    ],
    "pagination": {...}
  }
}
```

---

### 2. Create Comment

```http
POST /api-sites/:siteId/comments
```

**Request Body:** เหมือนกับ Company Comments

---

### 3. Update Comment

```http
PUT /api-sites/:siteId/comments/:commentId
```

**Authorization:** เฉพาะผู้เขียนเท่านั้น

**Request Body:** เหมือนกับ Company Comments

---

### 4. Delete Comment

```http
DELETE /api-sites/:siteId/comments/:commentId
```

**Authorization:** ผู้เขียน หรือ Admin (level 2+)

---

## @Mention Format

รองรับ 2 รูปแบบ:

| Format | Example | Description |
|--------|---------|-------------|
| UUID | `@[550e8400-e29b-41d4-a716-446655440000]` | Mention โดยใช้ UUID โดยตรง |
| Code | `@EMP001` | Mention โดยใช้รหัสพนักงาน (case-insensitive) |

**Notes:**
- ระบบจะ validate ว่า employee มีอยู่จริงและ `is_active = true`
- `mentioned_employee_ids` จะเก็บเฉพาะ UUIDs ที่ valid เท่านั้น
- ถ้า mention employee ที่ไม่มีอยู่จริง จะถูก ignore

---

## File Upload

ใช้ Storage Bucket: `comment-attachments`

### Supported MIME Types

**Images:**
- `image/jpeg`
- `image/png`
- `image/gif`
- `image/webp`

**Documents:**
- `application/pdf`
- `application/msword`
- `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
- `application/vnd.ms-excel`
- `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- `text/plain`
- `text/csv`

### File Size Limit
- Maximum: **10 MB** per file

### Upload Flow
1. Upload file ไปที่ Storage bucket `comment-attachments`
2. ได้ public URL กลับมา
3. ส่ง URL พร้อม metadata ใน request body

---

## Error Responses

| Status | Error | Description |
|--------|-------|-------------|
| 400 | `กรุณาระบุเนื้อหาความคิดเห็น` | Content ว่างเปล่า |
| 403 | `ไม่มีสิทธิ์แก้ไขความคิดเห็นนี้` | ไม่ใช่ผู้เขียน |
| 403 | `ไม่มีสิทธิ์ลบความคิดเห็นนี้` | ไม่ใช่ผู้เขียนและไม่ใช่ admin |
| 404 | `ไม่พบบริษัทที่ระบุ` | Company ID ไม่ถูกต้อง |
| 404 | `ไม่พบไซต์ที่ระบุ` | Site ID ไม่ถูกต้อง |
| 404 | `ไม่พบความคิดเห็นที่ระบุ` | Comment ID ไม่ถูกต้อง |

---

## TypeScript Interfaces

```typescript
interface CommentPhotoInput {
  image_url: string;
  display_order?: number;
}

interface CommentFileInput {
  file_url: string;
  file_name: string;
  file_size?: number;
  mime_type?: string;
}

interface CommentCreateInput {
  content: string;
  photos?: CommentPhotoInput[];
  files?: CommentFileInput[];
}

interface CommentUpdateInput {
  content: string;
  photos?: CommentPhotoInput[];
  files?: CommentFileInput[];
}

interface CommentPhoto {
  id: string;
  image_url: string;
  display_order: number;
  created_at: string;
}

interface CommentFile {
  id: string;
  file_url: string;
  file_name: string;
  file_size?: number;
  mime_type?: string;
  created_at: string;
}

interface CommentAuthor {
  id: string;
  name: string;
  code: string;
  nickname?: string;
  profile_image_url?: string;
}

interface CompanyComment {
  id: string;
  company_id: string;
  author_id: string;
  content: string;
  mentioned_employee_ids: string[];
  is_edited: boolean;
  created_at: string;
  updated_at: string;
  author?: CommentAuthor | null;
  photos?: CommentPhoto[];
  files?: CommentFile[];
}

interface SiteComment {
  id: string;
  site_id: string;
  author_id: string;
  content: string;
  mentioned_employee_ids: string[];
  is_edited: boolean;
  created_at: string;
  updated_at: string;
  author?: CommentAuthor | null;
  photos?: CommentPhoto[];
  files?: CommentFile[];
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface CommentsResponse {
  data: {
    data: (CompanyComment | SiteComment)[];
    pagination: Pagination;
  };
}
```

---

## Comparison with Ticket Comments

| Feature | Company/Site Comments | Ticket Comments |
|---------|----------------------|-----------------|
| @Mention | ✅ | ✅ |
| Photos | ✅ | ✅ |
| Files | ✅ | ✅ |
| Edit tracking | ✅ | ✅ |
| Pagination | ✅ | ✅ |
| Author-only edit | ✅ | ✅ |
| Admin delete | ✅ | ✅ |
| Notifications | ❌ | ✅ |
| Audit log | ❌ | ✅ |

**Note:** Company/Site Comments ไม่มี notifications และ audit log ต่างจาก Ticket Comments
