# API Models

## Overview

The Models API manages the equipment model catalog (UPS, batteries, accessories, etc.) in the Field Service Management system. Models represent equipment types with their specifications, and can be organized into packages containing component models and services.

This API allows users to:
- Search and browse equipment models with filtering
- Create, update, and delete model entries
- Manage model packages (component models and services bundled with a parent model)
- Perform fast code validation for barcode scanning

---

## Base URL

```
/api-models
```

---

## Authentication

All endpoints require a valid JWT token in the Authorization header, **except `/check`** which is public for fast barcode scanning.

```
Authorization: Bearer <jwt_token>
```

**Permission Levels:**

| Level | Role | Capabilities |
|-------|------|--------------|
| 0 | Technician L1+ | Read-only (search, get, view packages) |
| 1 | Assigner, PM, Sales+ | Create, update, delete models and manage packages |

---

## Endpoints Summary

| Method | Path | Description | Auth Required |
|--------|------|-------------|---------------|
| GET | `/search` | Search models with filters | Yes (Level 0+) |
| GET | `/check` | Fast code validation (barcode) | **No** |
| GET | `/:id` | Get model by ID | Yes (Level 0+) |
| POST | `/` | Create new model | Yes (Level 1+) |
| PUT | `/:id` | Update model | Yes (Level 1+) |
| DELETE | `/:id` | Delete model | Yes (Level 1+) |
| GET | `/:modelId/package` | Get model package | Yes (Level 0+) |
| POST | `/:modelId/package/components` | Add component to package | Yes (Level 1+) |
| DELETE | `/:modelId/package/components/:componentId` | Remove component from package | Yes (Level 1+) |
| POST | `/:modelId/package/services` | Add service to package | Yes (Level 1+) |
| DELETE | `/:modelId/package/services/:serviceId` | Remove service from package | Yes (Level 1+) |

---

## Endpoints

### 1. Search Models

Search models by description, code, category, and status with pagination.

**Request**

```
GET /api-models/search
```

**Query Parameters**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `description` | string | No | - | Search in name, name_th, name_en (case-insensitive) |
| `code` | string | No | - | Search in model code (case-insensitive) |
| `category` | string | No | - | Filter by exact category |
| `is_active` | boolean | No | - | Filter by active status (true/false) |
| `has_serial` | boolean | No | - | Filter by serial tracking (true/false) |
| `page` | integer | No | 1 | Page number (minimum: 1) |
| `limit` | integer | No | 20 | Items per page |

**Response**

```json
{
  "data": [
    {
      "id": "uuid",
      "model": "UPS-3000RT",
      "name": "Smart-UPS 3000VA",
      "name_th": "เครื่องสำรองไฟ 3000VA",
      "name_en": "Smart-UPS 3000VA Rack Mount",
      "description": "3000VA/2700W online UPS",
      "category": "ups",
      "unit": "เครื่อง",
      "is_active": true,
      "has_serial": true,
      "website_url": "https://example.com/ups-3000",
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
# Search by description
curl -X GET "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-models/search?description=UPS" \
  -H "Authorization: Bearer <token>"

# Search by code with category filter
curl -X GET "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-models/search?code=BAT&category=battery&is_active=true" \
  -H "Authorization: Bearer <token>"

# Filter serial-tracked items
curl -X GET "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-models/search?has_serial=true&page=2&limit=10" \
  -H "Authorization: Bearer <token>"
```

---

### 2. Check Code (Fast Validation)

Fast code validation for barcode scanning. **No authentication required** for speed.

**Request**

```
GET /api-models/check?code=<model_code>
```

**Query Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `code` | string | Yes | Exact model code to check |

**Response (Found)**

```json
{
  "data": {
    "exists": true,
    "id": "uuid",
    "model": "UPS-3000RT",
    "name": "Smart-UPS 3000VA",
    "name_th": "เครื่องสำรองไฟ 3000VA",
    "unit": "เครื่อง",
    "has_serial": true
  }
}
```

**Response (Not Found)**

```json
{
  "data": {
    "exists": false
  }
}
```

**Example Request**

```bash
# Check if model code exists
curl -X GET "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-models/check?code=UPS-3000RT"
```

---

### 3. Get Model by ID

Retrieve a single model by its UUID.

**Request**

```
GET /api-models/:id
```

**Path Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | uuid | Yes | Model UUID |

**Response**

```json
{
  "data": {
    "id": "uuid",
    "model": "UPS-3000RT",
    "name": "Smart-UPS 3000VA",
    "name_th": "เครื่องสำรองไฟ 3000VA",
    "name_en": "Smart-UPS 3000VA Rack Mount",
    "description": "3000VA/2700W online UPS",
    "category": "ups",
    "unit": "เครื่อง",
    "is_active": true,
    "has_serial": true,
    "website_url": "https://example.com/ups-3000",
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T10:30:00Z"
  }
}
```

