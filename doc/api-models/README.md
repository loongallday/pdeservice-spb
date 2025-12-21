# Models API

## Overview

The Models API provides operations for managing equipment models, including search, creation, packages, and specifications. Each model can have a starter package (items + services) and technical specifications.

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

**Example Request**:
```http
GET /functions/v1/api-models/search?description=Premium&code=MODEL
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
    }
  ]
}
```

---

### Get Model by ID

Get a single model by its ID.

**Endpoint**: `GET /:id`

**Required Level**: 0 (all authenticated users)

**Path Parameters**:
- `id` (required): Model ID (UUID)

**Example Request**:
```http
GET /functions/v1/api-models/123e4567-e89b-12d3-a456-426614174000
Authorization: Bearer <token>
```

**Example Response**:
```json
{
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "model": "MODEL-001",
    "name": "Premium Machine Model 001",
    "website_url": "https://manufacturer.com/model-001",
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  }
}
```

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

## Package Endpoints

### Get Model Package

Get the full starter package for a model, including items and services.

**Endpoint**: `GET /:modelId/package`

**Required Level**: 0 (all authenticated users)

**Path Parameters**:
- `modelId` (required): Model ID (UUID)

**Example Request**:
```http
GET /functions/v1/api-models/123e4567-e89b-12d3-a456-426614174000/package
Authorization: Bearer <token>
```

**Example Response**:
```json
{
  "data": {
    "model": {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "model": "MODEL-001",
      "name": "Premium Machine Model 001",
      "website_url": "https://manufacturer.com/model-001",
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z"
    },
    "items": [
      {
        "id": "111e4567-e89b-12d3-a456-426614174001",
        "quantity": 2,
        "note": "Standard battery pack",
        "display_order": 1,
        "created_at": "2024-01-01T00:00:00Z",
        "item": {
          "id": "222e4567-e89b-12d3-a456-426614174002",
          "code": "BAT-12V-7AH",
          "name_th": "แบตเตอรี่ 12V 7Ah",
          "name_en": "Battery 12V 7Ah",
          "description": "Sealed Lead-Acid Battery",
          "category": "battery",
          "unit": "piece",
          "is_active": true
        }
      }
    ],
    "services": [
      {
        "id": "333e4567-e89b-12d3-a456-426614174003",
        "terms": "Standard warranty terms apply",
        "note": "Included with purchase",
        "display_order": 1,
        "created_at": "2024-01-01T00:00:00Z",
        "service": {
          "id": "444e4567-e89b-12d3-a456-426614174004",
          "code": "SVC-WARRANTY-1Y",
          "name_th": "รับประกัน 1 ปี",
          "name_en": "1 Year Warranty",
          "description": "Standard warranty coverage",
          "category": "warranty",
          "duration_months": 12,
          "is_active": true
        }
      }
    ]
  }
}
```

---

### Add Item to Package

Add an item to the model's starter package.

**Endpoint**: `POST /:modelId/package/items`

**Required Level**: 1 (create operations)

**Path Parameters**:
- `modelId` (required): Model ID (UUID)

**Request Body**:
```json
{
  "item_id": "222e4567-e89b-12d3-a456-426614174002",
  "quantity": 2,
  "note": "Standard battery pack",
  "display_order": 1
}
```

**Required Fields**:
- `item_id` - Package Item ID (UUID)

**Optional Fields**:
- `quantity` - Quantity of this item (default: 1)
- `note` - Additional notes
- `display_order` - Display order for UI sorting (default: 0)

**Example Response** (201 Created):
```json
{
  "data": {
    "id": "111e4567-e89b-12d3-a456-426614174001",
    "quantity": 2,
    "note": "Standard battery pack",
    "display_order": 1,
    "created_at": "2024-01-01T00:00:00Z",
    "item": {
      "id": "222e4567-e89b-12d3-a456-426614174002",
      "code": "BAT-12V-7AH",
      "name_th": "แบตเตอรี่ 12V 7Ah",
      "name_en": "Battery 12V 7Ah",
      "description": "Sealed Lead-Acid Battery",
      "category": "battery",
      "unit": "piece"
    }
  }
}
```

---

### Remove Item from Package

Remove an item from the model's starter package.

**Endpoint**: `DELETE /:modelId/package/items/:itemId`

**Required Level**: 1 (delete operations)

**Path Parameters**:
- `modelId` (required): Model ID (UUID)
- `itemId` (required): Package Item ID (UUID)

