# Initialize API

## Overview

The Initialize API returns current user information including employee details, role, and department.

**Base URL**: `/functions/v1/api-initialize`

**Authentication**: All endpoints require Bearer token authentication.

---

## Endpoints

### Get Current User Info

Get current authenticated user's information including employee details, role, and department.

**Endpoint**: `GET /me`

**Required Level**: 0 (all authenticated users)

**Example Request**:
```http
GET /functions/v1/api-initialize/me
Authorization: Bearer <token>
```

**Example Response**:
```json
{
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "name": "John Doe",
    "code": "EMP001",
    "email": "john@example.com",
    "nickname": "John",
    "role_id": "123e4567-e89b-12d3-a456-426614174001",
    "auth_user_id": "123e4567-e89b-12d3-a456-426614174002",
    "is_active": true,
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z",
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
  }
}
```

**Response Fields**:

- All employee fields (id, name, code, email, nickname, role_id, auth_user_id, is_active, created_at, updated_at, etc.)
- `role_data`: Full role information including:
  - Role details (id, code, name_th, name_en, description, level, is_active, requires_auth)
  - `department`: Nested department information (id, code, name_th, name_en, description, is_active)

**Notes**:
- Returns the current authenticated user's information
- Employee data includes nested role and department information
- Department is nested within role_data
- Use this endpoint to get the current user's profile and permissions

---

### Get Features

Get enabled features for the current authenticated user. Features are automatically filtered based on the user's level and role.

**Endpoint**: `GET /features`

**Required Level**: 0 (all authenticated users)

**Example Request**:
```http
GET /functions/v1/api-initialize/features
Authorization: Bearer <token>
```

**Example Response**:
```json
{
  "data": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174004",
      "code": "DASHBOARD",
      "name_th": "แดชบอร์ด",
      "name_en": "Dashboard",
      "is_menu_item": true,
      "is_active": true,
      "allowed_roles": null
    },
    {
      "id": "123e4567-e89b-12d3-a456-426614174005",
      "code": "TICKETS",
      "name_th": "ตั๋วงาน",
      "name_en": "Tickets",
      "is_menu_item": true,
      "is_active": true,
      "allowed_roles": ["admin", "manager"]
    }
  ]
}
```

**Response Fields**:

- `id`: Feature ID (UUID)
- `code`: Feature code (unique identifier)
- `name_th`: Feature name in Thai
- `name_en`: Feature name in English
- `is_menu_item`: Whether this feature should appear in the menu
- `is_active`: Whether this feature is active
- `allowed_roles`: Array of role codes allowed to access this feature (null if no restriction)

**Notes**:
- Features are automatically filtered based on:
  - `is_active = true` (only active features)
  - Employee's level (`min_level <= employee.level`)
  - Employee's role (if `allowed_roles` is specified, employee must have one of the allowed roles)
- `min_level` is not returned in the response (security)
- Features are ordered by `id`
- Use this endpoint to get enabled features for UI rendering and feature flags

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

- **User Profile**: Get current user's full profile with role and department (`/me`)
- **User Context**: Retrieve authenticated user's information for UI display (`/me`)
- **Permission Check**: Access user's role and level for authorization decisions (`/me`)
- **Feature Flags**: Get enabled features for UI rendering and menu items (`/features`)
- **Menu Generation**: Build application menu based on enabled features (`/features`)