**Example Request**

```bash
curl -X GET "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-models/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer <token>"
```

---

### 4. Create Model

Create a new equipment model.

**Request**

```
POST /api-models
```

**Request Body**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `model` | string | Yes | Unique model code (e.g., "UPS-3000RT") |
| `name` | string | No | Model name (default) |
| `name_th` | string | No | Thai name |
| `name_en` | string | No | English name |
| `description` | string | No | Description |
| `category` | string | No | Category (e.g., "ups", "battery", "accessory") |
| `unit` | string | No | Unit of measurement (e.g., "เครื่อง", "ลูก", "ชุด") |
| `is_active` | boolean | No | Active status (default: true) |
| `has_serial` | boolean | No | Whether items need serial tracking (default: false) |
| `website_url` | string | No | Product website URL |

**Request Body Example**

```json
{
  "model": "UPS-3000RT",
  "name": "Smart-UPS 3000VA",
  "name_th": "เครื่องสำรองไฟ 3000VA",
  "name_en": "Smart-UPS 3000VA Rack Mount",
  "description": "3000VA/2700W online UPS with rack mount kit",
  "category": "ups",
  "unit": "เครื่อง",
  "is_active": true,
  "has_serial": true,
  "website_url": "https://example.com/ups-3000"
}
```

**Response**

```json
{
  "data": {
    "id": "uuid",
    "model": "UPS-3000RT",
    "name": "Smart-UPS 3000VA",
    "name_th": "เครื่องสำรองไฟ 3000VA",
    "name_en": "Smart-UPS 3000VA Rack Mount",
    "description": "3000VA/2700W online UPS with rack mount kit",
    "category": "ups",
    "unit": "เครื่อง",
    "is_active": true,
    "has_serial": true,
    "website_url": "https://example.com/ups-3000",
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T10:30:00Z"
  }
}
```

**Example Request**

```bash
curl -X POST "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-models" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "UPS-3000RT",
    "name": "Smart-UPS 3000VA",
    "name_th": "เครื่องสำรองไฟ 3000VA",
    "category": "ups",
    "unit": "เครื่อง",
    "has_serial": true
  }'
```

---

### 5. Update Model

Update an existing model.

**Request**

```
PUT /api-models/:id
```

**Path Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | uuid | Yes | Model UUID |

**Request Body**

Same fields as Create Model. Only include fields to update.

**Request Body Example**

```json
{
  "name_th": "เครื่องสำรองไฟ 3000VA (อัพเดท)",
  "is_active": false
}
```

**Response**

```json
{
  "data": {
    "id": "uuid",
    "model": "UPS-3000RT",
    "name": "Smart-UPS 3000VA",
    "name_th": "เครื่องสำรองไฟ 3000VA (อัพเดท)",
    "name_en": "Smart-UPS 3000VA Rack Mount",
    "description": "3000VA/2700W online UPS",
    "category": "ups",
    "unit": "เครื่อง",
    "is_active": false,
    "has_serial": true,
    "website_url": "https://example.com/ups-3000",
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-16T08:00:00Z"
  }
}
```

**Example Request**

```bash
curl -X PUT "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-models/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"is_active": false}'
```

---

### 6. Delete Model

Delete a model. Will fail if the model has associated merchandise.

**Request**

```
DELETE /api-models/:id
```

