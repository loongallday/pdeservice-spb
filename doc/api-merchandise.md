# API Merchandise

## Overview

The Merchandise API manages equipment and UPS inventory including serial numbers, models, locations, and replacement chains for tracking equipment history. This API provides comprehensive CRUD operations for merchandise records, search capabilities, location management within sites, and replacement chain tracking for equipment lifecycle management.

Key features:
- Serial number tracking and duplicate checking
- Model and site reference management
- Distributor/dealer tracking
- Physical location tracking within sites (building, floor, room, zone)
- Replacement chain traversal for equipment history

---

## Base URL

```
/api-merchandise
```

---

## Authentication

All endpoints require a valid JWT token in the Authorization header.

```
Authorization: Bearer <jwt_token>
```

**Permission Levels:**

| Level | Role | Operations |
|-------|------|------------|
| 0 | Technician L1 | Read-only (list, get, search, hint, check-duplicate) |
| 1 | Assigner, PM, Sales | Create, update merchandise and locations |
| 2 | Admin | Delete merchandise |

---

## Endpoints Summary

| Method | Path | Description | Auth Level |
|--------|------|-------------|------------|
| GET | `/` | List merchandise (paginated) | 0 |
| GET | `/search` | Search merchandise by serial number | 0 |
| GET | `/hint` | Quick search (up to 5 results) | 0 |
| GET | `/check-duplicate` | Check for duplicate serial number | 0 |
| GET | `/model/:modelId` | Get merchandise by model | 0 |
| GET | `/site/:siteId` | Get merchandise by site | 0 |
| GET | `/:id` | Get single merchandise by ID | 0 |
| POST | `/` | Create new merchandise | 1 |
| PUT | `/:id` | Update merchandise | 1 |
| DELETE | `/:id` | Delete merchandise | 2 |
| GET | `/:id/location` | Get merchandise location | 0 |
| POST | `/:id/location` | Create/upsert location | 1 |
| PUT | `/:id/location` | Update location | 1 |
| DELETE | `/:id/location` | Delete location | 1 |
| GET | `/:id/replacement-chain` | Get equipment replacement history | 0 |

---

## Endpoints

### 1. List Merchandise

Retrieve a paginated list of all merchandise.

**Request**

```
GET /api-merchandise
```

**Query Parameters**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `page` | integer | No | 1 | Page number (minimum: 1) |
| `limit` | integer | No | 20 | Items per page (1-100) |
| `search` | string | No | - | Filter by serial number (partial match) |

**Response**

```json
{
  "data": [
    {
      "id": "uuid",
      "serial_no": "SN12345678",
      "site": {
        "id": "uuid",
        "name": "บริษัท ABC จำกัด"
      },
      "model": {
        "id": "uuid",
        "model": "UPS-1000",
        "name": "UPS 1000VA"
      },
      "distributor": {
        "id": "1234567890123",
        "name": "บริษัท ดิสทริบิวเตอร์ จำกัด"
      },
      "dealer": {
        "id": "9876543210987",
        "name": "บริษัท ดีลเลอร์ จำกัด"
      },
      "replaced_by": "SN87654321",
      "created_at": "2024-01-15T10:30:00Z",
      "updated_at": "2024-01-15T10:30:00Z"
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
```

**Example Request**

```bash
# List all merchandise
curl -X GET "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-merchandise" \
  -H "Authorization: Bearer <token>"

# List with pagination
curl -X GET "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-merchandise?page=2&limit=10" \
  -H "Authorization: Bearer <token>"

# Filter by serial number
curl -X GET "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-merchandise?search=SN123" \
  -H "Authorization: Bearer <token>"
```

---

### 2. Search Merchandise

Search merchandise by serial number with pagination.

**Request**

```
GET /api-merchandise/search
```

**Query Parameters**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `q` | string | No | - | Search query (serial number, partial match) |
| `site_id` | uuid | No | - | Filter by site ID |
| `page` | integer | No | 1 | Page number |
| `limit` | integer | No | 20 | Items per page |

