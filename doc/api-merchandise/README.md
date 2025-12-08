# Merchandise API

## Overview

The Merchandise API handles equipment/merchandise management operations including search, CRUD operations, and retrieval by ID.

**Base URL**: `/functions/v1/api-merchandise`

**Authentication**: All endpoints require Bearer token authentication.

---

## Endpoints

### Search Merchandise

Search for merchandise by serial number with pagination support.

**Endpoint**: `GET /search`

**Required Level**: 0 (all authenticated users)

**Query Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `q` | string | No | Search query for serial number (partial match, case-insensitive) |
| `page` | number | No | Page number (default: 1, minimum: 1) |
| `limit` | number | No | Items per page (default: 50, minimum: 1, maximum: 100) |

**Notes**:
- If no query is provided, returns all merchandise
- Results are ordered by creation date (newest first)
- Search is case-insensitive and supports partial matching
- Pagination is supported via `page` and `limit` query parameters

**Example Request**:
```http
GET /functions/v1/api-merchandise/search?q=SN123&page=1&limit=20
Authorization: Bearer <token>
```

**Example Response**:
```json
{
  "data": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "serial_no": "SN12345",
      "model": {
        "id": "uuid",
        "model": "MODEL-001",
        "name": "Model Name"
      },
      "site": {
        "id": "uuid",
        "name": "Site Name"
      },
      "distributor": {
        "id": "1234567890123",
        "name": "บริษัทจัดจำหน่าย"
      },
      "dealer": {
        "id": "9876543210987",
        "name": "บริษัทดีลเลอร์"
      },
      "replaced_by": "SN99999",
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1,
    "hasNext": false,
    "hasPrevious": false
  }
}
```

**Response Fields**:
- `data`: Array of merchandise objects
  - `id`: Merchandise ID (UUID)
  - `serial_no`: Serial number
  - `model`: Nested model object with `id`, `model`, and `name` (nullable)
  - `site`: Nested site object with `id` and `name` (nullable)
  - `distributor`: Nested distributor company object with `id` (tax_id) and `name` (nullable)
  - `dealer`: Nested dealer company object with `id` (tax_id) and `name` (nullable)
  - `replaced_by`: Serial number of the merchandise that replaced this one (string, nullable)
  - `created_at`: Creation timestamp
  - `updated_at`: Last update timestamp
- `pagination`: Pagination information object
  - `page`: Current page number
  - `limit`: Items per page
  - `total`: Total number of items matching the search
  - `totalPages`: Total number of pages
  - `hasNext`: Whether there is a next page
  - `hasPrevious`: Whether there is a previous page

---

### Get Merchandise Hints

Get up to 5 merchandise hints. If query is empty, returns 5 most recent merchandise. If query is provided, searches by serial number and returns matching merchandise.

**Endpoint**: `GET /hint`

**Required Level**: 0 (all authenticated users)

**Query Parameters**:
- `q` (optional): Search query string. If empty, returns 5 most recent merchandise ordered by creation date.
- `site_id` (optional): Filter by site ID (UUID). If provided, only returns merchandise from the specified site.

**Example Request** (with query):
```http
GET /functions/v1/api-merchandise/hint?q=SN123
Authorization: Bearer <token>
```

**Example Request** (empty query - returns 5 recent merchandise):
```http
GET /functions/v1/api-merchandise/hint
Authorization: Bearer <token>
```

**Example Request** (with site_id filter):
```http
GET /functions/v1/api-merchandise/hint?site_id=123e4567-e89b-12d3-a456-426614174000
Authorization: Bearer <token>
```

**Example Request** (with query and site_id):
```http
GET /functions/v1/api-merchandise/hint?q=SN123&site_id=123e4567-e89b-12d3-a456-426614174000
Authorization: Bearer <token>
```

**Example Response**:
```json
{
  "data": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "serial_no": "SN12345",
      "model_id": "uuid",
      "site_id": "uuid",
      "model_code": "MODEL-001",
      "model_name": "Model Name",
      "site_name": "Site Name"
    },
    {
      "id": "123e4567-e89b-12d3-a456-426614174001",
      "serial_no": "SN12346",
      "model_id": "uuid",
      "site_id": "uuid",
      "model_code": "MODEL-002",
      "model_name": "Another Model",
      "site_name": "Another Site"
    }
  ]
}
```

