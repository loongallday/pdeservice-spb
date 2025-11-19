# API Merchandise

จัดการข้อมูล merchandise (อุปกรณ์/เครื่องจักร) ที่ติดตั้งอยู่ใน site ต่างๆ

## Base URL
```
/api-merchandise
```

## Authentication
ทุก endpoint ต้องการ JWT token ใน Authorization header

## Endpoints

### 1. List Merchandise
ดึงรายการ merchandise ทั้งหมดแบบแบ่งหน้า

**Endpoint:** `GET /`

**Authorization:** Level 0+

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| page | number | No | หมายเลขหน้า (default: 1) |
| limit | number | No | จำนวนรายการต่อหน้า (default: 20) |
| search | string | No | ค้นหาจาก serial number |

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

### 2. Get Merchandise by ID
ดึงข้อมูล merchandise รายการเดียว

**Endpoint:** `GET /:id`

**Authorization:** Level 0+

**Response:** (เหมือน item ใน list)

### 3. Get Merchandise by Site
ดึงรายการ merchandise ของ site ที่ระบุ

**Endpoint:** `GET /site/:siteId`

**Authorization:** Level 0+

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| page | number | No | หมายเลขหน้า |
| limit | number | No | จำนวนรายการต่อหน้า |

**Response:** (เหมือน list)

### 4. Get Merchandise by Model
ดึงรายการ merchandise ของ model ที่ระบุ

**Endpoint:** `GET /model/:modelId`

**Authorization:** Level 0+

**Query Parameters:** (เหมือน get by site)

**Response:** (เหมือน list)

### 5. Create Merchandise
สร้าง merchandise ใหม่

**Endpoint:** `POST /`

**Authorization:** Level 1+

**Request Body:**
```json
{
  "serial_no": "SN12345",
  "model_id": "uuid",
  "site_id": "uuid",
  "pm_count": 10,
  "distributor_id": "uuid",
  "dealer_id": "uuid",
  "replaced_by_id": "uuid"
}
```

**Required Fields:**
- `serial_no` - Serial number ของอุปกรณ์
- `model_id` - ID ของ model (ต้องมีใน models table)
- `site_id` - ID ของ site (ต้องมีใน sites table)

**Optional Fields:**
- `pm_count` - จำนวน PM สูงสุดก่อนต้องต่ออายุประกัน
- `distributor_id` - ID ของบริษัทจัดจำหน่าย
- `dealer_id` - ID ของบริษัทดีลเลอร์
- `replaced_by_id` - ID ของ merchandise ที่มาแทนที่

**Response:** (201 Created)
```json
{
  "data": { /* merchandise object */ }
}
```

### 6. Update Merchandise
แก้ไขข้อมูล merchandise

**Endpoint:** `PUT /:id`

**Authorization:** Level 2+

**Request Body:** (เหมือน create แต่ทุก field เป็น optional)

**Response:**
```json
{
  "data": { /* updated merchandise object */ }
}
```

### 7. Delete Merchandise
ลบ merchandise

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
  "error": "กรุณาระบุ serial number"
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

## Examples

### Create Merchandise
```bash
curl -X POST "https://your-project.supabase.co/functions/v1/api-merchandise" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "serial_no": "SN12345",
    "model_id": "model-uuid",
    "site_id": "site-uuid",
    "pm_count": 10,
    "distributor_id": "company-uuid"
  }'
```

### Get Merchandise by Site
```bash
curl -X GET "https://your-project.supabase.co/functions/v1/api-merchandise/site/SITE_UUID?page=1&limit=20" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Update Merchandise
```bash
curl -X PUT "https://your-project.supabase.co/functions/v1/api-merchandise/MERCHANDISE_UUID" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "pm_count": 15,
    "dealer_id": "new-dealer-uuid"
  }'
```

## Notes
- ต้องตรวจสอบว่า `model_id` และ `site_id` ต้องมีอยู่จริงในระบบ
- `pm_count` ใช้สำหรับตรวจสอบว่าต้องต่ออายุประกันหรือไม่ (ดูใน PM Summary API)
- `replaced_by_id` ใช้สำหรับติดตามว่า merchandise นี้ถูกแทนที่ด้วยอันไหน
- ไม่สามารถลบ merchandise ที่มี PM logs หรือถูกอ้างอิงจากที่อื่น
- Merchandise สามารถเชื่อมโยงกับ tickets ได้ผ่าน Tickets API (`POST /api-tickets/:id/merchandise`)
- Merchandise ที่เชื่อมโยงกับ ticket ต้องอยู่ใน site เดียวกันกับ ticket (ตรวจสอบอัตโนมัติ)

