# API Staging - n8n File Staging System

## Overview

API สำหรับจัดการไฟล์ที่ช่างเทคนิคอัพโหลดผ่าน LINE ก่อนที่จะได้รับการอนุมัติเป็นผลงานในตั๋วงาน

## Workflow

```
1. ช่างเทคนิคอัพโหลดไฟล์ผ่าน LINE → n8n → staging bucket (status: pending)
2. ช่างเทคนิคเลือกตั๋วงานผ่าน LINE carousel → ไฟล์เชื่อมกับตั๋ว (status: linked)
3. ผู้อนุมัติตรวจสอบใน web app → อนุมัติ → ระบบสร้าง comment บนตั๋ว (status: approved)
4. Auto-cleanup: ไฟล์ที่ไม่ได้เชื่อมกับตั๋วจะหมดอายุใน 30 วัน
```

## Database Schema

### child_employee_line_accounts
จับคู่ LINE user ID กับพนักงาน

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| employee_id | UUID | FK to main_employees (unique) |
| line_user_id | TEXT | LINE user ID (unique) |
| display_name | TEXT | LINE display name |
| profile_picture_url | TEXT | LINE profile picture |
| linked_at | TIMESTAMPTZ | เวลาที่เชื่อมต่อ |

### main_staged_files
ไฟล์ที่รอการอนุมัติ

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| employee_id | UUID | FK to main_employees |
| file_url | TEXT | URL ไฟล์ใน staging bucket |
| file_name | TEXT | ชื่อไฟล์ |
| file_size | INTEGER | ขนาดไฟล์ (bytes) |
| mime_type | TEXT | MIME type |
| ticket_id | UUID | FK to main_tickets (nullable) |
| status | TEXT | pending, linked, approved, rejected, expired |
| approved_by | UUID | FK to main_employees |
| approved_at | TIMESTAMPTZ | เวลาอนุมัติ |
| rejection_reason | TEXT | เหตุผลปฏิเสธ |
| result_comment_id | UUID | FK to child_ticket_comments |
| expires_at | TIMESTAMPTZ | เวลาหมดอายุ (30 วัน) |
| source | TEXT | แหล่งที่มา (line, web) |
| metadata | JSONB | ข้อมูลเพิ่มเติม |

## Status Flow

```
pending → linked → approved
                 → rejected
         → expired (หลัง 30 วันถ้าไม่ได้ link)
```

---

## API Endpoints

### Base URL
```
https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-staging
```

---

## n8n Endpoints (service_role auth)

### Create Staged File
สร้างไฟล์ใหม่ใน staging (เรียกหลังจากอัพโหลดไฟล์ไป storage แล้ว)

```
POST /files
Authorization: Bearer {SUPABASE_SERVICE_ROLE_KEY}
```

**Request Body:**
```json
{
  "line_user_id": "Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "file_url": "https://xxx.supabase.co/storage/v1/object/staging-files/xxx.jpg",
  "file_name": "photo.jpg",
  "file_size": 123456,
  "mime_type": "image/jpeg",
  "source": "line",
  "metadata": {}
}
```

**Response:**
```json
{
  "data": {
    "id": "uuid",
    "employee_id": "uuid",
    "file_url": "...",
    "file_name": "photo.jpg",
    "status": "pending",
    "expires_at": "2026-02-12T...",
    "employee": {
      "id": "uuid",
      "name": "ชื่อพนักงาน",
      "code": "EMP001"
    }
  }
}
```

---

### Link File to Ticket
เชื่อมไฟล์กับตั๋วงาน

```
PUT /files/:id/link
Authorization: Bearer {SUPABASE_SERVICE_ROLE_KEY}
```

**Request Body:**
```json
{
  "ticket_id": "uuid"
}
```

**Response:**
```json
{
  "data": {
    "id": "uuid",
    "status": "linked",
    "ticket_id": "uuid",
    "ticket": {
      "id": "uuid",
      "code": "TK-2601-0001",
      "title": "..."
    }
  }
}
```

---

### Get Tickets for Carousel
ดึงรายการตั๋วของช่างเทคนิคสำหรับแสดงใน LINE carousel

