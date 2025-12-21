# Package Services API

## Overview

The Package Services API manages the catalog of services that can be included in model starter packages. These services represent offerings like warranties, installation, and maintenance.

**Base URL**: `/functions/v1/api-package-services`

**Authentication**: All endpoints require Bearer token authentication.

---

## Endpoints

### List Package Services

Get all package services with pagination and optional filters.

**Endpoint**: `GET /`

**Required Level**: 0 (all authenticated users)

**Query Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `page` | number | No | Page number (default: 1) |
| `limit` | number | No | Items per page (default: 50, max: 100) |
| `category` | string | No | Filter by category |
| `is_active` | boolean | No | Filter by active status |
| `q` | string | No | Search in code, name_th, name_en |

**Example Request**:
```http
GET /functions/v1/api-package-services?page=1&limit=20&category=warranty
Authorization: Bearer <token>
```

**Example Response**:
```json
{
  "data": {
    "data": [
      {
        "id": "123e4567-e89b-12d3-a456-426614174000",
        "code": "SVC-WARRANTY-1Y",
        "name_th": "รับประกัน 1 ปี",
        "name_en": "1 Year Warranty",
        "description": "Standard warranty coverage for 1 year",
        "category": "warranty",
        "duration_months": 12,
        "is_active": true,
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
}
```

---

### Get Package Service by ID

Get a single package service by its ID.

**Endpoint**: `GET /:id`

**Required Level**: 0 (all authenticated users)

**Path Parameters**:
- `id` (required): Package Service ID (UUID)

**Example Request**:
```http
GET /functions/v1/api-package-services/123e4567-e89b-12d3-a456-426614174000
Authorization: Bearer <token>
```

**Example Response**:
```json
{
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "code": "SVC-WARRANTY-1Y",
    "name_th": "รับประกัน 1 ปี",
    "name_en": "1 Year Warranty",
    "description": "Standard warranty coverage for 1 year",
    "category": "warranty",
    "duration_months": 12,
    "is_active": true,
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  }
}
```

---

### Create Package Service

Create a new package service.

**Endpoint**: `POST /`

**Required Level**: 1 (create operations)

**Request Body**:
```json
{
  "code": "SVC-WARRANTY-1Y",
  "name_th": "รับประกัน 1 ปี",
  "name_en": "1 Year Warranty",
  "description": "Standard warranty coverage for 1 year",
  "category": "warranty",
  "duration_months": 12,
  "is_active": true
}
```

**Required Fields**:
- `code` - Unique service code
- `name_th` - Thai name

**Optional Fields**:
- `name_en` - English name
- `description` - Service description
- `category` - Service category (e.g., warranty, installation, maintenance)
- `duration_months` - Service duration in months
- `is_active` - Active status (default: true)

**Example Response** (201 Created):
```json
{
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "code": "SVC-WARRANTY-1Y",
    "name_th": "รับประกัน 1 ปี",
    "name_en": "1 Year Warranty",
    "description": "Standard warranty coverage for 1 year",
    "category": "warranty",
    "duration_months": 12,
    "is_active": true,
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  }
}
```

---

### Update Package Service

Update an existing package service.

**Endpoint**: `PUT /:id`

**Required Level**: 1 (update operations)

**Path Parameters**:
- `id` (required): Package Service ID (UUID)

**Request Body**:
```json
{
  "name_th": "รับประกัน 1 ปี (ปรับปรุง)",
  "duration_months": 12
}
```

**Note**: All fields are optional. Only provided fields will be updated.

---

### Delete Package Service

Delete a package service.

**Endpoint**: `DELETE /:id`

**Required Level**: 2 (admin operations)

**Path Parameters**:
- `id` (required): Package Service ID (UUID)

**Note**: Cannot delete a service that is currently used in any model's package.

**Example Response**:
```json
{
  "data": {
    "message": "ลบรายการบริการสำเร็จ"
  }
}
```

---

## Error Responses

### 400 Bad Request
```json
{
  "error": "รหัสบริการซ้ำในระบบ"
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
  "error": "ไม่พบรายการบริการ"
}
```

### 409 Conflict (Cannot Delete)
```json
{
  "error": "ไม่สามารถลบได้ เนื่องจากมีการใช้งานในแพ็คเกจของ Model"
}
```

---

## Common Categories

- `warranty` - Warranty services
- `installation` - Installation services
- `maintenance` - Maintenance services
- `support` - Support services
- `training` - Training services

---

## Notes

- Service codes must be unique
- Services can be linked to multiple model packages via the junction table
- Deleting a service will fail if it's used in any model package
- `duration_months` is useful for tracking warranty or service contract duration

