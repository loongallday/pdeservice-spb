# API PM Log

จัดการบันทึก Preventive Maintenance (PM) ของ merchandise

## Base URL
```
/api-pmlog
```

## Authentication
ทุก endpoint ต้องการ JWT token ใน Authorization header

## Endpoints

### 1. List PM Logs
ดึงรายการ PM log ทั้งหมดแบบแบ่งหน้า

**Endpoint:** `GET /`

**Authorization:** Level 0+

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| page | number | No | หมายเลขหน้า (default: 1) |
| limit | number | No | จำนวนรายการต่อหน้า (default: 20) |

**Response:**
```json
{
  "data": {
    "data": [
      {
        "id": "uuid",
        "merchandise_id": "uuid",
        "merchandise": {
          "id": "uuid",
          "serial_no": "SN12345",
          "model": {
            "id": "uuid",
            "model": "MODEL-001",
            "name": "Model Name"
          }
        },
        "description": "เปลี่ยนน้ำมันและตรวจสอบระบบ",
        "performed_at": "2025-11-17T10:30:00Z",
        "performed_by": "uuid",
        "performer": {
          "id": "uuid",
          "name_th": "สมชาย ใจดี",
          "nickname": "ชาย"
        },
        "created_at": "2025-11-17T...",
        "updated_at": "2025-11-17T..."
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

### 2. Get PM Log by ID
ดึงข้อมูล PM log รายการเดียว

**Endpoint:** `GET /:id`

**Authorization:** Level 0+

**Response:** (เหมือน item ใน list)

### 3. Get PM Logs by Merchandise
ดึงรายการ PM log ของ merchandise ที่ระบุ

**Endpoint:** `GET /merchandise/:merchandiseId`

**Authorization:** Level 0+

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| page | number | No | หมายเลขหน้า |
| limit | number | No | จำนวนรายการต่อหน้า |

**Response:** (เหมือน list)

### 4. Create PM Log
บันทึก PM ใหม่

**Endpoint:** `POST /`

**Authorization:** Level 1+

**Request Body:**
```json
{
  "merchandise_id": "uuid",
  "description": "เปลี่ยนน้ำมันและตรวจสอบระบบทั้งหมด",
  "performed_at": "2025-11-17T10:30:00Z",
  "performed_by": "uuid"
}
```

**Required Fields:**
- `merchandise_id` - ID ของ merchandise ที่ทำ PM

**Optional Fields:**
- `description` - รายละเอียดงาน PM ที่ทำ
- `performed_at` - เวลาที่ทำ PM (ถ้าไม่ระบุจะใช้เวลาปัจจุบัน)
- `performed_by` - ID ของพนักงานที่ทำ PM (ถ้าไม่ระบุจะใช้ employee ที่ login)

**Response:** (201 Created)
```json
{
  "data": { /* PM log object */ }
}
```

### 5. Update PM Log
แก้ไขข้อมูล PM log

**Endpoint:** `PUT /:id`

**Authorization:** Level 2+

**Request Body:** (เหมือน create แต่ทุก field เป็น optional)
```json
{
  "description": "Updated description",
  "performed_at": "2025-11-17T11:00:00Z"
}
```

**Response:**
```json
{
  "data": { /* updated PM log object */ }
}
```

### 6. Delete PM Log
ลบ PM log

**Endpoint:** `DELETE /:id`

**Authorization:** Level 2+

**Response:**
```json
{
  "data": {
    "message": "ลบข้อมูลสำเร็จ"
  }
}
```

## Error Responses

### 400 Bad Request
```json
{
  "error": "กรุณาระบุ merchandise"
}
```

### 401 Unauthorized
```json
{
  "error": "ไม่ได้รับอนุญาต"
}
```

### 403 Forbidden
```json
{
  "error": "ไม่มีสิทธิ์เข้าถึง"
}
```

### 404 Not Found
```json
{
  "error": "ไม่พบข้อมูล"
}
```
```json
{
  "error": "ไม่พบ merchandise ที่ระบุ"
}
```

## Examples

### Create PM Log
```bash
curl -X POST "https://your-project.supabase.co/functions/v1/api-pmlog" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "merchandise_id": "merchandise-uuid",
    "description": "เปลี่ยนน้ำมันเครื่อง ตรวจสอบสายพาน และทำความสะอาด",
    "performed_at": "2025-11-17T10:30:00Z"
  }'
```

### Get PM Logs by Merchandise
```bash
curl -X GET "https://your-project.supabase.co/functions/v1/api-pmlog/merchandise/MERCHANDISE_UUID?page=1&limit=20" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Update PM Log
```bash
curl -X PUT "https://your-project.supabase.co/functions/v1/api-pmlog/PMLOG_UUID" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "description": "เปลี่ยนน้ำมันเครื่อง ตรวจสอบสายพาน ทำความสะอาด และเปลี่ยนฟิลเตอร์"
  }'
```

### Delete PM Log
```bash
curl -X DELETE "https://your-project.supabase.co/functions/v1/api-pmlog/PMLOG_UUID" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Notes
- PM log จะถูกใช้ในการคำนวณ PM summary และตรวจสอบว่าต้องต่ออายุประกันหรือไม่
- ถ้าไม่ระบุ `performed_by` ระบบจะใช้ employee ที่ login อัตโนมัติ
- ถ้าไม่ระบุ `performed_at` ระบบจะใช้เวลาปัจจุบันอัตโนมัติ
- PM log จะถูกเรียงตาม `performed_at` จากใหม่ไปเก่า
- การสร้าง PM log ใหม่จะส่งผลต่อ PM summary และ needs_renewal status