**Response Fields**:
- `id`: Merchandise ID (UUID)
- `serial_no`: Serial number
- `model_id`: Model ID (UUID, nullable)
- `site_id`: Site ID (UUID, nullable)
- `model_code`: Model code (from related model, nullable)
- `model_name`: Model name (from related model, nullable)
- `site_name`: Site name (from related site, nullable)

**Note**: Always returns up to 5 merchandise maximum.

---

### Check Duplicate Serial Number

Check if a serial number already exists in the system. Useful for validating before creating new merchandise.

**Endpoint**: `GET /check-duplicate`

**Required Level**: 0 (all authenticated users)

**Query Parameters**:
- `serial_no` (required): Serial number to check

**Example Request**:
```http
GET /functions/v1/api-merchandise/check-duplicate?serial_no=SN12345
Authorization: Bearer <token>
```

**Example Response** (when duplicate exists):
```json
{
  "data": {
    "is_duplicate": true,
    "merchandise": {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "serial_no": "SN12345",
      "model_id": "uuid",
      "site_id": "uuid",
      "created_at": "2024-01-01T00:00:00Z"
    }
  }
}
```

**Example Response** (when no duplicate):
```json
{
  "data": {
    "is_duplicate": false,
    "merchandise": null
  }
}
```

**Response Fields**:
- `is_duplicate`: Boolean indicating if the serial number exists
- `merchandise`: Merchandise object if found, `null` otherwise. Contains `id`, `serial_no`, `model_id`, `site_id`, and `created_at`

**Error Responses**:
- `400 Bad Request`: Missing `serial_no` parameter
- `401 Unauthorized`: Missing or invalid authentication token
- `500 Internal Server Error`: Database error

**Notes**:
- This endpoint performs an exact match on the serial number (case-sensitive)
- Use this endpoint before creating new merchandise to avoid duplicates
- Returns basic merchandise information if a duplicate is found

---

### Get Merchandise by ID

Get a single merchandise item by its ID.

**Endpoint**: `GET /:id`

**Required Level**: 0 (all authenticated users)

**Path Parameters**:
- `id` (required): Merchandise ID (UUID)

**Example Request**:
```http
GET /functions/v1/api-merchandise/123e4567-e89b-12d3-a456-426614174000
Authorization: Bearer <token>
```

**Example Response**:
```json
{
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "serial_no": "SN12345",
    "model_id": "uuid",
    "model": {
      "id": "uuid",
      "model": "MODEL-001",
      "name": "Model Name",
      "website_url": "https://manufacturer.com/model-001"
    },
    "site_id": "uuid",
    "site": {
      "id": "uuid",
      "name": "Site Name"
    },
    "pm_count": 10,
    "distributor_id": "uuid",
    "dealer_id": "uuid",
    "replaced_by_id": null,
    "distributor": {
      "id": "uuid",
      "name_th": "บริษัทจัดจำหน่าย"
    },
    "dealer": {
      "id": "uuid",
      "name_th": "บริษัทดีลเลอร์"
    },
    "replaced_by": null,
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  }
}
```

---

### Create Merchandise

Create a new merchandise item.

**Endpoint**: `POST /`

**Required Level**: 1 (create operations)

**Request Body**:
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

**Required Fields**:
- `serial_no`: Serial number of the equipment (unique)
- `model_id`: ID of the model (must exist in models table)
- `site_id`: ID of the site (must exist in sites table)

**Optional Fields**:
- `pm_count`: Maximum PM count before warranty renewal is required
- `distributor_id`: ID of the distributor company
- `dealer_id`: ID of the dealer company
- `replaced_by_id`: ID of the merchandise that replaces this one

**Example Request**:
```http
POST /functions/v1/api-merchandise
Authorization: Bearer <token>
Content-Type: application/json

{
  "serial_no": "SN12345",
  "model_id": "uuid-here",
  "site_id": "uuid-here",
  "pm_count": 10
}
```

**Example Response** (201 Created):
```json
{
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "serial_no": "SN12345",
    "model_id": "uuid",
    "model": {
      "id": "uuid",
      "model": "MODEL-001",
      "name": "Model Name",
      "website_url": "https://manufacturer.com/model-001"
    },
    "site_id": "uuid",
    "site": {
      "id": "uuid",
      "name": "Site Name"
    },
    "pm_count": 10,
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  }
}
```

