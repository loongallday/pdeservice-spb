# Models API

## Overview

The Models API provides search functionality for equipment models. It allows searching by model description (name) and code.

**Base URL**: `/functions/v1/api-models`

**Authentication**: All endpoints require Bearer token authentication.

---

## Endpoints

### Search Models

Search for models by description and/or code.

**Endpoint**: `GET /search`

**Required Level**: 0 (all authenticated users)

**Query Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `description` | string | No | Search in model description/name (partial match, case-insensitive) |
| `code` | string | No | Search in model code (partial match, case-insensitive) |

**Notes**:
- If no parameters are provided, returns all models (up to 20 items)
- If both parameters are provided, results will match either condition (OR logic)
- Results are limited to 20 items, ordered by creation date (newest first)

**Example Request** (search by description):
```http
GET /functions/v1/api-models/search?description=Premium
Authorization: Bearer <token>
```

**Example Request** (search by code):
```http
GET /functions/v1/api-models/search?code=MODEL-001
Authorization: Bearer <token>
```

**Example Request** (search by both):
```http
GET /functions/v1/api-models/search?description=Machine&code=MODEL
Authorization: Bearer <token>
```

**Example Response**:
```json
{
  "data": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "model": "MODEL-001",
      "name": "Premium Machine Model 001",
      "website_url": "https://manufacturer.com/model-001",
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z"
    },
    {
      "id": "123e4567-e89b-12d3-a456-426614174001",
      "model": "MODEL-002",
      "name": "Standard Machine Model 002",
      "website_url": "https://manufacturer.com/model-002",
      "created_at": "2024-01-02T00:00:00Z",
      "updated_at": "2024-01-02T00:00:00Z"
    }
  ]
}
```

**Response Fields**:
- `id`: Model ID (UUID)
- `model`: Model code (unique identifier)
- `name`: Model description/display name
- `website_url`: URL to model documentation or product page (optional)
- `created_at`: Creation timestamp
- `updated_at`: Last update timestamp

---

### Create Model

Create a new model.

**Endpoint**: `POST /`

**Required Level**: 1 (create operations)

**Request Body**:
```json
{
  "model": "MODEL-001",
  "name": "Model Display Name",
  "website_url": "https://manufacturer.com/model-001"
}
```

**Required Fields**:
- `model` - Model code (unique)

**Optional Fields**:
- `name` - Model description/display name
- `website_url` - URL to model documentation or product page

**Example Request**:
```http
POST /functions/v1/api-models
Authorization: Bearer <token>
Content-Type: application/json

{
  "model": "MODEL-001",
  "name": "Premium Machine Model 001",
  "website_url": "https://manufacturer.com/products/model-001"
}
```

**Example Response** (201 Created):
```json
{
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "model": "MODEL-001",
    "name": "Premium Machine Model 001",
    "website_url": "https://manufacturer.com/products/model-001",
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  }
}
```

---

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
  "error": "Not found"
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

### Search by Description
```bash
curl -X GET "https://your-project.supabase.co/functions/v1/api-models/search?description=Premium" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Search by Code
```bash
curl -X GET "https://your-project.supabase.co/functions/v1/api-models/search?code=MODEL-001" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Search by Both
```bash
curl -X GET "https://your-project.supabase.co/functions/v1/api-models/search?description=Machine&code=MODEL" \
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

---

## Notes

- The search is case-insensitive and supports partial matching
- Results are limited to 20 items per request
- If no search parameters are provided, an empty array is returned
- Model codes are unique identifiers used in merchandise and PM summary APIs
