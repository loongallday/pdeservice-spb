# API Departments

API for managing organizational departments within the PDE Service system.

## Overview

The Departments API provides endpoints for creating, reading, updating, and deleting organizational departments (`main_org_departments`). Departments are used to organize employees and roles within the company structure.

## Base URL

```
/api-departments
```

## Authentication

All endpoints require a valid JWT token in the `Authorization` header:

```
Authorization: Bearer <jwt_token>
```

## Authorization Levels

| Operation | Required Level | Description |
|-----------|---------------|-------------|
| Search | Level 0+ | All authenticated users |
| Get by ID | Level 0+ | All authenticated users |
| Get Summary | Level 0+ | All authenticated users |
| Create | Superadmin only | Level 3 |
| Update | Superadmin only | Level 3 |
| Delete | Superadmin only | Level 3 |

---

## Data Model

### Department Object

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | UUID | Auto-generated | Unique identifier |
| `code` | string | Yes | Department code (e.g., "IT", "HR", "SALES") |
| `name_th` | string | Yes | Department name in Thai |
| `name_en` | string | No | Department name in English |
| `description` | string | No | Department description |
| `is_active` | boolean | No | Active status (default: `true`) |
| `head_id` | UUID | No | Reference to department head (employee ID) |
| `created_at` | timestamp | Auto-generated | Creation timestamp |
| `updated_at` | timestamp | Auto-generated | Last update timestamp |

---

## Endpoints

### 1. Search Departments

Search and list departments with pagination.

**Endpoint:** `GET /api-departments/search`

**Permission:** Level 0+ (All authenticated users)

#### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `q` | string | `""` | Search query (matches `code`, `name_th`, `name_en`) |
| `page` | number | `1` | Page number |
| `limit` | number | `50` | Items per page (max: 100) |

#### Response

```json
{
  "data": {
    "data": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "code": "IT",
        "name_th": "แผนกเทคโนโลยีสารสนเทศ",
        "name_en": "Information Technology",
        "description": "ดูแลระบบ IT ทั้งหมด",
        "is_active": true,
        "head_id": "660e8400-e29b-41d4-a716-446655440001",
        "created_at": "2024-01-15T10:00:00Z",
        "updated_at": "2024-01-15T10:00:00Z"
      },
      {
        "id": "550e8400-e29b-41d4-a716-446655440001",
        "code": "HR",
        "name_th": "แผนกทรัพยากรบุคคล",
        "name_en": "Human Resources",
        "description": null,
        "is_active": true,
        "head_id": null,
        "created_at": "2024-01-15T10:00:00Z",
        "updated_at": "2024-01-15T10:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 2,
      "totalPages": 1,
      "hasNextPage": false,
      "hasPrevPage": false
    }
  }
}
```

#### Example Request

```bash
# Search all departments
curl -X GET "/api-departments/search" \
  -H "Authorization: Bearer <token>"

# Search with query
curl -X GET "/api-departments/search?q=IT&page=1&limit=10" \
  -H "Authorization: Bearer <token>"
```

---

### 2. Get Department by ID

Retrieve a single department by its ID.

**Endpoint:** `GET /api-departments/:id`

**Permission:** Level 0+ (All authenticated users)

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Department ID |

#### Response

```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "code": "IT",
    "name_th": "แผนกเทคโนโลยีสารสนเทศ",
    "name_en": "Information Technology",
    "description": "ดูแลระบบ IT ทั้งหมด",
    "is_active": true,
    "head_id": "660e8400-e29b-41d4-a716-446655440001",
    "created_at": "2024-01-15T10:00:00Z",
    "updated_at": "2024-01-15T10:00:00Z"
  }
}
```

#### Example Request

```bash
curl -X GET "/api-departments/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer <token>"
```

---

### 3. Get Department Summary

Get a summary of all departments with employee and role counts. Useful for dashboards and organizational overviews.

**Endpoint:** `GET /api-departments/department-summary`

**Permission:** Level 0+ (All authenticated users)

#### Response

```json
{
  "data": [
    {
      "department_id": "550e8400-e29b-41d4-a716-446655440000",
      "department_code": "IT",
      "department_name_th": "แผนกเทคโนโลยีสารสนเทศ",
      "department_name_en": "Information Technology",
      "total_employees": 15,
      "active_employees": 12,
      "inactive_employees": 3,
      "total_roles": 5,
      "active_roles": 4,
      "inactive_roles": 1
    },
    {
      "department_id": "550e8400-e29b-41d4-a716-446655440001",
      "department_code": "HR",
      "department_name_th": "แผนกทรัพยากรบุคคล",
      "department_name_en": "Human Resources",
      "total_employees": 8,
      "active_employees": 8,
      "inactive_employees": 0,
      "total_roles": 3,
      "active_roles": 3,
      "inactive_roles": 0
    }
  ]
}
```

#### Summary Object Fields

| Field | Type | Description |
|-------|------|-------------|
| `department_id` | UUID | Department ID |
| `department_code` | string | Department code |
| `department_name_th` | string | Department name in Thai |
| `department_name_en` | string | Department name in English |
| `total_employees` | number | Total employees in department |
| `active_employees` | number | Active employees count |
| `inactive_employees` | number | Inactive employees count |
| `total_roles` | number | Total roles in department |
| `active_roles` | number | Active roles count |
| `inactive_roles` | number | Inactive roles count |

