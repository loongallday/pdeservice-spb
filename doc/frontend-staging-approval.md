# Frontend Staging Approval - Implementation Guide

## Overview

ระบบอนุมัติไฟล์ที่ช่างเทคนิคส่งมาผ่าน LINE Bot ผู้อนุมัติสามารถดูรายการไฟล์, อนุมัติ, หรือปฏิเสธไฟล์ได้ผ่าน Web App

## Workflow

```
1. ช่างส่งรูป/ไฟล์ผ่าน LINE → status: pending
2. ช่างพิมพ์รหัสตั๋ว (PDE-XXX) → status: linked
3. ผู้อนุมัติดูรายการใน Web App
4. ผู้อนุมัติอนุมัติ/ปฏิเสธ → status: approved/rejected
5. ถ้าอนุมัติ → สร้าง comment + แนบไฟล์ลงตั๋วอัตโนมัติ
```

---

## API Base URL

```
https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-staging
```

## Authorization

ทุก request ต้องมี JWT token ใน header:
```
Authorization: Bearer {JWT_TOKEN}
```

**Required Permission:** `canApproveAppointments` (role level >= 1 หรือมี permission flag)

---

## Status Values

| Status | Description | Thai |
|--------|-------------|------|
| `pending` | ไฟล์อัพโหลดแล้ว รอเชื่อมตั๋ว | รอเชื่อมต่อ |
| `linked` | เชื่อมตั๋วแล้ว รออนุมัติ | รออนุมัติ |
| `approved` | อนุมัติแล้ว | อนุมัติแล้ว |
| `rejected` | ปฏิเสธแล้ว | ปฏิเสธ |
| `expired` | หมดอายุ (30 วัน) | หมดอายุ |

---

## API Endpoints

### 1. List Staged Files

รายการไฟล์ทั้งหมด (สำหรับหน้า Approval Queue)