```
GET /tickets/carousel?line_user_id=Uxxx&limit=10
Authorization: Bearer {SUPABASE_SERVICE_ROLE_KEY}
```

**Response:**
```json
{
  "data": {
    "tickets": [
      {
        "id": "uuid",
        "code": "TK-2601-0001",
        "title": "ซ่อมเครื่อง UPS",
        "site_name": "บริษัท ABC",
        "work_type_name": "PM",
        "status_name": "กำลังดำเนินการ",
        "appointment_date": "2026-01-15"
      }
    ],
    "count": 5
  }
}
```

---

### Get Ticket by Code
ค้นหาตั๋วจากรหัส (สำหรับยืนยัน)

```
GET /tickets/by-code/:code
Authorization: Bearer {SUPABASE_SERVICE_ROLE_KEY}
```

**Response:**
```json
{
  "data": {
    "found": true,
    "ticket": {
      "id": "uuid",
      "code": "TK-2601-0001",
      "title": "...",
      "site_name": "...",
      "work_type_name": "...",
      "status_name": "..."
    }
  }
}
```

---

### Get Employee by LINE User ID
หาพนักงานจาก LINE user ID

```
GET /employee/:lineUserId
Authorization: Bearer {SUPABASE_SERVICE_ROLE_KEY}
```

**Response:**
```json
{
  "data": {
    "employee_id": "uuid",
    "display_name": "ชื่อใน LINE"
  }
}
```

---

## Web App Endpoints (JWT auth)

### List Staged Files
ดูรายการไฟล์ที่รอการอนุมัติ

```
GET /files?status=linked&page=1&limit=20
Authorization: Bearer {JWT}
```

**Query Parameters:**
- `status` - กรองสถานะ (pending, linked, approved, rejected, expired) หรือหลายค่า (linked,pending)
- `employee_id` - กรองตามพนักงาน
- `ticket_id` - กรองตามตั๋วงาน
- `page` - หน้า (default: 1)
- `limit` - จำนวนต่อหน้า (default: 20, max: 100)

**Permission:** canApproveAppointments

---

### Get Staged File
ดูรายละเอียดไฟล์

```
GET /files/:id
Authorization: Bearer {JWT}
```

**Permission:** canApproveAppointments

---

### Approve File
อนุมัติไฟล์ (สร้าง comment บนตั๋วอัตโนมัติ)

```
POST /files/:id/approve
Authorization: Bearer {JWT}
```

**Request Body (optional):**
```json
{
  "comment_content": "ข้อความ comment ที่กำหนดเอง"
}
```

**Permission:** canApproveAppointments

**Note:** ไฟล์ต้องอยู่ในสถานะ `linked` และมี `ticket_id`

---

### Reject File
ปฏิเสธไฟล์

```
POST /files/:id/reject
Authorization: Bearer {JWT}
```

**Request Body:**
```json
{
  "reason": "ภาพไม่ชัด กรุณาถ่ายใหม่"
}
```

**Permission:** canApproveAppointments

---

### Bulk Approve Files
อนุมัติหลายไฟล์พร้อมกัน

```
POST /files/bulk-approve
Authorization: Bearer {JWT}
```