**Response**

Same as List Merchandise response format.

**Example Request**

```bash
# Search by serial number
curl -X GET "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-merchandise/search?q=SN123" \
  -H "Authorization: Bearer <token>"

# Search within a specific site
curl -X GET "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-merchandise/search?q=UPS&site_id=550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer <token>"
```

---

### 3. Hint (Quick Search)

Returns up to 5 merchandise matching the query for autocomplete functionality.

**Request**

```
GET /api-merchandise/hint
```

**Query Parameters**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `q` | string | No | - | Search query (serial number, partial match) |
| `site_id` | uuid | No | - | Filter by site ID |

**Response**

```json
{
  "data": [
    {
      "id": "uuid",
      "serial_no": "SN12345678",
      "model_id": "uuid",
      "site_id": "uuid",
      "model_code": "UPS-1000",
      "model_name": "UPS 1000VA",
      "site_name": "บริษัท ABC จำกัด"
    }
  ]
}
```

**Example Request**

```bash
# Get hints for serial number starting with "SN"
curl -X GET "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-merchandise/hint?q=SN" \
  -H "Authorization: Bearer <token>"

# Get hints within a specific site
curl -X GET "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-merchandise/hint?q=UPS&site_id=550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer <token>"
```

---

### 4. Check Duplicate Serial Number

Check if a serial number already exists in the system.

**Request**

```
GET /api-merchandise/check-duplicate
```

**Query Parameters**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `serial_no` | string | **Yes** | - | Serial number to check |

**Response**

```json
{
  "data": {
    "is_duplicate": true,
    "merchandise": {
      "id": "uuid",
      "serial_no": "SN12345678",
      "model_id": "uuid",
      "site_id": "uuid",
      "created_at": "2024-01-15T10:30:00Z"
    }
  }
}
```

If not duplicate:

```json
{
  "data": {
    "is_duplicate": false,
    "merchandise": null
  }
}
```

**Example Request**

```bash
curl -X GET "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-merchandise/check-duplicate?serial_no=SN12345678" \
  -H "Authorization: Bearer <token>"
```

---

### 5. Get Merchandise by Model

Retrieve merchandise filtered by a specific model.

**Request**

```
GET /api-merchandise/model/:modelId
```

**Path Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `modelId` | uuid | **Yes** | Model ID |

**Query Parameters**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `page` | integer | No | 1 | Page number |
| `limit` | integer | No | 20 | Items per page |

**Response**

Same as List Merchandise response format.

**Example Request**

```bash
curl -X GET "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-merchandise/model/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer <token>"
```

---

### 6. Get Merchandise by Site

Retrieve merchandise filtered by a specific site.

**Request**

```
GET /api-merchandise/site/:siteId
```

**Path Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `siteId` | uuid | **Yes** | Site ID |

**Query Parameters**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `page` | integer | No | 1 | Page number |
| `limit` | integer | No | 20 | Items per page |

**Response**

Same as List Merchandise response format.

**Example Request**

```bash
curl -X GET "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-merchandise/site/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer <token>"
```

---

### 7. Get Merchandise by ID

Retrieve a single merchandise record by its ID.

**Request**

```
GET /api-merchandise/:id
```

**Path Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | uuid | **Yes** | Merchandise ID |

**Response**

```json
{
  "data": {
    "id": "uuid",
    "serial_no": "SN12345678",
    "site": {
      "id": "uuid",
      "name": "บริษัท ABC จำกัด"
    },
    "model": {
      "id": "uuid",
      "model": "UPS-1000",
      "name": "UPS 1000VA"
    },
    "distributor": {
      "id": "1234567890123",
      "name": "บริษัท ดิสทริบิวเตอร์ จำกัด"
    },
    "dealer": {
      "id": "9876543210987",
      "name": "บริษัท ดีลเลอร์ จำกัด"
    },
    "replaced_by": "SN87654321",
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T10:30:00Z"
  }
}
```