```http
GET /files?status=linked&page=1&limit=20
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | string | Filter by status: `pending`, `linked`, `approved`, `rejected`, `expired`. ใช้ comma แยกหลายค่าได้ เช่น `linked,pending` |
| `employee_id` | uuid | Filter by employee who uploaded |
| `ticket_id` | uuid | Filter by linked ticket |
| `page` | number | Page number (default: 1) |
| `limit` | number | Items per page (default: 50, max: 100) |

**Response:**

```json
{
  "data": {
    "data": [
      {
        "id": "uuid",
        "employee_id": "uuid",
        "file_url": "https://...",
        "file_name": "photo_123.jpg",
        "file_size": 1024000,
        "mime_type": "image/jpeg",
        "ticket_id": "uuid",
        "status": "linked",
        "approved_by": null,
        "approved_at": null,
        "rejection_reason": null,
        "result_comment_id": null,
        "expires_at": "2026-02-12T07:47:18.000Z",
        "source": "line",
        "metadata": { "line_message_id": "..." },
        "created_at": "2026-01-13T07:47:18.000Z",
        "updated_at": "2026-01-13T07:47:18.000Z",
        "employee": {
          "id": "uuid",
          "name": "สมชาย ใจดี",
          "code": "EMP001",
          "nickname": "ชาย",
          "profile_image_url": "https://..."
        },
        "ticket": {
          "id": "uuid",
          "ticket_code": "PDE-893",
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
      "limit": 20,
      "total": 45,
      "totalPages": 3
    }
  }
}
```

---

### 2. Get Single File

ดูรายละเอียดไฟล์เดียว

```http
GET /files/:id
```

**Response:** Same as single item in list

---

### 3. Approve File

อนุมัติไฟล์ → สร้าง comment บนตั๋วอัตโนมัติ

```http
POST /files/:id/approve
Content-Type: application/json

{
  "comment_content": "ไฟล์แนบจากช่าง: photo_123.jpg"  // Optional
}
```

**Request Body (Optional):**

| Field | Type | Description |
|-------|------|-------------|
| `comment_content` | string | Custom comment content. ถ้าไม่ระบุจะใช้ default: "ไฟล์แนบจาก {ชื่อช่าง}: {ชื่อไฟล์}" |

**Response:**

```json
{
  "data": {
    "id": "uuid",
    "status": "approved",
    "approved_by": "uuid",
    "approved_at": "2026-01-13T08:00:00.000Z",
    "result_comment_id": "uuid",
    "employee": { ... },
    "ticket": { ... },
    "approver": {
      "id": "uuid",
      "name": "ผู้จัดการ",
      "code": "MGR001"
    }
  }
}
```

**Side Effects:**
- สร้าง `child_ticket_comments` record
- ถ้าเป็นรูปภาพ → สร้าง `child_comment_photos` record
- ถ้าเป็นไฟล์อื่น → สร้าง `child_comment_files` record

---

### 4. Reject File

ปฏิเสธไฟล์พร้อมเหตุผล

```http
POST /files/:id/reject
Content-Type: application/json

{
  "reason": "รูปภาพไม่ชัดเจน กรุณาถ่ายใหม่"
}
```

**Request Body (Required):**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `reason` | string | Yes | เหตุผลในการปฏิเสธ |

**Response:**

```json
{
  "data": {
    "id": "uuid",
    "status": "rejected",
    "approved_by": "uuid",
    "approved_at": "2026-01-13T08:00:00.000Z",
    "rejection_reason": "รูปภาพไม่ชัดเจน กรุณาถ่ายใหม่",
    "employee": { ... },
    "ticket": { ... },
    "approver": { ... }
  }
}
```

---

### 5. Bulk Approve

อนุมัติหลายไฟล์พร้อมกัน - **จัดกลุ่มตามตั๋วและสร้าง 1 comment ต่อ 1 ตั๋ว**

```http
POST /files/bulk-approve
Content-Type: application/json

{
  "file_ids": ["uuid1", "uuid2", "uuid3"],
  "comment_content": "อนุมัติไฟล์แนบ"  // Optional
}
```

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file_ids` | string[] | Yes | Array of file IDs to approve |
| `comment_content` | string | No | Custom comment for all files. ถ้าไม่ระบุจะสร้างอัตโนมัติ |

**Behavior:**
- ไฟล์ที่อยู่ในตั๋วเดียวกันจะถูกรวมเป็น **1 comment**
- รูปภาพทั้งหมดจะถูกแนบใน `child_comment_photos`
- ไฟล์อื่นๆ จะถูกแนบใน `child_comment_files`
- ถ้าไม่ระบุ `comment_content` จะสร้างอัตโนมัติ:
  ```
  ไฟล์แนบจาก สมชาย, สมหญิง:
  • photo_1.jpg
  • photo_2.jpg
  • document.pdf
  ```

**Response:**

```json
{
  "data": {
    "approved": ["uuid1", "uuid2"],
    "failed": [
      {
        "id": "uuid3",
        "error": "ไฟล์นี้ต้องอยู่ในสถานะ \"linked\" ก่อนอนุมัติ"
      }
    ]
  }
}
```

---

### 6. Delete File

ลบไฟล์ (ไม่สามารถลบไฟล์ที่ approved แล้ว)

```http
DELETE /files/:id
```

**Response:**

```json
{
  "data": {
    "deleted": true
  }
}
```

**Error Cases:**
- `404` - ไม่พบไฟล์
- `400` - ไม่สามารถลบไฟล์ที่ได้รับการอนุมัติแล้ว

---

### 7. List Files Grouped by Ticket

รายการไฟล์จัดกลุ่มตามตั๋ว (สำหรับ UI แบบ Kanban หรือแสดงเป็นกลุ่ม)

```http
GET /files/grouped?status=linked,approved
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | string | Filter by status: `pending`, `linked`, `approved`, `rejected`, `expired`. ใช้ comma แยกหลายค่าได้ |
| `employee_id` | uuid | Filter by employee who uploaded |

**Response:**

```json
{
  "data": {
    "groups": [
      {
        "ticket": {
          "id": "uuid",
          "ticket_code": "PDE-893",
          "work_type": {
            "code": "pm",
            "name": "บำรุงรักษา"
          }
        },
        "files": [
          {
            "id": "uuid",
            "file_name": "photo_1.jpg",
            "file_url": "https://...",
            "file_size": 1024000,
            "mime_type": "image/jpeg",
            "status": "linked",
            "created_at": "2026-01-13T08:00:00.000Z",
            "employee": { ... },
            "approver": null
          },
          {
            "id": "uuid",
            "file_name": "photo_2.jpg",
            "...": "..."
          }
        ],
        "file_count": 2
      },
      {
        "ticket": {
          "id": "uuid",
          "ticket_code": "PDE-894",
          "work_type": { ... }
        },
        "files": [ ... ],
        "file_count": 3
      },
      {
        "ticket": null,
        "files": [
          {
            "id": "uuid",
            "file_name": "unlinked_photo.jpg",
            "status": "pending",
            "...": "..."
          }
        ],
        "file_count": 1
      }
    ],
    "summary": {
      "total_files": 6,
      "total_groups": 3,
      "by_status": {
        "pending": 1,
        "linked": 3,
        "approved": 2,
        "rejected": 0,
        "expired": 0
      }
    }
  }
}
```

**Notes:**
- Groups are sorted by most recent file (newest first)
- Files without ticket (status: `pending`) are grouped under `ticket: null` at the end
- Each group contains full file details with relations

---

## Frontend Implementation

### Suggested Pages

#### 1. Approval Queue Page (`/staging/approval`)

แสดงรายการไฟล์รออนุมัติ

```tsx
// Fetch files waiting for approval
const { data } = await api.get('/api-staging/files', {
  params: {
    status: 'linked',
    page: 1,
    limit: 20
  }
});
```

**Features:**
- Filter by status (tabs: รออนุมัติ / อนุมัติแล้ว / ปฏิเสธ / ทั้งหมด)
- Filter by employee
- Filter by ticket
- Preview file (image/PDF viewer)
- Quick approve/reject buttons
- Bulk select + approve

#### 1b. Grouped by Ticket View (`/staging/approval?view=grouped`)

แสดงไฟล์จัดกลุ่มตามตั๋ว (Kanban-style)

```tsx
// Fetch files grouped by ticket
const { data } = await stagingApi.listFilesGrouped({
  status: 'linked,approved'
});

// Render as grouped cards
{data.groups.map(group => (
  <TicketCard key={group.ticket?.id || 'unlinked'}>
    <TicketHeader>
      {group.ticket ? (
        <>
          <TicketCode>{group.ticket.ticket_code}</TicketCode>
          <WorkType>{group.ticket.work_type?.name}</WorkType>
        </>
      ) : (
        <span>ไฟล์ยังไม่ได้เชื่อมตั๋ว</span>
      )}
      <FileCount>{group.file_count} ไฟล์</FileCount>
    </TicketHeader>
    <FileList>
      {group.files.map(file => (
        <FileItem key={file.id} file={file} />
      ))}
    </FileList>
    {group.ticket && (
      <BulkActions>
        <Button onClick={() => bulkApprove(group.files.map(f => f.id))}>
          อนุมัติทั้งหมด
        </Button>
      </BulkActions>
    )}
  </TicketCard>
))}

// Summary stats
<Summary>
  <Stat>ไฟล์ทั้งหมด: {data.summary.total_files}</Stat>
  <Stat>รออนุมัติ: {data.summary.by_status.linked}</Stat>
  <Stat>อนุมัติแล้ว: {data.summary.by_status.approved}</Stat>
</Summary>
```

**Features:**
- Group files by ticket for easier batch approval
- Show summary statistics
- Bulk approve all files in a ticket
- Unlinked files grouped separately at the bottom

#### 2. File Preview Modal

```tsx
// Show file preview with approve/reject actions
<Modal>
  <FilePreview url={file.file_url} mimeType={file.mime_type} />
  <FileInfo>
    <div>ชื่อไฟล์: {file.file_name}</div>
    <div>ขนาด: {formatBytes(file.file_size)}</div>
    <div>ส่งโดย: {file.employee?.name}</div>
    <div>ตั๋ว: {file.ticket?.ticket_code}</div>
    <div>ส่งเมื่อ: {formatDate(file.created_at)}</div>
  </FileInfo>
  <Actions>
    <Button onClick={() => approve(file.id)}>อนุมัติ</Button>
    <Button onClick={() => openRejectModal(file.id)}>ปฏิเสธ</Button>
  </Actions>
</Modal>
```

#### 3. Reject Modal

```tsx
<Modal>
  <Textarea
    placeholder="กรุณาระบุเหตุผลในการปฏิเสธ"
    value={reason}
    onChange={setReason}
  />
  <Button onClick={() => reject(file.id, reason)}>ยืนยันปฏิเสธ</Button>
</Modal>
```

### TypeScript Types

```typescript
type StagedFileStatus = 'pending' | 'linked' | 'approved' | 'rejected' | 'expired';

interface StagedFile {
  id: string;
  employee_id: string;
  file_url: string;
  file_name: string;
  file_size: number | null;
  mime_type: string | null;
  ticket_id: string | null;
  status: StagedFileStatus;
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  result_comment_id: string | null;
  expires_at: string;
  source: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  employee?: {
    id: string;
    name: string;
    code: string;
    nickname?: string;
    profile_image_url?: string;
  } | null;
  ticket?: {
    id: string;
    ticket_code: string;
    work_type?: {
      code: string;
      name: string;
    } | null;
  } | null;
  approver?: {
    id: string;
    name: string;
    code: string;
    nickname?: string;
    profile_image_url?: string;
  } | null;
}

interface ApproveFileInput {
  comment_content?: string;
}

interface RejectFileInput {
  reason: string;
}

interface BulkApproveInput {
  file_ids: string[];
  comment_content?: string;
}

interface BulkApproveResult {
  approved: string[];
  failed: Array<{ id: string; error: string }>;
}

// Grouped files response
interface TicketGroup {
  ticket: {
    id: string;
    ticket_code: string;
    work_type?: {
      code: string;
      name: string;
    } | null;
  } | null;
  files: StagedFile[];
  file_count: number;
}

interface GroupedFilesResponse {
  groups: TicketGroup[];
  summary: {
    total_files: number;
    total_groups: number;
    by_status: {
      pending: number;
      linked: number;
      approved: number;
      rejected: number;
      expired: number;
    };
  };
}
```

### API Service Example

```typescript
// services/stagingApi.ts

const BASE_URL = '/api-staging';

export const stagingApi = {
  // List files
  listFiles: async (params: {
    status?: string;
    employee_id?: string;
    ticket_id?: string;
    page?: number;
    limit?: number;
  }) => {
    return api.get(`${BASE_URL}/files`, { params });
  },

  // Get single file
  getFile: async (id: string) => {
    return api.get(`${BASE_URL}/files/${id}`);
  },

  // Approve file
  approveFile: async (id: string, input?: ApproveFileInput) => {
    return api.post(`${BASE_URL}/files/${id}/approve`, input || {});
  },

  // Reject file
  rejectFile: async (id: string, input: RejectFileInput) => {
    return api.post(`${BASE_URL}/files/${id}/reject`, input);
  },

  // Bulk approve
  bulkApprove: async (input: BulkApproveInput) => {
    return api.post(`${BASE_URL}/files/bulk-approve`, input);
  },

  // Delete file
  deleteFile: async (id: string) => {
    return api.delete(`${BASE_URL}/files/${id}`);
  },

  // List files grouped by ticket
  listFilesGrouped: async (params: {
    status?: string;
    employee_id?: string;
  }): Promise<GroupedFilesResponse> => {
    return api.get(`${BASE_URL}/files/grouped`, { params });
  },
};
```

---

## Storage Bucket

ไฟล์ถูกเก็บใน Supabase Storage bucket: `staging-files`

**File URL Pattern:**
```
https://ogzyihacqbasolfxymgo.supabase.co/storage/v1/object/public/staging-files/{line_user_id}/{filename}
```

**Supported MIME Types:**
- Images: `image/jpeg`, `image/png`, `image/gif`, `image/webp`
- PDF: `application/pdf`
- Others: ตามที่ LINE ส่งมา

---

## Error Handling

| HTTP Code | Error | Description |
|-----------|-------|-------------|
| 400 | ValidationError | ข้อมูลไม่ถูกต้อง |
| 401 | Unauthorized | ไม่ได้ login |
| 403 | AuthorizationError | ไม่มีสิทธิ์อนุมัติ |
| 404 | NotFoundError | ไม่พบไฟล์/ตั๋ว |
| 500 | DatabaseError | Database error |

**Error Response Format:**
```json
{
  "error": "ข้อความ error ภาษาไทย"
}
```

---

## UI/UX Recommendations

### Status Colors
| Status | Color | Background |
|--------|-------|------------|
| pending | Orange | `#FFA500` |
| linked | Blue | `#2196F3` |
| approved | Green | `#4CAF50` |
| rejected | Red | `#F44336` |
| expired | Gray | `#9E9E9E` |

### Status Labels
```typescript
const statusLabels: Record<StagedFileStatus, string> = {
  pending: 'รอเชื่อมต่อ',
  linked: 'รออนุมัติ',
  approved: 'อนุมัติแล้ว',
  rejected: 'ปฏิเสธ',
  expired: 'หมดอายุ',
};
```

### File Type Icons
- Images → Image icon + thumbnail preview
- PDF → PDF icon
- Others → File icon

---

## Related Documentation

- [API Staging](./api-staging.md) - Full API documentation
- [LINE Webhook](./api-line-webhook.md) - LINE Bot integration