**Request Body:**
```json
{
  "file_ids": ["uuid1", "uuid2", "uuid3"],
  "comment_content": "อนุมัติผลงาน"
}
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

**Permission:** canApproveAppointments

---

### Delete Staged File

```
DELETE /files/:id
Authorization: Bearer {JWT}
```

**Permission:** canApproveAppointments

**Note:** ไม่สามารถลบไฟล์ที่ได้รับการอนุมัติแล้ว

---

## LINE Account Management (admin only)

### List LINE Accounts

```
GET /line-accounts?page=1&limit=20
Authorization: Bearer {JWT}
```

**Permission:** level >= 2 (admin)

---

### Create LINE Account Mapping

```
POST /line-accounts
Authorization: Bearer {JWT}
```

**Request Body:**
```json
{
  "employee_id": "uuid",
  "line_user_id": "Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "display_name": "ชื่อใน LINE",
  "profile_picture_url": "https://..."
}
```

**Permission:** level >= 2 (admin)

---

### Update LINE Account

```
PUT /line-accounts/:id
Authorization: Bearer {JWT}
```

**Request Body:**
```json
{
  "display_name": "ชื่อใหม่",
  "profile_picture_url": "https://..."
}
```

**Permission:** level >= 2 (admin)

---

### Delete LINE Account Mapping

```
DELETE /line-accounts/:id
Authorization: Bearer {JWT}
```

**Permission:** level >= 2 (admin)

---

## Storage

### Bucket: staging-files
- Private bucket (ต้อง auth)
- File size limit: 50MB
- Allowed MIME types:
  - image/jpeg, image/jpg, image/png, image/webp, image/gif
  - application/pdf
  - application/msword, application/vnd.openxmlformats-officedocument.wordprocessingml.document
  - application/vnd.ms-excel, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
  - text/plain, text/csv
  - video/mp4, video/quicktime

### Upload Flow (n8n)
1. n8n อัพโหลดไฟล์ไปที่ storage ก่อน:
   ```
   POST /storage/v1/object/staging-files/{path}
   Authorization: Bearer {SUPABASE_SERVICE_ROLE_KEY}
   ```
2. แล้วเรียก API สร้าง staged file:
   ```
   POST /api-staging/files
   ```

---

## Cron Job

### cleanup-expired-staged-files
- ทำงานทุกวันเวลา 04:00 UTC
- Mark ไฟล์เป็น `expired` ถ้า `expires_at < NOW()` และสถานะเป็น `pending` หรือ `linked`
- ลบ record ที่ expired มานานกว่า 7 วัน

---

## n8n Integration Example

### Flow: Technician uploads photo via LINE

1. **LINE Message Webhook** → n8n receives image
2. **HTTP Request**: Upload to Supabase Storage
   ```
   POST https://ogzyihacqbasolfxymgo.supabase.co/storage/v1/object/staging-files/{line_user_id}/{timestamp}_{filename}
   Authorization: Bearer {SUPABASE_SERVICE_ROLE_KEY}
   Content-Type: {mime_type}
   Body: {binary file}
   ```
3. **HTTP Request**: Create staged file
   ```
   POST https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-staging/files
   Authorization: Bearer {SUPABASE_SERVICE_ROLE_KEY}
   {
     "line_user_id": "Uxxx",
     "file_url": "{url from step 2}",
     "file_name": "photo.jpg",
     "file_size": 123456,
     "mime_type": "image/jpeg"
   }
   ```
4. **HTTP Request**: Get carousel tickets
   ```
   GET https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-staging/tickets/carousel?line_user_id=Uxxx
   ```
5. **LINE Reply**: Send flex carousel with tickets
6. **Technician selects ticket** → Postback event
7. **HTTP Request**: Link file to ticket
   ```
   PUT https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-staging/files/{file_id}/link
   {
     "ticket_id": "{selected_ticket_id}"
   }
   ```
8. **LINE Reply**: Confirmation message

---

## Error Responses

| Status | Message |
|--------|---------|
| 400 | กรุณาระบุ line_user_id |
| 400 | กรุณาระบุ file_url |
| 400 | กรุณาระบุ ticket_id |
| 400 | ไฟล์นี้ไม่อยู่ในสถานะที่สามารถเชื่อมต่อกับตั๋วได้ |
| 400 | ไฟล์นี้ต้องอยู่ในสถานะ "linked" ก่อนอนุมัติ |
| 400 | ไม่สามารถลบไฟล์ที่ได้รับการอนุมัติแล้ว |
| 401 | Session หมดอายุกรุณาเข้าใช้งานใหม่ |
| 403 | ไม่มีสิทธิ์อนุมัตินัดหมาย |
| 403 | ต้องมีสิทธิ์ระดับ 2 ขึ้นไป |
| 404 | ไม่พบการเชื่อมต่อบัญชี LINE |
| 404 | ไม่พบไฟล์ที่ระบุ |
| 404 | ไม่พบตั๋วงานที่ระบุ |
