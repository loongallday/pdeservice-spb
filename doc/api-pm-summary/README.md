# API PM Summary

ดูสรุปข้อมูล PM และตรวจสอบสถานะการต่ออายุประกันของ merchandise

## Base URL
```
/api-pm-summary
```

## Authentication
ทุก endpoint ต้องการ JWT token ใน Authorization header

## Endpoints

### 1. Get PM Summary
ดึงสรุปข้อมูล PM ของ merchandise ทั้งหมด

**Endpoint:** `GET /`

**Authorization:** Level 0+

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| page | number | No | หมายเลขหน้า (default: 1) |
| limit | number | No | จำนวนรายการต่อหน้า (default: 20) |
| site_id | string | No | กรองตาม site ID |
| merchandise_id | string | No | กรองตาม merchandise ID |
| needs_renewal | boolean | No | กรองเฉพาะที่ต้องต่ออายุ (true/false) |

**Response:**
```json
{
  "data": {
    "data": [
      {
        "id": "uuid",
        "serial_no": "SN12345",
        "model_id": "uuid",
        "model": {
          "id": "uuid",
          "model": "MODEL-001",
          "name": "Model Name",
          "website_url": "https://..."
        },
        "site_id": "uuid",
        "site": {
          "id": "uuid",
          "name": "Site Name"
        },
        "pm_count": 10,
        "distributor_id": "uuid",
        "dealer_id": "uuid",
        "replaced_by_id": "uuid",
        "distributor": { "id": "uuid", "name_th": "บริษัทจัดจำหน่าย" },
        "dealer": { "id": "uuid", "name_th": "บริษัทดีลเลอร์" },
        "replaced_by": { "id": "uuid", "serial_no": "SN99999" },
        "pm_log_count": 8,
        "needs_renewal": false,
        "last_pm_date": "2025-11-15T10:30:00Z",
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

**Response Fields Explanation:**
- `pm_count` - จำนวน PM สูงสุดที่กำหนดไว้สำหรับ merchandise นี้
- `pm_log_count` - จำนวน PM ที่ทำไปแล้ว (จาก pmlog table)
- `needs_renewal` - ต้องต่ออายุประกันหรือไม่ (true ถ้า pm_log_count >= pm_count)
- `last_pm_date` - วันที่ทำ PM ล่าสุด

### 2. Get Merchandise Summary
ดึงสรุปข้อมูล PM ของ merchandise รายการเดียว

**Endpoint:** `GET /:id`

**Authorization:** Level 0+

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| id | string | Merchandise ID |

**Response:**
```json
{
  "data": {
    "id": "uuid",
    "serial_no": "SN12345",
    "model_id": "uuid",
    "model": {
      "id": "uuid",
      "model": "MODEL-001",
      "name": "Model Name",
      "website_url": "https://..."
    },
    "site_id": "uuid",
    "site": {
      "id": "uuid",
      "name": "Site Name"
    },
    "pm_count": 10,
    "distributor_id": "uuid",
    "dealer_id": "uuid",
    "replaced_by_id": "uuid",
    "distributor": { "id": "uuid", "name_th": "บริษัทจัดจำหน่าย" },
    "dealer": { "id": "uuid", "name_th": "บริษัทดีลเลอร์" },
    "replaced_by": { "id": "uuid", "serial_no": "SN99999" },
    "pm_log_count": 10,
    "needs_renewal": true,
    "last_pm_date": "2025-11-15T10:30:00Z",
    "created_at": "2025-11-17T...",
    "updated_at": "2025-11-17T..."
  }
}
```

### 3. Get PM Logs for Merchandise
ดึงรายการ PM logs ทั้งหมดของ merchandise ที่ระบุ

**Endpoint:** `GET /:merchandiseId/logs`

**Authorization:** Level 0+

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| page | number | No | หมายเลขหน้า |
| limit | number | No | จำนวนรายการต่อหน้า |

**Response:**
```json
{
  "data": {
    "data": [
      {
        "id": "uuid",
        "merchandise_id": "uuid",
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
      "total": 10,
      "totalPages": 1,
      "hasNext": false,
      "hasPrevious": false
    }
  }
}
```

## Error Responses

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
  "error": "ไม่พบข้อมูล merchandise"
}
```

## Examples

### Get All PM Summary
```bash
curl -X GET "https://your-project.supabase.co/functions/v1/api-pm-summary?page=1&limit=20" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Get PM Summary Filtered by Site
```bash
curl -X GET "https://your-project.supabase.co/functions/v1/api-pm-summary?site_id=SITE_UUID&page=1" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Get Only Merchandise that Needs Renewal
```bash
curl -X GET "https://your-project.supabase.co/functions/v1/api-pm-summary?needs_renewal=true" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Get Single Merchandise Summary
```bash
curl -X GET "https://your-project.supabase.co/functions/v1/api-pm-summary/MERCHANDISE_UUID" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Get PM Logs for Specific Merchandise
```bash
curl -X GET "https://your-project.supabase.co/functions/v1/api-pm-summary/MERCHANDISE_UUID/logs?page=1&limit=20" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Use Cases

### 1. Check Warranty Renewal Status
ใช้ตรวจสอบว่า merchandise ไหนต้องต่ออายุประกัน:

```bash
GET /api-pm-summary?needs_renewal=true
```

Response จะแสดงเฉพาะ merchandise ที่ `pm_log_count >= pm_count`

### 2. View PM History
ดูประวัติการทำ PM ของ merchandise:

```bash
GET /api-pm-summary/MERCHANDISE_UUID/logs
```

### 3. Monitor Site PM Status
ตรวจสอบสถานะ PM ของ merchandise ทั้งหมดใน site:

```bash
GET /api-pm-summary?site_id=SITE_UUID
```

### 4. Dashboard Display
แสดงสรุปข้อมูล PM บน dashboard:

```bash
# Get total count
GET /api-pm-summary?limit=1

# Get renewal needed count
GET /api-pm-summary?needs_renewal=true&limit=1

# Get recent PM logs
GET /api-pm-summary?page=1&limit=10
```

## Notes
- **needs_renewal** จะเป็น `true` เมื่อ `pm_log_count >= pm_count` และ `pm_count` ไม่เป็น null
- **pm_log_count** คือจำนวนครั้งที่ทำ PM ไปแล้ว (นับจาก pmlog table)
- **last_pm_date** จะเป็น `null` ถ้ายังไม่เคยทำ PM
- API นี้เป็น read-only ไม่มี POST, PUT, DELETE operations
- สำหรับการบันทึก PM ใหม่ ใช้ `/api-pmlog` แทน
- ข้อมูลจะถูก aggregate real-time จาก merchandise และ pmlog tables
- ใช้ตัว filter `needs_renewal=true` เพื่อหา merchandise ที่ต้องดำเนินการต่ออายุประกัน

## Related APIs
- **api-merchandise** - จัดการข้อมูล merchandise
- **api-models** - จัดการข้อมูล model
- **api-pmlog** - บันทึกและจัดการ PM logs
- **api-sites** - ข้อมูล site ที่ติดตั้ง merchandise
- **api-companies** - ข้อมูลบริษัทจัดจำหน่ายและดีลเลอร์