**Example Request**

```bash
curl -X GET "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-merchandise/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer <token>"
```

---

### 8. Create Merchandise

Create a new merchandise record.

**Request**

```
POST /api-merchandise
```

**Request Body**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `serial_no` | string | **Yes** | Unique serial number |
| `model_id` | uuid | **Yes** | Model ID reference |
| `site_id` | uuid | **Yes** | Site ID reference |
| `pm_count` | integer | No | PM (preventive maintenance) count |
| `distributor_id` | string | No | Distributor company tax ID |
| `dealer_id` | string | No | Dealer company tax ID |
| `replaced_by_id` | uuid | No | ID of merchandise that replaced this one |

**Request Body Example**

```json
{
  "serial_no": "SN12345678",
  "model_id": "550e8400-e29b-41d4-a716-446655440000",
  "site_id": "550e8400-e29b-41d4-a716-446655440001",
  "distributor_id": "1234567890123",
  "dealer_id": "9876543210987"
}
```

**Response**

Returns the created merchandise object (HTTP 201).

```json
{
  "data": {
    "id": "uuid",
    "serial_no": "SN12345678",
    "site": {
      "id": "uuid",
      "name": "บริษัท ABC จำกัด"
    },
    "model": {
      "id": "uuid",
      "model": "UPS-1000",
      "name": "UPS 1000VA"
    },
    "distributor": {
      "id": "1234567890123",
      "name": "บริษัท ดิสทริบิวเตอร์ จำกัด"
    },
    "dealer": null,
    "replaced_by": null,
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T10:30:00Z"
  }
}
```

**Example Request**

```bash
curl -X POST "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-merchandise" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "serial_no": "SN12345678",
    "model_id": "550e8400-e29b-41d4-a716-446655440000",
    "site_id": "550e8400-e29b-41d4-a716-446655440001"
  }'
```

---

### 9. Update Merchandise

Update an existing merchandise record.

**Request**

```
PUT /api-merchandise/:id
```

**Path Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | uuid | **Yes** | Merchandise ID |

**Request Body**

All fields are optional. Only provided fields will be updated.

| Field | Type | Description |
|-------|------|-------------|
| `serial_no` | string | Serial number |
| `model_id` | uuid | Model ID reference |
| `site_id` | uuid | Site ID reference |
| `pm_count` | integer | PM count |
| `distributor_id` | string | Distributor company tax ID |
| `dealer_id` | string | Dealer company tax ID |
| `replaced_by_id` | uuid | ID of merchandise that replaced this one |

**Request Body Example**

```json
{
  "site_id": "550e8400-e29b-41d4-a716-446655440002",
  "pm_count": 5
}
```

**Response**

Returns the updated merchandise object.

**Example Request**

```bash
curl -X PUT "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-merchandise/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "site_id": "550e8400-e29b-41d4-a716-446655440002"
  }'
```

---

### 10. Delete Merchandise

Delete a merchandise record.

**Request**

```
DELETE /api-merchandise/:id
```

**Path Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | uuid | **Yes** | Merchandise ID |

**Response**

```json
{
  "data": {
    "message": "ลบข้อมูลสำเร็จ"
  }
}
```

**Example Request**

```bash
curl -X DELETE "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-merchandise/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer <token>"
```

---

### 11. Get Merchandise Location

Retrieve the physical location details for a merchandise item.

**Request**

```
GET /api-merchandise/:id/location
```

**Path Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | uuid | **Yes** | Merchandise ID |

**Response**

```json
{
  "data": {
    "id": "uuid",
    "merchandise_id": "uuid",
    "building": "อาคาร A",
    "floor": "3",
    "room": "301",
    "zone": "โซน B",
    "notes": "ติดตั้งใกล้หน้าต่าง",
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T10:30:00Z"
  }
}
```

Returns `null` if no location is set.

**Example Request**

```bash
curl -X GET "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-merchandise/550e8400-e29b-41d4-a716-446655440000/location" \
  -H "Authorization: Bearer <token>"
```

