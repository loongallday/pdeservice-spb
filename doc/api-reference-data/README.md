# Reference Data API

## Overview

The Reference Data API provides read-only access to static reference data used throughout the application.

**Base URL**: `/functions/v1/api-reference-data`

**Authentication**: All endpoints require Bearer token authentication.

**Note**: This API is read-only. All endpoints are GET requests.

---

## Endpoints

### Get All Constants

Get all reference data constants in a single request (roles, departments, work types, ticket statuses, leave types).

**Endpoint**: `GET /constants`

**Required Level**: 0 (all authenticated users)

**Example Request**:
```http
GET /functions/v1/api-reference-data/constants
Authorization: Bearer <token>
```

**Example Response**:
```json
{
  "data": {
    "roles": [
      {
        "id": "123e4567-e89b-12d3-a456-426614174000",
        "code": "ADMIN",
        "name_th": "ผู้ดูแลระบบ",
        "name_en": "Administrator",
        "level": 10,
        "is_active": true
      }
    ],
    "departments": [
      {
        "id": "223e4567-e89b-12d3-a456-426614174000",
        "code": "IT",
        "name_th": "แผนกเทคโนโลยีสารสนเทศ",
        "name_en": "Information Technology",
        "is_active": true
      }
    ],
    "work_types": [
      {
        "id": "323e4567-e89b-12d3-a456-426614174000",
        "name": "Installation",
        "code": "INSTALL",
        "created_at": "2025-01-01T00:00:00Z"
      }
    ],
    "ticket_statuses": [
      {
        "id": "423e4567-e89b-12d3-a456-426614174000",
        "name": "Pending",
        "code": "PENDING",
        "display_order": 1
      }
    ],
    "leave_types": [
      {
        "id": "523e4567-e89b-12d3-a456-426614174000",
        "name": "ลาป่วย",
        "days_per_year": 30,
        "is_active": true
      }
    ]
  }
}
```

**Notes**:
- Returns all active roles, departments, work types, ticket statuses, and leave types
- All queries run in parallel for better performance
- Only active records are returned (where `is_active = true`)

---

### Get Work Types

Get all available work types.

**Endpoint**: `GET /work-types`

**Required Level**: 0 (all authenticated users)

**Example Request**:
```http
GET /functions/v1/api-reference-data/work-types
Authorization: Bearer <token>
```

**Example Response**:
```json
{
  "data": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "name": "Installation",
      "code": "INSTALL",
      "created_at": "2025-01-01T00:00:00Z"
    }
  ]
}
```

---

### Get Ticket Statuses

Get all available ticket statuses.

**Endpoint**: `GET /statuses`

**Required Level**: 0 (all authenticated users)

**Example Request**:
```http
GET /functions/v1/api-reference-data/statuses
Authorization: Bearer <token>
```

**Example Response**:
```json
{
  "data": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "name": "Pending",
      "code": "PENDING",
      "display_order": 1
    }
  ]
}
```

---

### Get Leave Types

Get all available leave types.

**Endpoint**: `GET /leave-types`

**Required Level**: 0 (all authenticated users)

**Example Request**:
```http
GET /functions/v1/api-reference-data/leave-types
Authorization: Bearer <token>
```

**Example Response**:
```json
{
  "data": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "name_th": "ลาป่วย",
      "name_en": "Sick Leave",
      "code": "SICK",
      "max_days": 30
    }
  ]
}
```

---

### Get Provinces

Get all Thai provinces.

**Endpoint**: `GET /provinces`

**Required Level**: 0 (all authenticated users)

**Example Request**:
```http
GET /functions/v1/api-reference-data/provinces
Authorization: Bearer <token>
```

**Example Response**:
```json
{
  "data": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "name_th": "กรุงเทพมหานคร",
      "name_en": "Bangkok",
      "code": "BKK"
    }
  ]
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

### 405 Method Not Allowed
```json
{
  "error": "Method not allowed"
}
```

**Note**: Only GET requests are allowed on this API.

---

## Notes

- All endpoints are read-only
- Data is static and managed through database migrations
- Used for dropdowns and form selections
- No pagination needed (small datasets)

