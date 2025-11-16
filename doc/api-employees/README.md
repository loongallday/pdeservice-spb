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

