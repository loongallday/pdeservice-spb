# Employees API

## Overview

The Employees API handles all employee management operations including CRUD operations, network search for employee management, and authentication account linking.

**Base URL**: `/functions/v1/api-employees`

**Authentication**: All endpoints require Bearer token authentication.

---

## Endpoints

### Network Search Employees

Network user search API for employee management. Optimized for network-based employee searches with text search and network-relevant filters.

**Endpoint**: `GET /network-search`

**Required Level**: 0 (all authenticated users)

**Query Parameters**:
- `q` (optional): Text search query (searches name and email)
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20, max: 100)
- `role` (optional): Filter by role code (exact match)
- `role_id` (optional): Filter by role ID (UUID, takes precedence over `role`)
- `department_id` (optional): Filter by department ID (UUID)
- `is_active` (optional): Filter by active status (`true` or `false`)

**Example Request**:
```http
GET /functions/v1/api-employees/network-search?q=john&page=1&limit=20&role_id=123e4567-e89b-12d3-a456-426614174001&department_id=123e4567-e89b-12d3-a456-426614174000&is_active=true
Authorization: Bearer <token>
```

**Example Response**:
```json
{
  "data": {
    "data": [
      {
        "id": "123e4567-e89b-12d3-a456-426614174000",
        "code": "EMP001",
        "name": "John Smith",
        "email": "john@example.com",
        "nickname": "John",
        "level": 0,
        "role_id": "123e4567-e89b-12d3-a456-426614174001",
        "is_active": true,
        "auth_user_id": null,
        "created_at": "2024-01-01T00:00:00Z",
        "updated_at": "2024-01-01T00:00:00Z",
        "role_data": {
          "id": "123e4567-e89b-12d3-a456-426614174001",
          "code": "ADMIN",
          "name_th": "ผู้ดูแลระบบ",
          "name_en": "Administrator",
          "level": 10,
          "department_id": "123e4567-e89b-12d3-a456-426614174000",
          "department": {
            "id": "123e4567-e89b-12d3-a456-426614174000",
            "code": "IT",
            "name_th": "แผนกเทคโนโลยีสารสนเทศ",
            "name_en": "Information Technology"
          }
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 1,
      "totalPages": 1,
      "hasNext": false,
      "hasPrevious": false
    }
  }
}
```

**Searchable Fields** (when using `q` parameter):
- `name` - Employee name (partial match, case-insensitive)
- `email` - Email address (partial match, case-insensitive)

**Filter Notes**:
- `role`: Filters by role code (e.g., "admin", "manager"). Looks up role_id internally.
- `role_id`: Filters by role ID directly (UUID). Takes precedence over `role` if both are provided.
- `department_id`: Filters employees by department. Works by finding all roles in that department and filtering employees with those roles.
- `is_active`: Boolean filter for active/inactive status.
- All filters can be combined. Filters are applied with AND logic.
- Text search (`q`) is optional. If not provided, only filters are applied.

**Pagination**:
- Results are paginated
- Default page size is 20
- Maximum page size is 100
- Results are sorted by name

**Notes**:
- This endpoint is optimized for network user search scenarios
- Text search focuses on name and email fields only (network-relevant fields)
- Returns full employee data including role and department information

---

### Get Employee Summary

Get a lightweight summary of all active employees with minimal fields. No pagination.

**Endpoint**: `GET /employee-summary`

**Required Level**: 0 (all authenticated users)

**Example Request**:
```http
GET /functions/v1/api-employees/employee-summary
Authorization: Bearer <token>
```

**Example Response**:
```json
{
  "data": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "name": "John Smith",
      "email": "john@example.com",
      "role_name": "ผู้ดูแลระบบ",
      "is_link_auth": true
    },
    {
      "id": "223e4567-e89b-12d3-a456-426614174001",
      "name": "Jane Doe",
      "email": "jane@example.com",
      "role_name": "ผู้จัดการ",
      "is_link_auth": false
    }
  ]
}
```

**Response Fields**:
- `id`: Employee ID (UUID)
- `name`: Employee name
- `email`: Email address (nullable)
- `role_name`: Role name in Thai (nullable)
- `is_link_auth`: Boolean indicating if employee has linked auth account (`auth_user_id !== null`)

