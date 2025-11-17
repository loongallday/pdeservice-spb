# Initialize API

## Overview

The Initialize API returns all initial data needed to bootstrap the application in a single request. This includes employee information, user's department, and enabled features.

**Base URL**: `/functions/v1/api-initialize`

**Authentication**: All endpoints require Bearer token authentication.

---

## Endpoints

### Initialize App

Get all initial data needed to bootstrap the application.

**Endpoint**: `GET /`

**Required Level**: 0 (all authenticated users)

**Example Request**:
```http
GET /functions/v1/api-initialize
Authorization: Bearer <token>
```

**Example Response**:
```json
{
  "data": {
    "employee": {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "name": "John Doe",
      "code": "EMP001",
      "email": "john@example.com",
      "nickname": "John",
      "role_id": "123e4567-e89b-12d3-a456-426614174001",
      "auth_user_id": "123e4567-e89b-12d3-a456-426614174002",
      "is_active": true,
      "role_data": {
        "id": "123e4567-e89b-12d3-a456-426614174001",
        "code": "ADMIN",
        "name_th": "ผู้ดูแลระบบ",
        "name_en": "Administrator",
        "description": "System administrator",
        "level": 2,
        "department_id": "123e4567-e89b-12d3-a456-426614174003",
        "is_active": true,
        "requires_auth": true,
        "department": {
          "id": "123e4567-e89b-12d3-a456-426614174003",
          "code": "IT",
          "name_th": "แผนกเทคโนโลยี",
          "name_en": "IT Department",
          "description": "Information Technology",
          "is_active": true
        }
      }
    },
    "department": {
      "id": "123e4567-e89b-12d3-a456-426614174003",
      "code": "IT",
      "name_th": "แผนกเทคโนโลยี",
      "name_en": "IT Department",
      "description": "Information Technology",
      "is_active": true
    },
    "features": [
      {
        "id": "123e4567-e89b-12d3-a456-426614174004",
        "code": "DASHBOARD",
        "name_th": "แดชบอร์ด",
        "name_en": "Dashboard",
        "is_menu_item": true,
        "is_active": true,
        "allowed_roles": null
      }
    ]
  }
}
```

**Response Fields**:

- `employee`: Full employee data with role and department information (role is in `employee.role_data`)
- `department`: User's department from their role (null if employee has no role or role has no department)
- `features`: Enabled features filtered by employee level and role

**Notes**:
- Features are automatically filtered based on:
  - `is_active = true` (only active features)
  - Employee's level (`min_level <= employee.level`)
  - Employee's role (if `allowed_roles` is specified)
- `min_level` is not returned in the response (security)
- Employee data includes nested role and department information
- This endpoint is optimized to fetch all data in parallel for better performance

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

### 500 Internal Server Error
```json
{
  "error": "เกิดข้อผิดพลาดในการเข้าถึงข้อมูล"
}
```

---

## Use Cases

- **App Initialization**: Call this endpoint once when the app starts to get all essential data
- **User Context**: Get current user's full profile with permissions, role, and department
- **Feature Flags**: Get enabled features for UI rendering

---

## Performance

This endpoint uses parallel queries to fetch all data simultaneously, providing optimal performance for app initialization.