**Example Response**:
```json
{
  "data": {
    "message": "ลบอุปกรณ์จากแพ็คเกจสำเร็จ"
  }
}
```

---

### Add Service to Package

Add a service to the model's starter package.

**Endpoint**: `POST /:modelId/package/services`

**Required Level**: 1 (create operations)

**Path Parameters**:
- `modelId` (required): Model ID (UUID)

**Request Body**:
```json
{
  "service_id": "444e4567-e89b-12d3-a456-426614174004",
  "terms": "Standard warranty terms apply",
  "note": "Included with purchase",
  "display_order": 1
}
```

**Required Fields**:
- `service_id` - Package Service ID (UUID)

**Optional Fields**:
- `terms` - Service terms and conditions
- `note` - Additional notes
- `display_order` - Display order for UI sorting (default: 0)

**Example Response** (201 Created):
```json
{
  "data": {
    "id": "333e4567-e89b-12d3-a456-426614174003",
    "terms": "Standard warranty terms apply",
    "note": "Included with purchase",
    "display_order": 1,
    "created_at": "2024-01-01T00:00:00Z",
    "service": {
      "id": "444e4567-e89b-12d3-a456-426614174004",
      "code": "SVC-WARRANTY-1Y",
      "name_th": "รับประกัน 1 ปี",
      "name_en": "1 Year Warranty",
      "description": "Standard warranty coverage",
      "category": "warranty",
      "duration_months": 12
    }
  }
}
```

---

### Remove Service from Package

Remove a service from the model's starter package.

**Endpoint**: `DELETE /:modelId/package/services/:serviceId`

**Required Level**: 1 (delete operations)

**Path Parameters**:
- `modelId` (required): Model ID (UUID)
- `serviceId` (required): Package Service ID (UUID)

**Example Response**:
```json
{
  "data": {
    "message": "ลบบริการจากแพ็คเกจสำเร็จ"
  }
}
```

---

## Specification Endpoints

### Get Model Specification

Get the UPS technical specification for a model.

**Endpoint**: `GET /:modelId/specification`

**Required Level**: 0 (all authenticated users)

**Path Parameters**:
- `modelId` (required): Model ID (UUID)

**Example Request**:
```http
GET /functions/v1/api-models/123e4567-e89b-12d3-a456-426614174000/specification
Authorization: Bearer <token>
```

**Example Response** (specification exists):
```json
{
  "data": {
    "id": "555e4567-e89b-12d3-a456-426614174005",
    "model_id": "123e4567-e89b-12d3-a456-426614174000",
    "capacity_va": 3000,
    "capacity_watts": 2700,
    "power_factor": 0.9,
    "input_voltage_nominal": 220,
    "input_voltage_range": "160-290V",
    "input_frequency": "50/60 Hz",
    "input_phase": "single",
    "output_voltage_nominal": 220,
    "output_voltage_regulation": "+/-2%",
    "output_frequency": "50/60 Hz +/-1%",
    "output_waveform": "Pure Sine Wave",
    "battery_type": "Sealed Lead-Acid",
    "battery_voltage": 12,
    "battery_quantity": 6,
    "battery_ah": 9.0,
    "typical_recharge_time": "4-6 hours to 90%",
    "runtime_half_load_minutes": 30,
    "runtime_full_load_minutes": 10,
    "transfer_time_ms": 0,
    "efficiency_percent": 95.5,
    "dimensions_wxdxh": "190x410x320 mm",
    "weight_kg": 28.5,
    "operating_temperature": "0-40C",
    "operating_humidity": "0-95% RH non-condensing",
    "noise_level_db": 45.0,
    "communication_ports": ["USB", "RS-232", "SNMP"],
    "outlets_iec": 6,
    "outlets_nema": 0,
    "has_lcd_display": true,
    "has_avr": true,
    "has_surge_protection": true,
    "certifications": ["CE", "UL", "TIS"],
    "additional_specs": null,
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  }
}
```

**Example Response** (no specification):
```json
{
  "data": null
}
```

---

### Create/Update Model Specification

Create or update UPS technical specification for a model (upsert operation).

**Endpoint**: `POST /:modelId/specification` or `PUT /:modelId/specification`

**Required Level**: 1 (create/update operations)

**Path Parameters**:
- `modelId` (required): Model ID (UUID)

