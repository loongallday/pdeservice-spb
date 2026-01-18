# API Features Documentation

## Overview

The Features API provides access to application features and menu items based on the authenticated employee's permission level and role. This API is essential for frontend applications to:

1. **Determine feature availability** - Check which features are enabled for the current user
2. **Build dynamic navigation menus** - Retrieve menu items that the user is authorized to access

Features are stored in the `main_features` table and are filtered based on:
- **Permission Level** (`min_level`) - The minimum authorization level required
- **Role Restrictions** (`allowed_roles`) - Optional list of roles that can access the feature
- **Active Status** (`is_active`) - Whether the feature is currently enabled

---

## Base URL

```
/api-features
```

---

## Authentication

All endpoints require JWT authentication via the `Authorization` header:

```
Authorization: Bearer <jwt_token>
```

The API extracts the employee's permission level and role from the authenticated user context.

---

## Permission Levels

| Level | Role Type | Description |
|-------|-----------|-------------|
| 0 | Technician L1 | Basic read-only access |
| 1 | Assigner, PM, Sales | Create/update capabilities |
| 2 | Admin | User management access |
| 3 | Superadmin | Full system access |

---

## Endpoints

### 1. Get Enabled Features

Retrieves all enabled features accessible to the authenticated employee.

#### Request

```
GET /api-features
```

#### Headers

| Header | Required | Description |
|--------|----------|-------------|
| `Authorization` | Yes | Bearer token for authentication |

#### Required Permission Level

- **Minimum Level**: 0 (All authenticated users)

#### Response

**Success (200 OK)**

```json
{
  "data": [
    {
      "id": "menu_home",
      "path": "/admin",
      "display_name": "หน้าหลัก",
      "icon": "Home",
      "group_label": "หลัก",
      "display_order": 1,
      "is_menu_item": true,
      "allowed_roles": null,
      "category_order": 1,
      "is_active": true,
      "created_at": "2026-01-02T07:02:19.950952+00:00",
      "updated_at": "2026-01-15T02:05:12.285017+00:00"
    },
    {
      "id": "menu_profile",
      "path": "/admin/profile",
      "display_name": "โปรไฟล์",
      "icon": "User",
      "group_label": "ผู้ใช้",
      "display_order": 1,
      "is_menu_item": true,
      "allowed_roles": null,
      "category_order": 4,
      "is_active": true,
      "created_at": "2026-01-02T07:02:19.950952+00:00",
      "updated_at": "2026-01-15T02:05:12.285017+00:00"
    }
  ]
}
```

#### Sorting

Results are sorted by `id` in ascending order.

#### Feature Object Properties

| Property | Type | Description |
|----------|------|-------------|
| `id` | string | Unique feature identifier (e.g., `menu_home`, `merchandise_detail`) |
| `path` | string | Frontend route path (e.g., `/admin`, `/admin/profile`) |
| `display_name` | string | Human-readable name in Thai (e.g., "หน้าหลัก") |
| `icon` | string | Icon name for UI rendering (e.g., `Home`, `User`, `Building2`) |
| `group_label` | string | Category/group name in Thai (e.g., "หลัก", "ข้อมูล", "งาน") |
| `display_order` | number | Sort order within the group |
| `is_menu_item` | boolean | Whether this feature should appear in navigation menu |
| `allowed_roles` | string[] or null | List of roles allowed to access (null = no role restriction) |
| `category_order` | number | Sort order for the category/group itself |
| `is_active` | boolean | Whether the feature is currently active |
| `created_at` | string | ISO 8601 timestamp of creation |
| `updated_at` | string | ISO 8601 timestamp of last update |

> **Note**: The `min_level` field is intentionally excluded from responses for security reasons.

#### Filtering Logic

Features are included in the response when ALL of the following conditions are met:

1. `is_active = true`
2. `min_level <= employee's permission level`
3. One of the following:
   - `allowed_roles` is `null` or empty (no role restriction)
   - Employee's role is in the `allowed_roles` array (case-insensitive)

---

### 2. Get Menu Items

Retrieves menu items for building navigation, filtered by permission level and role.

#### Request

```
GET /api-features/menu
```

#### Headers

| Header | Required | Description |
|--------|----------|-------------|
| `Authorization` | Yes | Bearer token for authentication |

#### Required Permission Level

- **Minimum Level**: 0 (All authenticated users)

#### Response

**Success (200 OK)**

```json
{
  "data": [
    {
      "id": "menu_profile",
      "path": "/admin/profile",
      "display_name": "โปรไฟล์",
      "icon": "User",
      "group_label": "ผู้ใช้",
      "display_order": 1,
      "is_menu_item": true,
      "allowed_roles": null,
      "category_order": 4,
      "is_active": true,
      "created_at": "2026-01-02T07:02:19.950952+00:00",
      "updated_at": "2026-01-15T02:05:12.285017+00:00"
    },
    {
      "id": "menu_home",
      "path": "/admin",
      "display_name": "หน้าหลัก",
      "icon": "Home",
      "group_label": "หลัก",
      "display_order": 1,
      "is_menu_item": true,
      "allowed_roles": null,
      "category_order": 1,
      "is_active": true,
      "created_at": "2026-01-02T07:02:19.950952+00:00",
      "updated_at": "2026-01-15T02:05:12.285017+00:00"
    },
    {
      "id": "menu_companies",
      "path": "/admin/companies",
      "display_name": "บริษัท",
      "icon": "Building2",
      "group_label": "ข้อมูล",
      "display_order": 1,
      "is_menu_item": true,
      "allowed_roles": null,
      "category_order": 3,
      "is_active": true,
      "created_at": "2026-01-02T07:02:19.950952+00:00",
      "updated_at": "2026-01-15T02:05:12.285017+00:00"
    },
    {
      "id": "menu_roles",
      "path": "/admin/roles",
      "display_name": "จัดการบทบาท",
      "icon": "Shield",
      "group_label": "เมนูผู้ดูแลระบบ",
      "display_order": 1,
      "is_menu_item": true,
      "allowed_roles": ["admin", "superadmin"],
      "category_order": 5,
      "is_active": true,
      "created_at": "2026-01-02T07:02:19.950952+00:00",
      "updated_at": "2026-01-15T02:07:55.886319+00:00"
    }
  ]
}
```

