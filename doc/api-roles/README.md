# Roles API

## Overview

The Roles API handles role management for employee permissions and access control.

**Base URL**: `/functions/v1/api-roles`

**Authentication**: All endpoints require Bearer token authentication.

---

## Endpoints

### List Roles

Get a list of all roles with department information.

**Endpoint**: `GET /`

**Required Level**: 0 (all authenticated users)

**Example Request**:
```http
GET /functions/v1/api-roles
Authorization: Bearer <token>
```

**Example Response**:
```json
{
  "data": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "code": "ADMIN",
      "name_th": "ผู้ดูแลระบบ",
      "name_en": "Administrator",
      "level": 2,
      "department_id": "123e4567-e89b-12d3-a456-426614174001",
      "is_active": true,
      "department": {
        "id": "123e4567-e89b-12d3-a456-426614174001",
        "code": "IT",
        "name_th": "แผนกเทคโนโลยี"
      }
    }
  ]
}
```

---

### Get Role by ID

Get a single role by its ID.

**Endpoint**: `GET /:id`

**Required Level**: 0 (all authenticated users)

**Path Parameters**:
- `id` (required): Role ID (UUID)

---

### Create Role

Create a new role.

**Endpoint**: `POST /`

**Required Level**: 2 (admin and above)

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

**Required Level**: 2 (admin and above)

---

### Delete Role

Delete a role.

**Endpoint**: `DELETE /:id`

**Required Level**: 2 (admin and above)

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