**Notes**:
- Only returns active employees (`is_active = true`)
- No pagination - returns all active employees
- Results are sorted by name
- `is_link_auth` is `true` if `auth_user_id` is not null, `false` otherwise

---

### Get Technician Workload

Get technicians from the 'technical' department with their workload status for a given date.

**Endpoint**: `GET /technicians/availability`

**Required Level**: 1 (non-technician_l1 and above)

**Query Parameters**:
- `date` (optional): Appointment date in YYYY-MM-DD format. If not provided, all technicians return with `no_work` status.

**Example Request (With Date)**:
```http
GET /functions/v1/api-employees/technicians/availability?date=2025-01-15
Authorization: Bearer <token>
```

**Example Request (No Date - All Technicians with no_work)**:
```http
GET /functions/v1/api-employees/technicians/availability
Authorization: Bearer <token>
```

**Example Response**:
```json
{
  "data": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "name": "John Technician",
      "workload": "light"
    },
    {
      "id": "223e4567-e89b-12d3-a456-426614174001",
      "name": "Jane Technician",
      "workload": "heavy"
    }
  ]
}
```

**Response Fields**:
- `id`: Employee ID (UUID)
- `name`: Employee name
- `workload`: Workload level indicating how busy the technician is on the given date
  - `no_work`: 0 appointments (or no date provided)
  - `light`: 1-2 appointments
  - `medium`: 3-4 appointments
  - `heavy`: 5+ appointments

**Workload Calculation**:
- If no `date` provided: All technicians return with `no_work` status
- If `date` provided: Counts ALL appointments assigned to the technician on the given date
- All appointment types are included in the count (including `call_to_schedule`)
- Technicians are always available for assignment regardless of workload

**Validation**:
- If `date` is provided, it must be in YYYY-MM-DD format

**Notes**:
- Only returns active employees from the 'technical' department
- Workload is based on ticket appointment count
- Returns minimal fields for performance (id, name, workload only)
- Technicians can be assigned to multiple appointments on the same date

---

### Get Employee by ID

Get a single employee by their ID with full details including role and department information.

**Endpoint**: `GET /:id`

**Required Level**: 0 (all authenticated users)

**Path Parameters**:
- `id` (required): Employee ID (UUID)

**Example Request**:
```http
GET /functions/v1/api-employees/123e4567-e89b-12d3-a456-426614174000
Authorization: Bearer <token>
```

**Example Response**:
```json
{
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "code": "EMP001",
    "name": "John Smith",
    "email": "john@example.com",
    "nickname": "John",
    "level": 0,
    "role_id": "123e4567-e89b-12d3-a456-426614174001",
    "is_active": true,
    "auth_user_id": "auth-user-uuid",
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z",
    "role_data": {
      "id": "123e4567-e89b-12d3-a456-426614174001",
      "code": "ADMIN",
      "name_th": "ผู้ดูแลระบบ",
      "name_en": "Administrator",
      "level": 10,
      "department_id": "223e4567-e89b-12d3-a456-426614174000",
      "department": {
        "id": "223e4567-e89b-12d3-a456-426614174000",
        "code": "IT",
        "name_th": "แผนกเทคโนโลยีสารสนเทศ",
        "name_en": "Information Technology"
      }
    }
  }
}
```

---

### Create Employee

Create a new employee.

**Endpoint**: `POST /`

**Required Level**: 2 (admin and above)

**Request Body**:
```json
{
  "code": "EMP001",
  "name": "John Doe",
  "nickname": "John",
  "email": "john@example.com",
  "role_id": "123e4567-e89b-12d3-a456-426614174001",
  "is_active": true
}
```

**Required Fields**:
- `code`: Employee code (unique)
- `name`: Employee name

**Example Request**:
```http
POST /functions/v1/api-employees
Authorization: Bearer <token>
Content-Type: application/json

{
  "code": "EMP001",
  "name": "John Doe",
  "nickname": "John",
  "email": "john@example.com",
  "role_id": "123e4567-e89b-12d3-a456-426614174001",
  "is_active": true
}
```

