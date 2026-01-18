# API Roles Documentation

## Overview

The **Roles API** (`api-roles`) manages organizational roles within the PDE Service system. Roles define permission levels, department associations, and are assigned to employees to control their access throughout the application.

Roles are stored in the `main_org_roles` table and are used for:
- Defining authorization levels (0-3) for API access control
- Organizing employees by functional responsibilities
- Associating roles with specific departments
- Managing which roles require authentication credentials

---

## Base URL

```
/api-roles
```

---

## Authentication

All endpoints require a valid JWT token in the Authorization header:

```
Authorization: Bearer <jwt_token>
```

The authenticated user must be an employee in the system.

---

## Authorization Levels

| Level | Role Type | Access |
|-------|-----------|--------|
| 0 | Technician L1 | Read-only access to roles |
| 1 | Assigner, PM, Sales | Read-only access to roles |
| 2 | Admin | Read-only access to roles |
| 3 | Superadmin | Full CRUD access (Create, Update, Delete) |

**Note**: Only Superadmin (level 3) users can create, update, or delete roles.

---

## Data Model

### Role Object

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | UUID | Auto | Unique identifier (auto-generated) |
| `code` | string | Yes | Unique role code (e.g., "tech_l1", "admin") |
| `name_th` | string | Yes | Role name in Thai |
| `name_en` | string | No | Role name in English |
| `name` | string | No | Legacy field (deprecated, use `name_th`/`name_en` instead) |
| `description` | string | No | Role description |
| `level` | integer | No | Permission level (0-3) |
| `department_id` | UUID | No | Associated department ID |
| `is_active` | boolean | No | Whether role is active (default: true) |
| `requires_auth` | boolean | No | Whether role requires auth credentials (default: false) |
| `created_at` | timestamptz | Auto | Creation timestamp |
| `updated_at` | timestamptz | Auto | Last update timestamp |

---

## Endpoints

### 1. Search Roles

Search and list roles with pagination.

**Endpoint**
```
GET /api-roles/search
```

**Permission Level**: 0+ (All authenticated users)

**Query Parameters**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `q` | string | No | "" | Search query (matches code, name_th, name_en) |
| `page` | integer | No | 1 | Page number |
| `limit` | integer | No | 20 | Items per page |

**Response**

```json
{
  "data": {
    "data": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "code": "tech_l1",
        "name_th": "ช่างเทคนิค ระดับ 1",
        "name_en": "Technician Level 1",
        "name": null,
        "description": "Entry level technician role",
        "level": 0,
        "department_id": "660e8400-e29b-41d4-a716-446655440001",
        "is_active": true,
        "requires_auth": false,
        "created_at": "2024-01-15T10:30:00.000Z",
        "updated_at": "2024-01-15T10:30:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 15,
      "totalPages": 1,
      "hasNextPage": false,
      "hasPreviousPage": false
    }
  }
}
```

**Example Request**

```bash
curl -X GET "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-roles/search?q=tech&page=1&limit=10" \
  -H "Authorization: Bearer <jwt_token>"
```

---

### 2. Get Role by ID

Retrieve a single role by its unique identifier.

**Endpoint**
```
GET /api-roles/:id
```

**Permission Level**: 0+ (All authenticated users)

**Path Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | UUID | Yes | Role unique identifier |

**Response**

```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "code": "admin",
    "name_th": "ผู้ดูแลระบบ",
    "name_en": "Administrator",
    "name": null,
    "description": "System administrator with elevated privileges",
    "level": 2,
    "department_id": null,
    "is_active": true,
    "requires_auth": true,
    "created_at": "2024-01-15T10:30:00.000Z",
    "updated_at": "2024-01-15T10:30:00.000Z"
  }
}
```

**Example Request**

```bash
curl -X GET "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-roles/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer <jwt_token>"
```

---

### 3. Get Role Summary

Retrieve a summary of all active roles with employee counts. This endpoint is useful for dashboards and reporting.

**Endpoint**
```
GET /api-roles/role-summary
```

**Permission Level**: 0+ (All authenticated users)

**Response**

```json
{
  "data": [
    {
      "role_id": "550e8400-e29b-41d4-a716-446655440000",
      "role_code": "tech_l1",
      "role_name_th": "ช่างเทคนิค ระดับ 1",
      "role_name_en": "Technician Level 1",
      "role_level": 0,
      "department_id": "660e8400-e29b-41d4-a716-446655440001",
      "department_code": "field_service",
      "department_name_th": "ฝ่ายบริการภาคสนาม",
      "department_name_en": "Field Service Department",
      "total_employees": 25,
      "active_employees": 22,
      "inactive_employees": 3
    },
    {
      "role_id": "550e8400-e29b-41d4-a716-446655440001",
      "role_code": "admin",
      "role_name_th": "ผู้ดูแลระบบ",
      "role_name_en": "Administrator",
      "role_level": 2,
      "department_id": null,
      "department_code": null,
      "department_name_th": null,
      "department_name_en": null,
      "total_employees": 5,
      "active_employees": 5,
      "inactive_employees": 0
    }
  ]
}
```

**Example Request**

```bash
curl -X GET "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-roles/role-summary" \
  -H "Authorization: Bearer <jwt_token>"
```

---

### 4. Create Role

Create a new organizational role.

**Endpoint**
```
POST /api-roles
```

**Permission Level**: 3 (Superadmin only)

