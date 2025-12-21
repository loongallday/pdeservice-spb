# Package Items API

## Overview

The Package Items API manages the catalog of items that can be included in model starter packages. These items represent physical components like batteries, cables, and accessories.

**Base URL**: `/functions/v1/api-package-items`

**Authentication**: All endpoints require Bearer token authentication.

---

## Endpoints

### List Package Items

Get all package items with pagination and optional filters.

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
GET /functions/v1/api-package-items?page=1&limit=20&category=battery
Authorization: Bearer <token>
```

**Example Response**:
```json
{
  "data": {
    "data": [
      {
        "id": "123e4567-e89b-12d3-a456-426614174000",
        "code": "BAT-12V-7AH",
        "name_th": "แบตเตอรี่ 12V 7Ah",
        "name_en": "Battery 12V 7Ah",
        "description": "Sealed Lead-Acid Battery",
        "category": "battery",
        "unit": "piece",
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

### Get Package Item by ID

Get a single package item by its ID.

**Endpoint**: `GET /:id`

**Required Level**: 0 (all authenticated users)

**Path Parameters**:
- `id` (required): Package Item ID (UUID)

**Example Request**:
```http
GET /functions/v1/api-package-items/123e4567-e89b-12d3-a456-426614174000
Authorization: Bearer <token>
```

**Example Response**:
```json
{
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "code": "BAT-12V-7AH",
    "name_th": "แบตเตอรี่ 12V 7Ah",
    "name_en": "Battery 12V 7Ah",
    "description": "Sealed Lead-Acid Battery",
    "category": "battery",
    "unit": "piece",
    "is_active": true,
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  }
}
```

---

### Create Package Item

Create a new package item.

**Endpoint**: `POST /`

**Required Level**: 1 (create operations)

**Request Body**:
```json
{
  "code": "BAT-12V-7AH",
  "name_th": "แบตเตอรี่ 12V 7Ah",
  "name_en": "Battery 12V 7Ah",
  "description": "Sealed Lead-Acid Battery",
  "category": "battery",
  "unit": "piece",
  "is_active": true
}
```

**Required Fields**:
- `code` - Unique item code
- `name_th` - Thai name

**Optional Fields**:
- `name_en` - English name
- `description` - Item description
- `category` - Item category (e.g., battery, cable, accessory)
- `unit` - Unit of measurement (default: "piece")
- `is_active` - Active status (default: true)

**Example Response** (201 Created):
```json
{
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "code": "BAT-12V-7AH",
    "name_th": "แบตเตอรี่ 12V 7Ah",
    "name_en": "Battery 12V 7Ah",
    "description": "Sealed Lead-Acid Battery",
    "category": "battery",
    "unit": "piece",
    "is_active": true,
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  }
}
```

---

### Update Package Item

Update an existing package item.

**Endpoint**: `PUT /:id`

**Required Level**: 1 (update operations)

**Path Parameters**:
- `id` (required): Package Item ID (UUID)

**Request Body**:
```json
{
  "name_th": "แบตเตอรี่ 12V 7Ah (ปรับปรุง)",
  "is_active": true
}
```

**Note**: All fields are optional. Only provided fields will be updated.

---

### Delete Package Item

Delete a package item.

**Endpoint**: `DELETE /:id`

**Required Level**: 2 (admin operations)

**Path Parameters**:
- `id` (required): Package Item ID (UUID)

**Note**: Cannot delete an item that is currently used in any model's package.

**Example Response**:
```json
{
  "data": {
    "message": "ลบรายการอุปกรณ์สำเร็จ"
  }
}
```

---

## Error Responses

### 400 Bad Request
```json
{
  "error": "รหัสอุปกรณ์ซ้ำในระบบ"
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
  "error": "ไม่พบรายการอุปกรณ์"
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

- `battery` - Batteries
- `cable` - Cables and wires
- `accessory` - Accessories
- `connector` - Connectors and adapters
- `mount` - Mounting hardware

---

## Notes

- Item codes must be unique
- Items can be linked to multiple model packages via the junction table
- Deleting an item will fail if it's used in any model package