#### Filtering Logic

Menu items are included when ALL of the following conditions are met:

1. `is_active = true`
2. `is_menu_item = true`
3. `min_level <= employee's permission level`
4. One of the following:
   - `allowed_roles` is `null` or empty (no role restriction)
   - Employee's role is in the `allowed_roles` array (case-insensitive)

#### Sorting

Results are sorted by `display_order` in ascending order.

---

## Error Responses

### 401 Unauthorized

Returned when authentication fails or token is missing/invalid.

```json
{
  "error": "ไม่พบข้อมูลพนักงาน"
}
```

### 403 Forbidden

Returned when the employee lacks sufficient permission level.

```json
{
  "error": "คุณไม่มีสิทธิ์เข้าถึงข้อมูลนี้"
}
```

### 404 Not Found

Returned when accessing an invalid endpoint.

```json
{
  "error": "Not found"
}
```

### 500 Internal Server Error

Returned when a database or server error occurs.

```json
{
  "error": "เกิดข้อผิดพลาดในฐานข้อมูล"
}
```

---

## Example Usage

### Fetch All Enabled Features

```bash
curl -X GET \
  'https://<project-ref>.supabase.co/functions/v1/api-features' \
  -H 'Authorization: Bearer <jwt_token>'
```

### Fetch Menu Items

```bash
curl -X GET \
  'https://<project-ref>.supabase.co/functions/v1/api-features/menu' \
  -H 'Authorization: Bearer <jwt_token>'
```

---

## Frontend Integration Guide

### Building Dynamic Navigation

The `/api-features/menu` endpoint returns a flat array of menu items. To build a grouped navigation:

1. **Fetch menu items** on app initialization
2. **Group items by `group_label`** - Items with the same `group_label` should be grouped together
3. **Sort groups by `category_order`** - Lower values appear first
4. **Sort items within groups by `display_order`** - Lower values appear first
5. **Use the `icon` field** to render appropriate icons (Lucide icons recommended)
6. **Use the `path` field** for navigation routing

### Example Grouping Logic (JavaScript)

```javascript
// Response from GET /api-features/menu
const menuItems = response.data;

// Group by group_label
const grouped = menuItems.reduce((acc, item) => {
  const group = item.group_label || 'Other';
  if (!acc[group]) {
    acc[group] = {
      label: group,
      categoryOrder: item.category_order,
      items: []
    };
  }
  acc[group].items.push(item);
  return acc;
}, {});

// Convert to array and sort
const sortedGroups = Object.values(grouped)
  .sort((a, b) => a.categoryOrder - b.categoryOrder)
  .map(group => ({
    ...group,
    items: group.items.sort((a, b) => a.display_order - b.display_order)
  }));
```

### Feature Flag Checking

Use the `/api-features` endpoint to check if specific features are enabled:

```javascript
// Response from GET /api-features
const features = response.data;

// Check if a feature is available
const hasFeature = (featureId) => {
  return features.some(f => f.id === featureId);
};

// Example usage
if (hasFeature('merchandise_detail')) {
  // Show merchandise detail button
}
```

---

## Database Schema Reference

### Table: `main_features`

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | varchar | NO | - | Primary key, feature identifier |
| `path` | varchar | YES | - | Frontend route path |
| `display_name` | varchar | YES | - | Display name (Thai) |
| `min_level` | integer | YES | 0 | Minimum permission level required |
| `icon` | text | YES | - | Icon name for UI |
| `group_label` | varchar | YES | - | Category/group name |
| `display_order` | integer | YES | 0 | Sort order within group |
| `is_menu_item` | boolean | YES | false | Whether to show in navigation |
| `allowed_roles` | text[] | YES | - | Array of allowed role codes |
| `category_order` | integer | YES | 0 | Sort order for the category |
| `is_active` | boolean | YES | true | Whether feature is active |
| `created_at` | timestamptz | NO | now() | Creation timestamp |
| `updated_at` | timestamptz | NO | now() | Last update timestamp |

---

## Common Group Labels

| Group Label | Thai | Category Order | Description |
|-------------|------|----------------|-------------|
| หลัก | Main | 1 | Primary navigation items |
| งาน | Work | 2 | Work-related features |
| ข้อมูล | Data | 3 | Data management |
| ผู้ใช้ | User | 4 | User-related features |
| เมนูผู้ดูแลระบบ | Admin Menu | 5 | Admin-only features |

---

## Notes

1. **Security**: The `min_level` field is intentionally excluded from API responses to prevent users from knowing permission requirements.

2. **Role Matching**: Role comparisons are case-insensitive and trimmed of whitespace.

3. **Empty Results**: If no features match the criteria, an empty array `[]` is returned (not an error).

4. **Caching**: Consider caching feature/menu responses on the frontend, as they change infrequently.

5. **Icon Library**: Icon names correspond to [Lucide Icons](https://lucide.dev/) naming convention.
