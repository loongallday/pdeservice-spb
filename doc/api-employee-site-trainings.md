# API Employee Site Trainings

## Overview

The Employee Site Trainings API manages training assignments between employees and customer sites in the Field Service Management system. This API tracks which employees have been trained on specific customer sites, enabling proper assignment of technicians based on their site-specific certifications and safety training requirements.

Use cases include:
- Recording site-specific training completion for technicians
- Tracking certifications for specialized equipment at customer sites
- Managing safety training requirements before site visits
- Filtering available technicians based on site training status

---

## Base URL

```
/api-employee-site-trainings
```

---

## Authentication

All endpoints require a valid JWT token in the Authorization header.

```
Authorization: Bearer <jwt_token>
```

**Permission Levels:**

| Operation | Required Level | Roles |
|-----------|----------------|-------|
| Read (GET) | 0 | Technician L1 or higher |
| Create (POST) | 1 | Assigner, PM, Sales or higher |
| Update (PUT) | 1 | Assigner, PM, Sales or higher |

---

## Endpoints Summary

| Method | Path | Description | Auth Level |
|--------|------|-------------|------------|
| GET | `/` | List training records with filters | 0 |
| GET | `/:id` | Get training record by ID | 0 |
| POST | `/` | Create new training record | 1 |
| PUT | `/:id` | Update training record | 1 |

---

## Endpoints

### 1. List Training Records

Retrieve a paginated list of employee-site training records with optional filters.

**Request**

```
GET /api-employee-site-trainings
```

**Query Parameters**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `page` | integer | No | 1 | Page number (minimum: 1) |
| `limit` | integer | No | 20 | Items per page (1-100) |
| `employee_id` | uuid | No | - | Filter by employee ID |
| `site_id` | uuid | No | - | Filter by site ID |

**Response**

```json
{
  "data": {
    "data": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "employee_id": "660e8400-e29b-41d4-a716-446655440001",
        "site_id": "770e8400-e29b-41d4-a716-446655440002",
        "trained_at": "2024-01-15",
        "created_at": "2024-01-15T10:30:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 45,
      "totalPages": 3,
      "hasNext": true,
      "hasPrevious": false
    }
  }
}
```

**Example Requests**

```bash
# Get all training records (first page)
curl -X GET "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-employee-site-trainings" \
  -H "Authorization: Bearer <token>"

# Filter by employee
curl -X GET "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-employee-site-trainings?employee_id=660e8400-e29b-41d4-a716-446655440001" \
  -H "Authorization: Bearer <token>"

# Filter by site with pagination
curl -X GET "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-employee-site-trainings?site_id=770e8400-e29b-41d4-a716-446655440002&page=2&limit=10" \
  -H "Authorization: Bearer <token>"
```

---

### 2. Get Training Record by ID

Retrieve a single training record by its unique identifier.

**Request**

```
GET /api-employee-site-trainings/:id
```

**Path Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | uuid | Yes | Training record ID |

**Response**

```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "employee_id": "660e8400-e29b-41d4-a716-446655440001",
    "site_id": "770e8400-e29b-41d4-a716-446655440002",
    "trained_at": "2024-01-15",
    "created_at": "2024-01-15T10:30:00Z"
  }
}
```

**Example Request**

```bash
curl -X GET "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-employee-site-trainings/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer <token>"
```

---

### 3. Create Training Record

Create a new training assignment between an employee and a site.

**Request**

```
POST /api-employee-site-trainings
```

**Request Body**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `employee_id` | uuid | Yes | ID of the employee who completed training |
| `site_id` | uuid | Yes | ID of the site for which training was completed |
| `trained_at` | date | No | Date when training was completed (defaults to current date) |

**Request Body Example**

```json
{
  "employee_id": "660e8400-e29b-41d4-a716-446655440001",
  "site_id": "770e8400-e29b-41d4-a716-446655440002",
  "trained_at": "2024-01-15"
}
```

**Response (201 Created)**

```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "employee_id": "660e8400-e29b-41d4-a716-446655440001",
    "site_id": "770e8400-e29b-41d4-a716-446655440002",
    "trained_at": "2024-01-15",
    "created_at": "2024-01-15T10:30:00Z"
  }
}
```