#### Example Request

```bash
curl -X GET "/api-departments/department-summary" \
  -H "Authorization: Bearer <token>"
```

---

### 4. Create Department

Create a new department.

**Endpoint:** `POST /api-departments`

**Permission:** Superadmin only (Level 3)

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `code` | string | Yes | Department code |
| `name_th` | string | Yes | Department name in Thai |
| `name_en` | string | No | Department name in English |
| `description` | string | No | Department description |
| `is_active` | boolean | No | Active status (default: `true`) |
| `head_id` | UUID | No | Department head employee ID |

#### Request Example

```json
{
  "code": "SALES",
  "name_th": "แผนกขาย",
  "name_en": "Sales Department",
  "description": "รับผิดชอบงานขายและติดตามลูกค้า",
  "is_active": true,
  "head_id": "660e8400-e29b-41d4-a716-446655440002"
}
```

#### Response (201 Created)

```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440002",
    "code": "SALES",
    "name_th": "แผนกขาย",
    "name_en": "Sales Department",
    "description": "รับผิดชอบงานขายและติดตามลูกค้า",
    "is_active": true,
    "head_id": "660e8400-e29b-41d4-a716-446655440002",
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T10:30:00Z"
  }
}
```

#### Example Request

```bash
curl -X POST "/api-departments" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "SALES",
    "name_th": "แผนกขาย",
    "name_en": "Sales Department"
  }'
```

---

### 5. Update Department

Update an existing department.

**Endpoint:** `PUT /api-departments/:id`

**Permission:** Superadmin only (Level 3)

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Department ID |

#### Request Body

All fields are optional. Only include fields you want to update.

| Field | Type | Description |
|-------|------|-------------|
| `code` | string | Department code |
| `name_th` | string | Department name in Thai |
| `name_en` | string | Department name in English |
| `description` | string | Department description |
| `is_active` | boolean | Active status |
| `head_id` | UUID | Department head employee ID |

#### Request Example

```json
{
  "name_en": "Sales & Marketing Department",
  "description": "Updated description",
  "is_active": true
}
```

#### Response

```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440002",
    "code": "SALES",
    "name_th": "แผนกขาย",
    "name_en": "Sales & Marketing Department",
    "description": "Updated description",
    "is_active": true,
    "head_id": "660e8400-e29b-41d4-a716-446655440002",
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T11:00:00Z"
  }
}
```

#### Example Request

```bash
curl -X PUT "/api-departments/550e8400-e29b-41d4-a716-446655440002" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name_en": "Sales & Marketing Department"
  }'
```

---

### 6. Delete Department

Delete a department permanently.

**Endpoint:** `DELETE /api-departments/:id`

**Permission:** Superadmin only (Level 3)

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Department ID |

#### Response

```json
{
  "data": {
    "message": "ลบแผนกสำเร็จ"
  }
}
```

#### Example Request

```bash
curl -X DELETE "/api-departments/550e8400-e29b-41d4-a716-446655440002" \
  -H "Authorization: Bearer <token>"
```

**Warning:** This is a hard delete. Consider setting `is_active: false` instead if you want to preserve historical data.

---

## Error Responses

### Common Error Codes

| HTTP Status | Error Type | Description |
|-------------|------------|-------------|
| 400 | ValidationError | Invalid input data |
| 401 | AuthenticationError | Missing or invalid token |
| 403 | AuthorizationError | Insufficient permissions |
| 404 | NotFoundError | Department not found |
| 500 | DatabaseError | Database operation failed |

### Error Response Format

```json
{
  "error": "Error message in Thai"
}
```

### Example Error Responses

#### 400 - Validation Error (Missing required field)

```json
{
  "error": "กรุณาระบุ รหัสแผนก"
}
```

#### 400 - Validation Error (Invalid UUID)

```json
{
  "error": "Department ID ไม่ถูกต้อง"
}
```

#### 400 - Validation Error (Empty update body)

```json
{
  "error": "ไม่มีข้อมูลที่จะอัปเดต"
}
```

#### 401 - Authentication Error

```json
{
  "error": "ไม่พบ token หรือ token ไม่ถูกต้อง"
}
```

#### 403 - Authorization Error

```json
{
  "error": "เฉพาะ Superadmin เท่านั้น"
}
```

#### 404 - Not Found

```json
{
  "error": "ไม่พบแผนก"
}
```

---

## Usage Notes

### For Frontend Developers

1. **Dropdown/Select Components**: Use `GET /api-departments/search` to populate department dropdowns. The search works with empty query string to list all departments.

2. **Dashboard Statistics**: Use `GET /api-departments/department-summary` for organizational charts and employee distribution visualizations.

3. **Permission Handling**: Only show Create/Update/Delete buttons for Superadmin users. Check the user's role level from the authentication context.

4. **Soft Delete Alternative**: Instead of deleting departments, consider using the Update endpoint to set `is_active: false`. This preserves data integrity for historical records.

### Related APIs

- **Roles API** (`/api-roles`): Roles belong to departments via `department_id`
- **Employees API** (`/api-employees`): Employees are assigned to departments through their roles

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.1 | 2025-01-18 | Updated default pagination limit from 20 to 50 |
| 1.0.0 | 2024-01-15 | Initial release |