**Path Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | uuid | Yes | Model UUID |

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
curl -X DELETE "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-models/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer <token>"
```

---

## Package Management

Models can have packages containing component models (child equipment) and services (warranties, maintenance plans). This is useful for bundled products or systems.

### 7. Get Model Package

Get a model with its component models and package services.

**Request**

```
GET /api-models/:modelId/package
```

**Path Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `modelId` | uuid | Yes | Parent model UUID |

**Response**

```json
{
  "data": {
    "model": {
      "id": "uuid",
      "model": "UPS-SYSTEM-01",
      "name": "Complete UPS System",
      "name_th": "ชุดระบบ UPS ครบชุด",
      "category": "system",
      "unit": "ชุด",
      "is_active": true
    },
    "components": [
      {
        "id": "uuid",
        "quantity": 1,
        "note": "Main unit",
        "display_order": 0,
        "created_at": "2024-01-15T10:30:00Z",
        "component": {
          "id": "uuid",
          "model": "UPS-3000RT",
          "name": "Smart-UPS 3000VA",
          "name_th": "เครื่องสำรองไฟ 3000VA",
          "name_en": "Smart-UPS 3000VA",
          "description": "3000VA UPS",
          "category": "ups",
          "unit": "เครื่อง",
          "is_active": true
        }
      },
      {
        "id": "uuid",
        "quantity": 4,
        "note": "Battery pack",
        "display_order": 1,
        "created_at": "2024-01-15T10:30:00Z",
        "component": {
          "id": "uuid",
          "model": "BAT-12V-9AH",
          "name": "12V 9Ah Battery",
          "name_th": "แบตเตอรี่ 12V 9Ah",
          "name_en": "12V 9Ah Sealed Battery",
          "description": "Sealed lead-acid battery",
          "category": "battery",
          "unit": "ลูก",
          "is_active": true
        }
      }
    ],
    "services": [
      {
        "id": "uuid",
        "terms": "1 year on-site warranty",
        "note": null,
        "display_order": 0,
        "created_at": "2024-01-15T10:30:00Z",
        "service": {
          "id": "uuid",
          "code": "WARRANTY-1Y",
          "name_th": "รับประกัน 1 ปี",
          "name_en": "1 Year Warranty",
          "description": "Standard on-site warranty",
          "category": "warranty",
          "duration_months": 12,
          "is_active": true
        }
      }
    ]
  }
}
```

**Example Request**

```bash
curl -X GET "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-models/550e8400-e29b-41d4-a716-446655440000/package" \
  -H "Authorization: Bearer <token>"
```

---

### 8. Add Component to Package

Add a component model to a parent model's package.

**Request**

```
POST /api-models/:modelId/package/components
```

**Path Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `modelId` | uuid | Yes | Parent model UUID |

**Request Body**

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `component_model_id` | uuid | Yes | - | Component model UUID |
| `quantity` | integer | No | 1 | Quantity of component |
| `note` | string | No | null | Note about this component |
| `display_order` | integer | No | 0 | Sort order |

**Request Body Example**

```json
{
  "component_model_id": "550e8400-e29b-41d4-a716-446655440001",
  "quantity": 4,
  "note": "Battery pack",
  "display_order": 1
}
```

**Response**

```json
{
  "data": {
    "id": "uuid",
    "quantity": 4,
    "note": "Battery pack",
    "display_order": 1,
    "created_at": "2024-01-15T10:30:00Z",
    "component": {
      "id": "uuid",
      "model": "BAT-12V-9AH",
      "name": "12V 9Ah Battery",
      "name_th": "แบตเตอรี่ 12V 9Ah",
      "name_en": "12V 9Ah Sealed Battery",
      "description": "Sealed lead-acid battery",
      "category": "battery",
      "unit": "ลูก"
    }
  }
}
```

**Example Request**

```bash
curl -X POST "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-models/550e8400-e29b-41d4-a716-446655440000/package/components" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "component_model_id": "550e8400-e29b-41d4-a716-446655440001",
    "quantity": 4,
    "note": "Battery pack"
  }'
```

---

### 9. Remove Component from Package

Remove a component model from a parent model's package.

**Request**

```
DELETE /api-models/:modelId/package/components/:componentModelId
```

**Path Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `modelId` | uuid | Yes | Parent model UUID |
| `componentModelId` | uuid | Yes | Component model UUID to remove |

**Response**

```json
{
  "data": {
    "message": "ลบอุปกรณ์จากแพ็คเกจสำเร็จ"
  }
}
```

**Example Request**

```bash
curl -X DELETE "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-models/550e8400-e29b-41d4-a716-446655440000/package/components/550e8400-e29b-41d4-a716-446655440001" \
  -H "Authorization: Bearer <token>"
```

---

### 10. Add Service to Package

Add a service to a model's package (e.g., warranty, maintenance plan).

**Request**

```
POST /api-models/:modelId/package/services
```

**Path Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `modelId` | uuid | Yes | Model UUID |

**Request Body**

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `service_id` | uuid | Yes | - | Service UUID |
| `terms` | string | No | null | Specific terms for this service |
| `note` | string | No | null | Note about this service |
| `display_order` | integer | No | 0 | Sort order |

**Request Body Example**

```json
{
  "service_id": "550e8400-e29b-41d4-a716-446655440002",
  "terms": "1 year on-site warranty",
  "display_order": 0
}
```

**Response**

```json
{
  "data": {
    "id": "uuid",
    "terms": "1 year on-site warranty",
    "note": null,
    "display_order": 0,
    "created_at": "2024-01-15T10:30:00Z",
    "service": {
      "id": "uuid",
      "code": "WARRANTY-1Y",
      "name_th": "รับประกัน 1 ปี",
      "name_en": "1 Year Warranty",
      "description": "Standard on-site warranty",
      "category": "warranty",
      "duration_months": 12
    }
  }
}
```

**Example Request**

```bash
curl -X POST "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-models/550e8400-e29b-41d4-a716-446655440000/package/services" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "service_id": "550e8400-e29b-41d4-a716-446655440002",
    "terms": "1 year on-site warranty"
  }'