**Notes**:
- Employee codes must be unique
- Creates initial leave balances for the new employee automatically
- Returns the created employee with full details

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
  "email": "john.updated@example.com",
  "level": 1
}
```

**Example Request**:
```http
PUT /functions/v1/api-employees/123e4567-e89b-12d3-a456-426614174000
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "John Doe Updated",
  "email": "john.updated@example.com",
  "level": 1
}
```

**Notes**:
- Only provided fields are updated
- Returns the updated employee with full details

---

### Delete Employee

Delete an employee.

**Endpoint**: `DELETE /:id`

**Required Level**: 3 (admin and above)

**Path Parameters**:
- `id` (required): Employee ID (UUID)

**Example Request**:
```http
DELETE /functions/v1/api-employees/123e4567-e89b-12d3-a456-426614174000
Authorization: Bearer <token>
```

**Notes**:
- Deleting an employee does not delete the associated auth account
- Returns success message on successful deletion

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

**Example Request**:
```http
POST /functions/v1/api-employees/123e4567-e89b-12d3-a456-426614174000/link-auth
Authorization: Bearer <token>
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "secure-password"
}
```

**Notes**:
- Creates the auth user if it doesn't exist
- Links existing auth user if email already exists
- Updates the employee's `auth_user_id` field
- Auth accounts can only be linked to one employee

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

**Example Request**:
```http
POST /functions/v1/api-employees/123e4567-e89b-12d3-a456-426614174000/link-existing-auth
Authorization: Bearer <token>
Content-Type: application/json

{
  "auth_uid": "123e4567-e89b-12d3-a456-426614174002"
}
```

**Notes**:
- Use this if you already created the auth user manually or via Supabase Dashboard
- Updates the employee's `auth_user_id` field
- Auth accounts can only be linked to one employee

---

### Unlink Auth Account

Unlink the authentication account from an employee.

**Endpoint**: `POST /:id/unlink-auth`

**Required Level**: 2 (admin and above)

**Path Parameters**:
- `id` (required): Employee ID (UUID)

**Example Request**:
```http
POST /functions/v1/api-employees/123e4567-e89b-12d3-a456-426614174000/unlink-auth
Authorization: Bearer <token>
```

**Notes**:
- Sets the employee's `auth_user_id` to null
- Does not delete the auth account itself
- Returns success message on successful unlinking

---

## Error Responses

All endpoints may return standard error responses:

- `400 Bad Request`: Validation error (missing required fields, invalid format)
- `401 Unauthorized`: Missing or invalid authentication token
- `403 Forbidden`: Insufficient permission level
- `404 Not Found`: Employee not found
- `409 Conflict`: Duplicate employee code or constraint violation
- `500 Internal Server Error`: Server error

**Example Error Response**:
```json
{
  "error": "ไม่พบข้อมูลพนักงาน"
}
```

---

## Notes

- Employee codes must be unique
- Auth accounts can only be linked to one employee
- Deleting an employee does not delete the associated auth account
- Level 2+ required for create, update, and auth linking operations
- Level 3+ required for delete operations
- Network search supports combining multiple filters with AND logic
- Network search focuses on name and email fields for text search (network-relevant fields)
- Employee summary only includes active employees and has no pagination
- Department filtering works by finding all roles in that department and filtering employees with those roles

---

## Migration Notes

The following endpoints have been removed or replaced:

- **Removed**: `GET /` (List Employees) - Use `GET /network-search` instead
- **Removed**: `GET /code/:code` (Get Employee by Code) - Use `GET /network-search?q=CODE` instead (searches name and email)
- **Removed**: `GET /role/:role` (Get Employees by Role) - Use `GET /network-search?role=ROLE` instead
- **Removed**: `GET /search` (Master Search) - Replaced with `GET /network-search` (optimized for network user search)
- **Removed**: `GET /role-counts` (Get Employee Counts by Role) - Functionality removed
- **Removed**: `GET /department-counts` (Get Employee Counts by Department) - Moved to `api-departments` as `GET /department-summary`

All employee search functionality is now available through the network search endpoint (`GET /network-search`) which is optimized for network user search scenarios with text search on name and email fields, and network-relevant filters (department, role, active status).