**Request Body**:
```json
{
  "capacity_va": 3000,
  "capacity_watts": 2700,
  "power_factor": 0.9,
  "input_voltage_nominal": 220,
  "input_voltage_range": "160-290V",
  "input_frequency": "50/60 Hz",
  "input_phase": "single",
  "output_voltage_nominal": 220,
  "output_voltage_regulation": "+/-2%",
  "output_frequency": "50/60 Hz +/-1%",
  "output_waveform": "Pure Sine Wave",
  "battery_type": "Sealed Lead-Acid",
  "battery_voltage": 12,
  "battery_quantity": 6,
  "battery_ah": 9.0,
  "typical_recharge_time": "4-6 hours to 90%",
  "runtime_half_load_minutes": 30,
  "runtime_full_load_minutes": 10,
  "transfer_time_ms": 0,
  "efficiency_percent": 95.5,
  "dimensions_wxdxh": "190x410x320 mm",
  "weight_kg": 28.5,
  "operating_temperature": "0-40C",
  "operating_humidity": "0-95% RH non-condensing",
  "noise_level_db": 45.0,
  "communication_ports": ["USB", "RS-232", "SNMP"],
  "outlets_iec": 6,
  "outlets_nema": 0,
  "has_lcd_display": true,
  "has_avr": true,
  "has_surge_protection": true,
  "certifications": ["CE", "UL", "TIS"],
  "additional_specs": {
    "custom_field": "custom_value"
  }
}
```

**All fields are optional**. Only provided fields will be set or updated.

**Specification Fields**:

| Field | Type | Description |
|-------|------|-------------|
| `capacity_va` | integer | Capacity in VA (e.g., 1000, 3000) |
| `capacity_watts` | integer | Capacity in Watts |
| `power_factor` | decimal | Power factor (e.g., 0.8, 0.9) |
| `input_voltage_nominal` | integer | Nominal input voltage (e.g., 220V) |
| `input_voltage_range` | string | Input voltage range (e.g., "160-290V") |
| `input_frequency` | string | Input frequency (e.g., "50/60 Hz") |
| `input_phase` | string | Input phase ("single" or "three") |
| `input_port_types` | string[] | Array of input port/connector types (e.g., ["IEC C14"], ["IEC C20", "Hardwired"]) |
| `output_voltage_nominal` | integer | Nominal output voltage |
| `output_voltage_regulation` | string | Output voltage regulation (e.g., "+/-2%") |
| `output_frequency` | string | Output frequency |
| `output_waveform` | string | Output waveform (e.g., "Pure Sine Wave") |
| `output_port_types` | string[] | Array of output port/connector types (e.g., ["IEC C13", "IEC C19"]) |
| `battery_type` | string | Battery type |
| `battery_voltage` | integer | Battery voltage (e.g., 12V, 24V) |
| `battery_quantity` | integer | Number of batteries |
| `battery_ah` | decimal | Battery amp-hour rating |
| `typical_recharge_time` | string | Typical recharge time |
| `runtime_half_load_minutes` | integer | Runtime at 50% load (minutes) |
| `runtime_full_load_minutes` | integer | Runtime at 100% load (minutes) |
| `transfer_time_ms` | integer | Transfer time in milliseconds |
| `efficiency_percent` | decimal | Efficiency percentage |
| `dimensions_wxdxh` | string | Dimensions WxDxH |
| `weight_kg` | decimal | Weight in kilograms |
| `operating_temperature` | string | Operating temperature range |
| `operating_humidity` | string | Operating humidity range |
| `noise_level_db` | decimal | Noise level in decibels |
| `communication_ports` | array | Communication ports (USB, RS-232, SNMP) |
| `outlets_iec` | integer | Number of IEC outlets |
| `outlets_nema` | integer | Number of NEMA outlets |
| `has_lcd_display` | boolean | Has LCD display |
| `has_avr` | boolean | Has Automatic Voltage Regulation |
| `has_surge_protection` | boolean | Has surge protection |
| `certifications` | array | Certifications (CE, UL, TIS) |
| `additional_specs` | jsonb | Additional specifications as JSON |

**Example Response** (201 Created for new, 200 OK for update):
```json
{
  "data": {
    "data": { /* specification object */ },
    "created": true  // false if updated
  }
}
```

---

## Error Responses

### 400 Bad Request
```json
{
  "error": "model code ซ้ำในระบบ"
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

---

## Notes

- Model codes are unique identifiers used in merchandise and PM summary APIs
- Each model can have one starter package (items + services)
- Each model can have one specification (1:1 relationship)
- The search is case-insensitive and supports partial matching
- Results are limited to 20 items per search request
