# Employees API

## Overview

The Employees API handles all employee management operations including CRUD operations and authentication account linking.

**Base URL**: `/functions/v1/api-employees`

**Authentication**: All endpoints require Bearer token authentication.

---

## Endpoints

### List Employees

Get a paginated list of all employees.

**Endpoint**: `GET /`

**Required Level**: 0 (all authenticated users)

**Query Parameters**:
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)

**Example Request**:
```http
GET /functions/v1/api-employees?page=1&limit=20
Authorization: Bearer <token>
```

---

### Get Employee by ID

Get a single employee by their ID.

**Endpoint**: `GET /:id`

**Required Level**: 0 (all authenticated users)

**Path Parameters**:
- `id` (required): Employee ID (UUID)

**Example Request**:
```http
GET /functions/v1/api-employees/123e4567-e89b-12d3-a456-426614174000
Authorization: Bearer <token>
```

---

### Get Employee Counts by Department

Get consolidated data about employee counts for each department.

**Endpoint**: `GET /department-counts`

**Required Level**: 0 (all authenticated users)

**Example Request**:
```http
GET /functions/v1/api-employees/department-counts
Authorization: Bearer <token>
```

**Example Response**:
```jsons
{
  "data": [
    {
      "department_id": "123e4567-e89b-12d3-a456-426614174000",
      "department_code": "IT",
      "department_name_th": "แผนกเทคโนโลยีสารสนเทศ",
      "department_name_en": "Information Technology",
      "total_employees": 15,
      "active_employees": 12,
      "inactive_employees": 3
    },
    {
      "department_id": "223e4567-e89b-12d3-a456-426614174000",
      "department_code": "HR",
      "department_name_th": "แผนกทรัพยากรบุคคล",
      "department_name_en": "Human Resources",
      "total_employees": 8,
      "active_employees": 8,
      "inactive_employees": 0
    }
  ]
}
```

**Response Fields**:
- `department_id`: UUID of the department
- `department_code`: Department code
- `department_name_th`: Department name in Thai
- `department_name_en`: Department name in English (nullable)
- `total_employees`: Total number of employees in the department
- `active_employees`: Number of active employees
- `inactive_employees`: Number of inactive employees

**Notes**:
- Returns all active departments, even if they have zero employees
- Departments are sorted by Thai name alphabetically
- Employee counts are based on the relationship: employees → roles → departments
- Only employees with roles that have a department_id are counted

---

### Get Employee Counts by Role

Get consolidated data about employee counts for each role.

**Endpoint**: `GET /role-counts`

**Required Level**: 0 (all authenticated users)

**Example Request**:
```http
GET /functions/v1/api-employees/role-counts
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
      "department_id": "223e4567-e89b-12d3-a456-426614174000",
      "department_code": "IT",
      "department_name_th": "แผนกเทคโนโลยีสารสนเทศ",
      "department_name_en": "Information Technology",
      "total_employees": 5,
      "active_employees": 4,
      "inactive_employees": 1
    },
    {
      "role_id": "323e4567-e89b-12d3-a456-426614174000",
      "role_code": "MANAGER",
      "role_name_th": "ผู้จัดการ",
      "role_name_en": "Manager",
      "role_level": 5,
      "department_id": null,
      "department_code": null,
      "department_name_th": null,
      "department_name_en": null,
      "total_employees": 8,
      "active_employees": 8,
      "inactive_employees": 0
    }
  ]
}
```

**Response Fields**:
- `role_id`: UUID of the role
- `role_code`: Role code
- `role_name_th`: Role name in Thai
- `role_name_en`: Role name in English (nullable)
- `role_level`: Permission level of the role (nullable)
- `department_id`: UUID of the department this role belongs to (nullable)
- `department_code`: Department code (nullable)
- `department_name_th`: Department name in Thai (nullable)
- `department_name_en`: Department name in English (nullable)
- `total_employees`: Total number of employees with this role
- `active_employees`: Number of active employees with this role
- `inactive_employees`: Number of inactive employees with this role

**Notes**:
- Returns all active roles, even if they have zero employees
- Roles are sorted by Thai name alphabetically
- Includes department information for roles that belong to a department
- Only employees with assigned roles are counted

---

### Get Employee by Code

Get an employee by their employee code.

**Endpoint**: `GET /code/:code`

**Required Level**: 0 (all authenticated users)

**Path Parameters**:
- `code` (required): Employee code (string)

**Example Request**:
```http
GET /functions/v1/api-employees/code/EMP001
Authorization: Bearer <token>
```

---

### Get Employees by Role

Get all employees with a specific role.

**Endpoint**: `GET /role/:role`

**Required Level**: 0 (all authenticated users)

**Path Parameters**:
- `role` (required): Role code (string)

**Example Request**:
```http
GET /functions/v1/api-employees/role/ADMIN
Authorization: Bearer <token>
```

---

### Create Employee

Create a new employee.

**Endpoint**: `POST /`

**Required Level**: 2 (admin and above)

**Request Body**:
```json
{
  "name": "John Doe",
  "code": "EMP001",
  "nickname": "John",
  "email": "john@example.com",
  "role_id": "123e4567-e89b-12d3-a456-426614174001",
  "is_active": true
}
```

**Required Fields**:
- `name`: Employee name
- `code`: Employee code (unique)

**Example Request**:
```http
POST /functions/v1/api-employees
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "John Doe",
  "code": "EMP001",
  "nickname": "John",
  "email": "john@example.com",
  "role_id": "123e4567-e89b-12d3-a456-426614174001",
  "is_active": true
}
```

---

### Update Employee

Update an existing employee.

**Endpoint**: `PUT /:id`

**Required Level**: 2 (admin and above)

**Path Parameters**:
- `id` (required): Employee ID (UUID)

**Request Body**:
```json
{
  "name": "John Doe Updated",
  "email": "john.updated@example.com"
}
```

---

### Delete Employee

Delete an employee.

**Endpoint**: `DELETE /:id`

**Required Level**: 2 (admin and above)

**Path Parameters**:
- `id` (required): Employee ID (UUID)

---

### Link Auth Account

Link a Supabase Auth account to an employee. Creates the auth user if it doesn't exist.

**Endpoint**: `POST /:id/link-auth`

**Required Level**: 2 (admin and above)

**Path Parameters**:
- `id` (required): Employee ID (UUID)

**Request Body**:
```json
{
  "email": "john@example.com",
  "password": "secure-password"
}
```

**Required Fields**:
- `email`: Email address for auth account
- `password`: Password for auth account

---

### Link Existing Auth Account

Link an existing Supabase Auth user to an employee.

**Endpoint**: `POST /:id/link-existing-auth`

**Required Level**: 2 (admin and above)

**Path Parameters**:
- `id` (required): Employee ID (UUID)

**Request Body**:
```json
{
  "auth_uid": "123e4567-e89b-12d3-a456-426614174002"
}
```

**Required Fields**:
- `auth_uid`: Existing auth user ID (UUID)

---

### Unlink Auth Account

Unlink the authentication account from an employee.

**Endpoint**: `POST /:id/unlink-auth`

**Required Level**: 2 (admin and above)

**Path Parameters**:
- `id` (required): Employee ID (UUID)

---

## Error Responses

All endpoints may return standard error responses (400, 401, 403, 404, 500).

---

## Notes

- Employee codes must be unique
- Auth accounts can only be linked to one employee
- Deleting an employee does not delete the associated auth account
- Level 2+ required for create, update, delete, and auth linking operations