---

### 12. Create/Upsert Location

Create or update the location for a merchandise item. If a location already exists, it will be updated.

**Request**

```
POST /api-merchandise/:id/location
```

**Path Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | uuid | **Yes** | Merchandise ID |

**Request Body**

At least one field is required.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `building` | string | No | Building name/number |
| `floor` | string | No | Floor number |
| `room` | string | No | Room number/name |
| `zone` | string | No | Zone designation |
| `notes` | string | No | Additional notes |

**Request Body Example**

```json
{
  "building": "อาคาร A",
  "floor": "3",
  "room": "301",
  "zone": "โซน B",
  "notes": "ติดตั้งใกล้หน้าต่าง"
}
```

**Response**

Returns the created/updated location object (HTTP 201).

**Example Request**

```bash
curl -X POST "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-merchandise/550e8400-e29b-41d4-a716-446655440000/location" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "building": "อาคาร A",
    "floor": "3",
    "room": "301"
  }'
```

---

### 13. Update Location

Update specific fields of an existing location.

**Request**

```
PUT /api-merchandise/:id/location
```

**Path Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | uuid | **Yes** | Merchandise ID |

**Request Body**

All fields are optional. Only provided fields will be updated.

| Field | Type | Description |
|-------|------|-------------|
| `building` | string | Building name/number |
| `floor` | string | Floor number |
| `room` | string | Room number/name |
| `zone` | string | Zone designation |
| `notes` | string | Additional notes |

**Response**

Returns the updated location object.

**Example Request**

```bash
curl -X PUT "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-merchandise/550e8400-e29b-41d4-a716-446655440000/location" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "floor": "4",
    "notes": "ย้ายไปชั้น 4"
  }'
```

---

### 14. Delete Location

Delete the location record for a merchandise item.

**Request**

```
DELETE /api-merchandise/:id/location
```

**Path Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | uuid | **Yes** | Merchandise ID |

**Response**

```json
{
  "data": {
    "message": "ลบตำแหน่งสำเร็จ"
  }
}
```

**Example Request**

```bash
curl -X DELETE "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-merchandise/550e8400-e29b-41d4-a716-446655440000/location" \
  -H "Authorization: Bearer <token>"
```

---

### 15. Get Replacement Chain

Get the complete replacement history chain for a merchandise item. Traverses both predecessors (what was replaced) and successors (what replaced it).

**Request**

```
GET /api-merchandise/:id/replacement-chain
```

**Path Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | uuid | **Yes** | Merchandise ID |

**Response**

```json
{
  "data": {
    "chain": [
      {
        "id": "uuid-oldest",
        "serial_no": "SN00000001",
        "model": {
          "id": "uuid",
          "model": "UPS-1000",
          "name": "UPS 1000VA"
        },
        "site": {
          "id": "uuid",
          "name": "บริษัท ABC จำกัด"
        },
        "replaced_by_id": "uuid-middle",
        "created_at": "2022-01-15T10:30:00Z",
        "is_current": false,
        "position": 1
      },
      {
        "id": "uuid-middle",
        "serial_no": "SN00000002",
        "model": {
          "id": "uuid",
          "model": "UPS-1000",
          "name": "UPS 1000VA"
        },
        "site": {
          "id": "uuid",
          "name": "บริษัท ABC จำกัด"
        },
        "replaced_by_id": "uuid-newest",
        "created_at": "2023-01-15T10:30:00Z",
        "is_current": true,
        "position": 2
      },
      {
        "id": "uuid-newest",
        "serial_no": "SN00000003",
        "model": {
          "id": "uuid",
          "model": "UPS-2000",
          "name": "UPS 2000VA"
        },
        "site": {
          "id": "uuid",
          "name": "บริษัท ABC จำกัด"
        },
        "replaced_by_id": null,
        "created_at": "2024-01-15T10:30:00Z",
        "is_current": false,
        "position": 3
      }
    ],
    "total": 3,
    "current_position": 2
  }
}
```