**Example Request**

```bash
curl -X POST "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-employee-site-trainings" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "employee_id": "660e8400-e29b-41d4-a716-446655440001",
    "site_id": "770e8400-e29b-41d4-a716-446655440002",
    "trained_at": "2024-01-15"
  }'
```

---

### 4. Update Training Record

Update an existing training record. Only the `trained_at` date can be modified.

**Request**

```
PUT /api-employee-site-trainings/:id
```

**Path Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | uuid | Yes | Training record ID |

**Request Body**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `employee_id` | uuid | No | ID of the employee (can be changed) |
| `site_id` | uuid | No | ID of the site (can be changed) |
| `trained_at` | date | No | Date when training was completed |

**Request Body Example**

```json
{
  "trained_at": "2024-02-20"
}
```

**Response**

```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "employee_id": "660e8400-e29b-41d4-a716-446655440001",
    "site_id": "770e8400-e29b-41d4-a716-446655440002",
    "trained_at": "2024-02-20",
    "created_at": "2024-01-15T10:30:00Z"
  }
}
```

**Example Request**

```bash
curl -X PUT "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-employee-site-trainings/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"trained_at": "2024-02-20"}'
```

---

## Training Record Object

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `id` | uuid | No | Unique training record identifier |
| `employee_id` | uuid | No | Reference to the trained employee |
| `site_id` | uuid | No | Reference to the site |
| `trained_at` | date | No | Date when training was completed |
| `created_at` | timestamptz | No | Record creation timestamp |

---

## Error Responses

All errors follow the standard API error format:

```json
{
  "error": "Error message in Thai"
}
```

### Common Errors

| HTTP Status | Error Message | Description |
|-------------|---------------|-------------|
| 400 | กรุณาระบุ employee_id | Missing required employee_id field |
| 400 | กรุณาระบุ site_id | Missing required site_id field |
| 400 | รูปแบบวันที่ไม่ถูกต้อง | Invalid date format for trained_at |
| 400 | พนักงานถูกบันทึกการอบรมกับไซต์นี้แล้ว | Duplicate training record (employee-site combination already exists) |
| 400 | ไม่มีข้อมูลที่ต้องการอัปเดต | No valid fields provided for update |
| 401 | ไม่มีสิทธิ์เข้าถึง | Missing or invalid authentication token |
| 403 | ไม่มีสิทธิ์ดำเนินการ | Insufficient permission level |
| 404 | ไม่พบข้อมูล | Training record not found |
| 404 | Not found | Invalid endpoint path |
| 500 | ไม่สามารถดึงข้อมูลได้ | Database error fetching records |
| 500 | ไม่สามารถสร้างข้อมูลได้ | Database error creating record |
| 500 | ไม่สามารถอัปเดตข้อมูลได้ | Database error updating record |

---

## Usage Notes

### Training Record Uniqueness

The combination of `employee_id` and `site_id` must be unique. Attempting to create a duplicate training record for the same employee-site pair will result in a validation error.

### Date Format

The `trained_at` field accepts ISO 8601 date format (YYYY-MM-DD). If not provided during creation, it defaults to the current date.

### Filtering Strategies

- **By Employee**: Use `employee_id` filter to see all sites where a specific employee has been trained
- **By Site**: Use `site_id` filter to see all employees who have been trained for a specific site
- **Combined**: Both filters can be used together to check if a specific employee has training for a specific site

---

## Related Endpoints

- **Employees API** (`/api-employees`) - Employee management
- **Sites** - Customer site management (accessed via company endpoints)
- **Appointments API** (`/api-appointments`) - Schedule technicians for site visits

---

## Database Table

Training records are stored in the `jct_site_employee_trainings` junction table:

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | No | gen_random_uuid() | Primary key |
| employee_id | uuid | No | - | FK to main_employees |
| site_id | uuid | No | - | FK to main_sites |
| trained_at | date | No | CURRENT_DATE | Training completion date |
| created_at | timestamptz | No | now() | Record creation timestamp |

**Constraints:**
- Unique constraint on (employee_id, site_id) combination
- Foreign key to main_employees
- Foreign key to main_sites
