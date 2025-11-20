# Roles API

## Overview

The Roles API handles role management for employee permissions and access control.

**Base URL**: `/functions/v1/api-roles`

**Authentication**: All endpoints require Bearer token authentication.

---

## Endpoints

### Search Roles

Search for roles by code or name with pagination.

**Endpoint**: `GET /search`

**Required Level**: 0 (all authenticated users)

**Query Parameters**:
- `q` (optional): Search query string (searches code, name_th, name_en)
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 50, max: 100)

**Example Request**:
```http
GET /functions/v1/api-roles/search?q=admin&page=1&limit=20
Authorization: Bearer <token>
```

**Example Response**:
```json
{
  "data": {
    "data": [
      {
        "id": "123e4567-e89b-12d3-a456-426614174000",
        "code": "ADMIN",
        "name_th": "ผู้ดูแลระบบ",
        "name_en": "Administrator",
        "level": 10,
        "department_id": null,
        "is_active": true,
        "requires_auth": true
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 5,
      "totalPages": 1,
      "hasNext": false,
      "hasPrevious": false
    }
  }
}
```

**Searchable Fields**:
- `code` - Role code (partial match)
- `name_th` - Thai name (partial match)
- `name_en` - English name (partial match)

**Notes**:
- Search is case-insensitive
- If no query is provided, returns all roles with pagination
- Results are sorted by level
- Partial matches are supported

---

### Get Role Summary

Get role summary with employee counts grouped by role.

**Endpoint**: `GET /role-summary`

**Required Level**: 0 (all authenticated users)

**Example Request**:
```http
GET /functions/v1/api-roles/role-summary
Authorization: Bearer <token>
```

**Example Response**:
```json
{
  "data": [
    {
      "role_id": "123e4567-e89b-12d3-a456-426614174000",
      "role_code": "ADMIN",
      "role_name_th": "ผู้ดูแลระบบ",
      "role_name_en": "Administrator",
      "role_level": 10,
      "department_id": null,
      "department_code": null,
      "department_name_th": null,
      "department_name_en": null,
      "total_employees": 5,
      "active_employees": 4,
      "inactive_employees": 1
    }
  ]
}
```

**Notes**:
- Only includes active roles
- Results are sorted by level (ascending), then by name
- Includes department information if role is linked to a department

---

### Get Role by ID

Get a single role by its ID.

**Endpoint**: `GET /:id`

**Required Level**: 0 (all authenticated users)

**Path Parameters**:
- `id` (required): Role ID (UUID)


### Create Role

Create a new role.

**Endpoint**: `POST /`

**Required Level**: 3 (Superadmin only)

**Request Body**:
```json
{
  "code": "MANAGER",
  "name_th": "ผู้จัดการ",
  "name_en": "Manager",
  "level": 5,
  "department_id": "123e4567-e89b-12d3-a456-426614174001",
  "is_active": true,
  "requires_auth": true
}
```

**Required Fields**:
- `code`: Role code (unique)
- `name_th`: Role name in Thai
- `level`: Permission level (0-10)

---

### Update Role

Update an existing role.

**Endpoint**: `PUT /:id`

**Required Level**: 3 (Superadmin only)

**Path Parameters**:
- `id` (required): Role ID (UUID)

**Request Body**:
```json
{
  "name_th": "ผู้จัดการ (อัพเดท)",
  "name_en": "Manager (Updated)",
  "description": "Updated description",
  "level": 6,
  "department_id": "123e4567-e89b-12d3-a456-426614174001"
}
```

**Note**: 
- All fields are optional. Only provided fields will be updated.
- `is_active` and `requires_auth` fields are temporarily excluded from updates until PostgREST schema cache refreshes. They will maintain their current database values during updates.
- At least one field must be provided for update.

---

### Delete Role

Delete a role.

**Endpoint**: `DELETE /:id`

**Required Level**: 3 (Superadmin only)

**Path Parameters**:
- `id` (required): Role ID (UUID)

---

## Role Levels

Role levels determine access permissions:
- **Level 0**: Basic read access (technician_l1)
- **Level 1**: Create/update operations (assigner, pm, rma, sale, technician)
- **Level 2**: Admin operations
- **Level 3+**: Super admin operations

---

## Error Responses

Standard error responses apply (400, 401, 403, 404, 500).

---

## Notes

- Role codes must be unique
- Roles can be linked to departments
- Level determines what operations a role can perform
- `requires_auth` indicates if role needs authentication