**Response Fields**

| Field | Type | Description |
|-------|------|-------------|
| `chain` | array | Ordered list of merchandise in the replacement chain (oldest to newest) |
| `total` | integer | Total number of items in the chain |
| `current_position` | integer | Position of the queried merchandise in the chain (1-indexed) |

**Chain Item Fields**

| Field | Type | Description |
|-------|------|-------------|
| `id` | uuid | Merchandise ID |
| `serial_no` | string | Serial number |
| `model` | object | Model details (id, model code, name) |
| `site` | object | Site details (id, name) |
| `replaced_by_id` | uuid | ID of the merchandise that replaced this one |
| `created_at` | timestamp | Creation timestamp |
| `is_current` | boolean | True if this is the queried merchandise |
| `position` | integer | Position in chain (1-indexed, 1 = oldest) |

**Example Request**

```bash
curl -X GET "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-merchandise/550e8400-e29b-41d4-a716-446655440000/replacement-chain" \
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
| 400 | กรุณาระบุ serial number | Missing required serial_no field |
| 400 | กรุณาระบุ model | Missing required model_id field |
| 400 | กรุณาระบุ site | Missing required site_id field |
| 400 | กรุณาระบุ serial_no ใน query parameter | Missing serial_no query param for duplicate check |
| 400 | กรุณาระบุตำแหน่งอย่างน้อย 1 ฟิลด์ | Location upsert requires at least one field |
| 400 | ข้อมูลซ้ำในระบบ | Duplicate serial number on create |
| 400 | มีข้อมูลอ้างอิงที่ใช้งานอยู่ ไม่สามารถลบได้ | Cannot delete - foreign key references exist |
| 401 | ไม่มีสิทธิ์เข้าถึง | Missing or invalid authentication token |
| 403 | ไม่มีสิทธิ์ดำเนินการ | Insufficient permission level |
| 404 | ไม่พบข้อมูล | Merchandise not found |
| 404 | ไม่พบ model ที่ระบุ | Referenced model not found |
| 404 | ไม่พบ site ที่ระบุ | Referenced site not found |
| 404 | ไม่พบสินค้าที่ระบุ | Merchandise not found (for location/chain operations) |
| 404 | ไม่พบข้อมูลตำแหน่งสำหรับสินค้านี้ | Location record not found for update |
| 500 | ไม่สามารถสร้างข้อมูลได้ | Database error on create |
| 500 | ไม่สามารถอัพเดทข้อมูลได้ | Database error on update |
| 500 | ไม่สามารถลบข้อมูลได้ | Database error on delete |

---

## Database Tables

### main_merchandise

Primary merchandise data table.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | uuid | No | Primary key |
| serial_no | text | No | Unique serial number |
| model_id | uuid | No | FK to main_models |
| site_id | uuid | No | FK to main_sites |
| pm_count | integer | Yes | Preventive maintenance count |
| distributor_id | text | Yes | FK to main_companies (tax_id) |
| dealer_id | text | Yes | FK to main_companies (tax_id) |
| replaced_by_id | uuid | Yes | FK to main_merchandise (self-reference) |
| created_at | timestamptz | No | Creation timestamp |
| updated_at | timestamptz | No | Last update timestamp |

### child_merchandise_location

Physical location tracking within sites.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | uuid | No | Primary key |
| merchandise_id | uuid | No | FK to main_merchandise |
| building | text | Yes | Building name/number |
| floor | text | Yes | Floor number |
| room | text | Yes | Room number/name |
| zone | text | Yes | Zone designation |
| notes | text | Yes | Additional notes |
| created_at | timestamptz | No | Creation timestamp |
| updated_at | timestamptz | No | Last update timestamp |

---

## Related Endpoints

- **Models API** (`/api-models`) - Model reference data
- **Sites API** - Site reference data
- **Companies API** (`/api-companies`) - Distributor/dealer company data
- **Tickets API** (`/api-tickets`) - Work orders that may reference merchandise