---

### Update Merchandise

Update an existing merchandise item.

**Endpoint**: `PUT /:id`

**Required Level**: 1 (update operations)

**Path Parameters**:
- `id` (required): Merchandise ID (UUID)

**Request Body** (all fields optional):
```json
{
  "serial_no": "SN12346",
  "model_id": "uuid",
  "site_id": "uuid",
  "pm_count": 15,
  "distributor_id": "uuid",
  "dealer_id": "uuid",
  "replaced_by_id": "uuid"
}
```

**Example Request**:
```http
PUT /functions/v1/api-merchandise/123e4567-e89b-12d3-a456-426614174000
Authorization: Bearer <token>
Content-Type: application/json

{
  "pm_count": 15,
  "dealer_id": "uuid-here"
}
```

**Example Response**:
```json
{
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "serial_no": "SN12345",
    "model_id": "uuid",
    "model": {
      "id": "uuid",
      "model": "MODEL-001",
      "name": "Model Name",
      "website_url": "https://manufacturer.com/model-001"
    },
    "site_id": "uuid",
    "site": {
      "id": "uuid",
      "name": "Site Name"
    },
    "pm_count": 15,
    "dealer_id": "uuid-here",
    "updated_at": "2024-01-02T00:00:00Z"
  }
}
```

---

### Delete Merchandise

Delete a merchandise item.

**Endpoint**: `DELETE /:id`

**Required Level**: 2 (delete operations)

**Path Parameters**:
- `id` (required): Merchandise ID (UUID)

**Example Request**:
```http
DELETE /functions/v1/api-merchandise/123e4567-e89b-12d3-a456-426614174000
Authorization: Bearer <token>
```

**Example Response**:
```json
{
  "data": {
    "message": "ลบข้อมูลสำเร็จ"
  }
}
```

---

## Error Responses

### 400 Bad Request
```json
{
  "error": "กรุณาระบุ serial number"
}
```
```json
{
  "error": "ข้อมูลซ้ำในระบบ"
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
  "error": "ไม่พบ model ที่ระบุ"
}
```
```json
{
  "error": "ไม่พบ site ที่ระบุ"
}
```

### 409 Conflict
```json
{
  "error": "มีข้อมูลอ้างอิงที่ใช้งานอยู่ ไม่สามารถลบได้"
}
```

### 500 Internal Server Error
```json
{
  "error": "เกิดข้อผิดพลาดในการเข้าถึงข้อมูล"
}
```

---

## Examples

### Get Merchandise Hints
```bash
curl -X GET "https://your-project.supabase.co/functions/v1/api-merchandise/hint?q=SN123" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Search Merchandise
```bash
curl -X GET "https://your-project.supabase.co/functions/v1/api-merchandise/search?q=SN123" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Get Merchandise by ID
```bash
curl -X GET "https://your-project.supabase.co/functions/v1/api-merchandise/123e4567-e89b-12d3-a456-426614174000" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Create Merchandise
```bash
curl -X POST "https://your-project.supabase.co/functions/v1/api-merchandise" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "serial_no": "SN12345",
    "model_id": "model-uuid",
    "site_id": "site-uuid",
    "pm_count": 10
  }'
```

### Update Merchandise
```bash
curl -X PUT "https://your-project.supabase.co/functions/v1/api-merchandise/123e4567-e89b-12d3-a456-426614174000" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "pm_count": 15,
    "dealer_id": "dealer-uuid"
  }'
```

### Delete Merchandise
```bash
curl -X DELETE "https://your-project.supabase.co/functions/v1/api-merchandise/123e4567-e89b-12d3-a456-426614174000" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## Notes

- `serial_no` must be unique in the system
- `model_id` and `site_id` must exist in the database before creating merchandise
- `pm_count` is used to check if warranty renewal is needed (see PM Summary API)
- `replaced_by_id` is used to track which merchandise replaces this one
- Cannot delete merchandise that has PM logs or is referenced elsewhere
- Merchandise can be linked to tickets through the Tickets API
- Merchandise linked to a ticket must be in the same site as the ticket (automatically validated)