```

---

### 11. Remove Service from Package

Remove a service from a model's package.

**Request**

```
DELETE /api-models/:modelId/package/services/:serviceId
```

**Path Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `modelId` | uuid | Yes | Model UUID |
| `serviceId` | uuid | Yes | Service UUID to remove |

**Response**

```json
{
  "data": {
    "message": "ลบบริการจากแพ็คเกจสำเร็จ"
  }
}
```

**Example Request**

```bash
curl -X DELETE "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-models/550e8400-e29b-41d4-a716-446655440000/package/services/550e8400-e29b-41d4-a716-446655440002" \
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
| 400 | กรุณาระบุ model code | Model code is required for creation |
| 400 | model code ซ้ำในระบบ | Duplicate model code |
| 400 | รายการอุปกรณ์นี้มีอยู่ในแพ็คเกจแล้ว | Component already exists in package |
| 400 | รายการบริการนี้มีอยู่ในแพ็คเกจแล้ว | Service already exists in package |
| 400 | ไม่พบรายการอุปกรณ์ที่ระบุ | Component model not found |
| 400 | ไม่พบรายการบริการที่ระบุ | Service not found |
| 400 | ไม่สามารถลบ model ที่มี merchandise ใช้งานอยู่ | Cannot delete model with active merchandise |
| 401 | ไม่มีสิทธิ์เข้าถึง | Missing or invalid authentication token |
| 403 | ไม่มีสิทธิ์ดำเนินการ | Insufficient permission level |
| 404 | ไม่พบข้อมูล | Model not found |
| 404 | Not found | Invalid endpoint path |
| 500 | ไม่สามารถสร้างข้อมูลได้ | Database error during creation |
| 500 | ไม่สามารถอัพเดทข้อมูลได้ | Database error during update |
| 500 | ไม่สามารถลบข้อมูลได้ | Database error during deletion |

---

## Model Object Fields

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `id` | uuid | No | Unique model identifier |
| `model` | string | No | Unique model code (e.g., "UPS-3000RT") |
| `name` | string | Yes | Model name (default) |
| `name_th` | string | Yes | Thai name |
| `name_en` | string | Yes | English name |
| `description` | string | Yes | Model description |
| `category` | string | Yes | Category (ups, battery, accessory, etc.) |
| `unit` | string | Yes | Unit of measurement |
| `is_active` | boolean | No | Active status |
| `has_serial` | boolean | No | Whether items need serial number tracking |
| `website_url` | string | Yes | Product website URL |
| `created_at` | timestamp | No | Creation timestamp |
| `updated_at` | timestamp | Yes | Last update timestamp |

---

## Related Endpoints

- **Merchandise API** (`/api-merchandise`) - Physical inventory items linked to models
- **Stock API** (`/api-stock`) - Stock management using models
- **Tickets API** (`/api-tickets`) - Service tickets referencing equipment models

---

## Database Tables

### main_models

Main model catalog table.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| model | text | Unique model code |
| name | text | Model name |
| name_th | text | Thai name |
| name_en | text | English name |
| description | text | Description |
| category | text | Category |
| unit | text | Unit of measurement |
| is_active | boolean | Active status |
| has_serial | boolean | Serial tracking required |
| website_url | text | Product URL |
| created_at | timestamptz | Creation timestamp |
| updated_at | timestamptz | Update timestamp |

### jct_model_components

Junction table for model-to-component relationships.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| model_id | uuid | FK to main_models (parent) |
| component_model_id | uuid | FK to main_models (component) |
| quantity | integer | Quantity of component |
| note | text | Note |
| display_order | integer | Sort order |
| created_at | timestamptz | Creation timestamp |

### jct_model_package_services

Junction table for model-to-service relationships.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| model_id | uuid | FK to main_models |
| service_id | uuid | FK to package_services |
| terms | text | Service terms |
| note | text | Note |
| display_order | integer | Sort order |
| created_at | timestamptz | Creation timestamp |

### package_services

Service catalog for package services.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| code | text | Unique service code |
| name_th | text | Thai name |
| name_en | text | English name |
| description | text | Description |
| category | text | Category (warranty, maintenance, etc.) |
| duration_months | integer | Service duration in months |
| is_active | boolean | Active status |
