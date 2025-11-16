# Features API

## Overview

The Features API handles feature flag and menu item retrieval based on employee level and role permissions.

**Base URL**: `/functions/v1/api-features`

**Authentication**: All endpoints require Bearer token authentication.

---

## Endpoints

### Get Enabled Features

Get all features enabled for the current employee based on their level and role.

**Endpoint**: `GET /`

**Required Level**: 0 (all authenticated users)

**Example Request**:
```http
GET /functions/v1/api-features
Authorization: Bearer <token>
```

**Example Response**:
```json
{
  "data": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "code": "DASHBOARD",
      "name_th": "แดชบอร์ด",
      "name_en": "Dashboard",
      "is_menu_item": true,
      "is_active": true,
      "allowed_roles": null,
      "group_label": "Main",
      "display_order": 1
    }
  ]
}
```

**Notes**:
- Only returns features where `is_active = true`
- Features are filtered by `min_level <= employee.level`
- If `allowed_roles` is specified, employee must have one of those roles
- All conditions must pass for a feature to be included
- `min_level` is not returned in the response (security)

---

### Get Menu Items

Get menu items grouped and filtered by employee permissions.

**Endpoint**: `GET /menu`

**Required Level**: 0 (all authenticated users)

**Example Request**:
```http
GET /functions/v1/api-features/menu
Authorization: Bearer <token>
```

**Example Response**:
```json
{
  "data": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "code": "DASHBOARD",
      "name_th": "แดชบอร์ด",
      "name_en": "Dashboard",
      "is_menu_item": true,
      "group_label": "Main",
      "display_order": 1
    }
  ]
}
```

**Notes**:
- Only returns features where `is_active = true` AND `is_menu_item = true`
- Filtered by employee level and role (`min_level <= employee.level`)
- Sorted by `display_order`
- `min_level` is not returned in the response (security)

---

## Feature Filtering Logic

Features are included if ALL of the following conditions are met:
1. `is_active = true` (feature must be active)
2. `min_level <= employee.level` (employee level must meet requirement)
3. `allowed_roles` is null OR employee's role is in `allowed_roles` (role check if specified)

**Security Note**: The `min_level` field is used for filtering but is not returned in API responses to prevent users from seeing level requirements.

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