**Request Body**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `code` | string | Yes | Unique role code |
| `name_th` | string | Yes | Role name in Thai |
| `name_en` | string | No | Role name in English |
| `description` | string | No | Role description |
| `level` | integer | No | Permission level (0-3) |
| `department_id` | UUID | No | Associated department ID |

**Note**: The fields `is_active` and `requires_auth` use database defaults (`is_active=true`, `requires_auth=false`) and cannot be set during creation.

**Request Example**

```json
{
  "code": "supervisor",
  "name_th": "หัวหน้างาน",
  "name_en": "Supervisor",
  "description": "Team supervisor role",
  "level": 1,
  "department_id": "660e8400-e29b-41d4-a716-446655440001"
}
```

**Response** (HTTP 201 Created)

```json
{
  "data": {
    "id": "770e8400-e29b-41d4-a716-446655440002",
    "code": "supervisor",
    "name_th": "หัวหน้างาน",
    "name_en": "Supervisor",
    "name": null,
    "description": "Team supervisor role",
    "level": 1,
    "department_id": "660e8400-e29b-41d4-a716-446655440001",
    "is_active": true,
    "requires_auth": false,
    "created_at": "2024-01-15T10:30:00.000Z",
    "updated_at": "2024-01-15T10:30:00.000Z"
  }
}
```

**Example Request**

```bash
curl -X POST "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-roles" \
  -H "Authorization: Bearer <jwt_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "supervisor",
    "name_th": "หัวหน้างาน",
    "name_en": "Supervisor",
    "level": 1
  }'
```

---

### 5. Update Role

Update an existing role.

**Endpoint**
```
PUT /api-roles/:id
```

**Permission Level**: 3 (Superadmin only)

**Path Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | UUID | Yes | Role unique identifier |

**Request Body**

All fields are optional. Only provided fields will be updated.

| Field | Type | Description |
|-------|------|-------------|
| `code` | string | Unique role code |
| `name_th` | string | Role name in Thai |
| `name_en` | string | Role name in English |
| `description` | string | Role description |
| `level` | integer | Permission level (0-3) |
| `department_id` | UUID | Associated department ID |

**Note**: The fields `is_active` and `requires_auth` cannot be modified via API and maintain their current database values.

**Request Example**

```json
{
  "name_en": "Senior Technician",
  "level": 1
}
```

**Response**

```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "code": "tech_l1",
    "name_th": "ช่างเทคนิค ระดับ 1",
    "name_en": "Senior Technician",
    "name": null,
    "description": "Entry level technician role",
    "level": 1,
    "department_id": "660e8400-e29b-41d4-a716-446655440001",
    "is_active": true,
    "requires_auth": false,
    "created_at": "2024-01-15T10:30:00.000Z",
    "updated_at": "2024-01-16T14:20:00.000Z"
  }
}
```

**Example Request**

```bash
curl -X PUT "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-roles/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer <jwt_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name_en": "Senior Technician",
    "level": 1
  }'
```

---

### 6. Delete Role

Delete an existing role.

**Endpoint**
```
DELETE /api-roles/:id
```

**Permission Level**: 3 (Superadmin only)

**Path Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | UUID | Yes | Role unique identifier |

**Response**

```json
{
  "data": {
    "message": "ลบบทบาทสำเร็จ"
  }
}
```

**Example Request**

```bash
curl -X DELETE "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-roles/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer <jwt_token>"
```

**Warning**: Deleting a role that is currently assigned to employees may cause referential integrity issues. Ensure no employees are assigned to the role before deletion.

---

## Error Responses

All error responses follow this format:

```json
{
  "error": "Error message in Thai"
}
```

### Common Error Codes

| HTTP Status | Error Message | Description |
|-------------|---------------|-------------|
| 400 | `รหัสบทบาท จำเป็นต้องระบุ` | Missing required field: role code |
| 400 | `ชื่อบทบาท จำเป็นต้องระบุ` | Missing required field: role name (Thai) |
| 400 | `ไม่มีข้อมูลที่จะอัปเดต` | No data provided for update |
| 400 | `Role ID ต้องเป็น UUID ที่ถูกต้อง` | Invalid UUID format |
| 401 | `Unauthorized` | Missing or invalid JWT token |
| 403 | `เฉพาะ Superadmin เท่านั้น` | User is not a Superadmin (level 3) |
| 404 | `ไม่พบบทบาท` | Role not found |
| 404 | `Not found` | Invalid endpoint path |
| 500 | `Database error message` | Internal database error |

---

## Notes for Frontend Developers

1. **Role Levels**: The `level` field (0-3) determines API access permissions across the entire system. Be careful when modifying role levels as it affects user authorization.

2. **Search Functionality**: The search endpoint matches against `code`, `name_th`, and `name_en` fields using case-insensitive partial matching.

3. **Role Summary**: Use the `/role-summary` endpoint for dashboard displays showing employee distribution across roles.

4. **Sorting**: Search results are sorted by `level` (ascending), making higher-permission roles appear last.

5. **Department Association**: Roles can optionally be linked to departments via `department_id`. The role summary endpoint returns expanded department information.

6. **Active Roles Only**: The role summary endpoint only returns active roles (`is_active = true`), but the search and get-by-ID endpoints return all roles regardless of status.

---

## Related APIs

- **api-departments** - Manage departments that roles can be associated with
- **api-employees** - Assign roles to employees
- **api-reference-data** - Get reference data including role lists
