## Base URL
```
/api-models
```

## Authentication
ทุก endpoint ต้องการ JWT token ใน Authorization header

## Endpoints

### 1. List Models
ดึงรายการ model ทั้งหมดแบบแบ่งหน้า

**Endpoint:** `GET /`

**Authorization:** Level 0+

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| page | number | No | หมายเลขหน้า (default: 1) |
| limit | number | No | จำนวนรายการต่อหน้า (default: 20) |
| search | string | No | ค้นหาจาก model code หรือชื่อ |

**Response:**
```json
{
  "data": {
    "data": [
      {
        "id": "uuid",
        "model": "MODEL-001",
        "name": "Model Name",
        "website_url": "https://manufacturer.com/model-001",
        "created_at": "2025-11-17T...",
        "updated_at": "2025-11-17T..."
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 50,
      "totalPages": 3,
      "hasNext": true,
      "hasPrevious": false
    }
  }
}
```

### 2. Get Model by ID
ดึงข้อมูล model รายการเดียว

**Endpoint:** `GET /:id`

**Authorization:** Level 0+

**Response:**
```json
{
  "data": {
    "id": "uuid",
    "model": "MODEL-001",
    "name": "Model Name",
    "website_url": "https://manufacturer.com/model-001",
    "created_at": "2025-11-17T...",
    "updated_at": "2025-11-17T..."
  }
}
```

### 3. Get Model by Model Code
ดึงข้อมูล model จาก model code

**Endpoint:** `GET /model/:model`

**Authorization:** Level 0+

**Response:** (เหมือน get by ID)

**Example:**
```
GET /api-models/model/MODEL-001
```

### 4. Create Model
สร้าง model ใหม่

**Endpoint:** `POST /`

**Authorization:** Level 1+

**Request Body:**
```json
{
  "model": "MODEL-001",
  "name": "Model Display Name",
  "website_url": "https://manufacturer.com/model-001"
}
```

**Required Fields:**
- `model` - Model code (unique)

**Optional Fields:**
- `name` - ชื่อแสดงของ model
- `website_url` - URL ไปยังข้อมูลหรือเอกสารของ model

**Response:** (201 Created)
```json
{
  "data": {
    "id": "uuid",
    "model": "MODEL-001",
    "name": "Model Display Name",
    "website_url": "https://manufacturer.com/model-001",
    "created_at": "2025-11-17T...",
    "updated_at": "2025-11-17T..."
  }
}
```

### 5. Update Model
แก้ไขข้อมูล model

**Endpoint:** `PUT /:id`

**Authorization:** Level 1+

**Request Body:** (เหมือน create แต่ทุก field เป็น optional)
```json
{
  "name": "Updated Name",
  "website_url": "https://new-url.com"
}
```

**Response:**
```json
{
  "data": { /* updated model object */ }
}
```

### 6. Delete Model
ลบ model

**Endpoint:** `DELETE /:id`

**Authorization:** Level 1+

**Response:**
```json
{
  "data": {
    "message": "ลบข้อมูลสำเร็จ"
  }
}
```

**Note:** ไม่สามารถลบ model ที่มี merchandise ใช้งานอยู่

## Error Responses

### 400 Bad Request
```json
{
  "error": "กรุณาระบุ model code"
}
```
```json
{
  "error": "model code ซ้ำในระบบ"
}
```
```json
{
  "error": "ไม่สามารถลบ model ที่มี merchandise ใช้งานอยู่"
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

### List Models with Search
```bash
curl -X GET "https://your-project.supabase.co/functions/v1/api-models?search=MODEL&page=1&limit=20" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Create Model
```bash
curl -X POST "https://your-project.supabase.co/functions/v1/api-models" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "MODEL-001",
    "name": "Premium Machine Model 001",
    "website_url": "https://manufacturer.com/products/model-001"
  }'
```

### Get Model by Code
```bash
curl -X GET "https://your-project.supabase.co/functions/v1/api-models/model/MODEL-001" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Update Model
```bash
curl -X PUT "https://your-project.supabase.co/functions/v1/api-models/MODEL_UUID" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Model Name",
    "website_url": "https://new-website.com"
  }'
```

### Delete Model
```bash
curl -X DELETE "https://your-project.supabase.co/functions/v1/api-models/MODEL_UUID" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Notes
- `model` field ต้องไม่ซ้ำในระบบ (unique constraint)
- ควรตั้งชื่อ model code ให้สั้นและชัดเจน เช่น "MODEL-001", "MACHINE-A"
- `website_url` สามารถใช้เก็บ URL ไปยัง manual, datasheet, หรือหน้าผลิตภัณฑ์
- ไม่สามารถลบ model ที่มี merchandise อ้างอิงอยู่
- Model code จะถูกใช้ใน merchandise และ PM summary APIs

