# Tickets API

## Overview

The Tickets API handles comprehensive ticket management operations for work orders and service requests. It provides a unified interface for creating, updating, and managing tickets along with all related data (company, site, contact, appointment, employees, merchandise) in single API calls.

**Base URL**: `/functions/v1/api-tickets`

**Authentication**: All endpoints require Bearer token authentication.

**Key Features**:
- Comprehensive ticket CRUD operations with automatic handling of related data
- Create/update tickets with company, site, contact, appointment, employees, and merchandise in one call
- Select existing entities by ID or create new ones (no updates after creation)
- Full search and filtering capabilities with pagination
- Date-based search with selectable date types (create, update, appointed)
- Site validation (merchandise must be in the same site as ticket)

---

## Endpoints

### Search Tickets

Search for tickets with filters on all ticket fields. Supports pagination. **Use this endpoint instead of the old list endpoint.**

**Important**: This endpoint returns only ticket data (table rows). Filter options (work types, statuses, departments, etc.) should be loaded separately from `/api-reference-data` endpoints and should not be reloaded when filters change. Only the table data should reload when filters are adjusted.

**Endpoint**: `GET /search`

**Required Level**: 0 (all authenticated users)

**Query Parameters**:

**Pagination**:
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)

**Sorting** (optional):
- `sort` (optional): Sort field. Options:
  - `created_at` (default): Sort by creation date
  - `updated_at`: Sort by last update date
  - `appointment_date`: Sort by appointment date
- `order` (optional): Sort order. Options:
  - `desc` (default): Descending order (newest first)
  - `asc`: Ascending order (oldest first)

**Filters** (all optional, can be combined):
- `id`: Ticket ID (UUID)
- `details`: Search in ticket details (partial match, case-insensitive)
- `work_type_id`: Filter by work type ID (UUID)
- `assigner_id`: Filter by assigner employee ID (UUID)
- `status_id`: Filter by status ID (UUID)
- `additional`: Search in additional notes (partial match, case-insensitive)
- `site_id`: Filter by site ID (UUID)
- `contact_id`: Filter by contact ID (UUID)
- `work_result_id`: Filter by work result ID (UUID)
- `appointment_id`: Filter by appointment ID (UUID)
- `created_at`: Filter by creation date. Supports:
  - Single date: `YYYY-MM-DD` (matches that day)
  - Date range: `YYYY-MM-DD,YYYY-MM-DD` (matches dates in range, inclusive)
- `updated_at`: Filter by update date. Supports:
  - Single date: `YYYY-MM-DD` (matches that day)
  - Date range: `YYYY-MM-DD,YYYY-MM-DD` (matches dates in range, inclusive)
- `start_date`: Start date for filtering by appointment date (YYYY-MM-DD). Must be used with `end_date`. Automatically excludes tickets with null appointment dates.
- `end_date`: End date for filtering by appointment date (YYYY-MM-DD). Must be used with `start_date`. Automatically excludes tickets with null appointment dates.
- `exclude_backlog`: Set to `true` to exclude tickets with null appointment_id (backlog tickets)
- `employee_id`: Filter by employee ID(s) assigned to tickets. Supports:
  - Single value: `employee_id=abc-123` (filters tickets assigned to that employee)
  - Multiple values: `employee_id=abc-123%def-456%ghi-789` (percent-separated, filters tickets assigned to any of those employees)
  - Filters through the `ticket_employees` table (employees assigned to work on tickets)
  - **Note**: This is different from `assigner_id` which filters by the employee who assigned the ticket
- `department_id`: Filter by department ID(s). Supports:
  - Single value: `department_id=abc-123` (filters tickets with employees from that department)
  - Multiple values: `department_id=abc-123%def-456%ghi-789` (percent-separated, filters tickets with employees from any of those departments)
  - Filters through the relationship: departments → roles → employees → ticket_employees → tickets

**Example Request** (basic search):
```http
GET /functions/v1/api-tickets/search?status_id=xxx&site_id=yyy&page=1&limit=20
Authorization: Bearer <token>
```

**Example Request** (filter by appointment date):
```http
GET /functions/v1/api-tickets/search?start_date=2025-11-23&end_date=2025-11-23&exclude_backlog=true&page=1&limit=20
Authorization: Bearer <token>
```

**Example Request** (filter by employee):
```http
GET /functions/v1/api-tickets/search?employee_id=abc-123&page=1&limit=20
Authorization: Bearer <token>
```

**Example Request** (filter by multiple employees):
```http
GET /functions/v1/api-tickets/search?employee_id=abc-123%def-456%ghi-789&page=1&limit=20
Authorization: Bearer <token>
```

**Example Request** (filter by department):
```http
GET /functions/v1/api-tickets/search?department_id=abc-123&page=1&limit=20
Authorization: Bearer <token>
```

**Example Request** (filter by multiple departments):
```http
GET /functions/v1/api-tickets/search?department_id=abc-123%def-456%ghi-789&page=1&limit=20
Authorization: Bearer <token>
```

**Example Request** (with sorting):
```http
GET /functions/v1/api-tickets/search?status_id=xxx&sort=updated_at&order=desc&page=1&limit=20
Authorization: Bearer <token>
```

**Example Request** (sort by appointment date):
```http
GET /functions/v1/api-tickets/search?sort=appointment_date&order=asc&page=1&limit=20
Authorization: Bearer <token>
```

**Example Response**:
```json
{
  "data": {
    "data": [
      {
        "id": "123e4567-e89b-12d3-a456-426614174000",
        "details": "Fix printer issue",
        "work_type_name": "PM",
        "work_type_code": "pm",
        "assigner_name": "John Doe",
        "assigner_code": "EMP001",
        "creator_name": "Jane Smith",
        "creator_code": "ADMIN001",
        "created_by": "123e4567-e89b-12d3-a456-426614174008",
        "status_name": "In Progress",
        "status_code": "in_progress",
        "additional": "Additional notes",
        "created_at": "2024-01-01T00:00:00Z",
        "updated_at": "2024-01-01T00:00:00Z",
        "site_name": "Main Office",
        "company_name": "Example Company",
        "provinceCode": 10,
        "districtCode": 101,
        "subDistrictCode": 10101,
        "contact_name": "Jane Smith",
        "appointment_id": "123e4567-e89b-12d3-a456-426614174007",
        "appointment_date": "2024-01-15",
        "appointment_time_start": "09:00:00",
        "appointment_time_end": "12:00:00",
        "appointment_type": "time_range",
        "employee_names": ["Employee 1", "Employee 2"],
        "employee_count": 2,
        "merchandise": [
          {
            "id": "123e4567-e89b-12d3-a456-426614174010",
            "serial": "SN12345",
            "model": "MODEL-001"
          }
        ],
        "merchandise_count": 1
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 50,
      "totalPages": 3,
      "hasNext": true,
      "hasPrevious": false
    }
  }
}
```

**Response Fields**:
- `id`: Ticket ID (UUID) - used to fetch full details or update
- `details`: Ticket description
- `work_type_name`: Work type display name
- `work_type_code`: Work type code
- `assigner_name`: Assigner display name
- `assigner_code`: Assigner employee code
- `creator_name`: Creator display name (employee who created the ticket)
- `creator_code`: Creator employee code (employee who created the ticket)
- `created_by`: Creator employee ID (UUID, automatically set by backend when creating ticket)
- `status_name`: Status display name
- `status_code`: Status code
- `additional`: Additional notes
- `created_at`: Creation timestamp
- `updated_at`: Last update timestamp
- `site_name`: Site display name
- `company_name`: Company name (Thai preferred, English fallback)
- `provinceCode`: Province code (integer, from site, nullable)
- `districtCode`: District code (integer, from site, nullable)
- `subDistrictCode`: Subdistrict code (integer, from site, nullable)
- `contact_name`: Contact person name (if exists)
- `appointment_id`: Appointment ID (UUID, if exists)
- `appointment_date`: Appointment date (YYYY-MM-DD, if exists)
- `appointment_time_start`: Appointment start time (if exists)
- `appointment_time_end`: Appointment end time (if exists)
- `appointment_type`: Appointment type (e.g., "time_range", "all_day", etc., if exists)
- `employee_names`: Array of assigned employee names
- `employee_count`: Number of assigned employees
- `merchandise`: Array of merchandise items linked to the ticket. Each item contains:
  - `id`: Merchandise ID
  - `serial`: Serial number
  - `model`: Model code
- `merchandise_count`: Number of merchandise items

**Notes**:
- All filters are optional and can be combined
- Text fields (`details`, `additional`) support partial matching (case-insensitive)
- Date filters support single date or date range
- When using `start_date` and `end_date` together, filters by appointment date and automatically excludes tickets with null appointment dates
- `exclude_backlog=true` excludes tickets where `appointment_id` is null (backlog tickets)
- **Sorting**: Results can be sorted by `created_at`, `updated_at`, or `appointment_date`. Default is `created_at` in descending order (newest first). When sorting by `appointment_date`, tickets without appointments are placed at the end.
- Returns paginated results with pagination metadata
- Response contains flattened display fields (no nested objects)
- `created_by` is automatically set by the backend when creating tickets (cannot be manually set)
- **Filter Options**: Filter options (work types, statuses, departments, etc.) should be loaded separately from the `/api-reference-data` endpoints. When filters are adjusted, only the table data should reload via this `/search` endpoint. Filter options should not be reloaded when filters change.

---

### Search Tickets by Duration

Search tickets by date range with selectable date type (create, update, or appointed date).

**Endpoint**: `GET /search-duration`

**Required Level**: 0 (all authenticated users)

**Query Parameters**:

**Required**:
- `startDate` (required): Start date in `YYYY-MM-DD` format
- `endDate` (required): End date in `YYYY-MM-DD` format
- `date_type` (optional): Date type to filter by. Options:
  - `create` (default): Filter by ticket creation date (`created_at`)
  - `update`: Filter by ticket update date (`updated_at`)
  - `appointed`: Filter by appointment date (`appointment_date` from appointments table)

**Pagination**:
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)

**Sorting** (optional):
- `sort` (optional): Sort field. Options:
  - `created_at` (default): Sort by creation date
  - `updated_at`: Sort by last update date
  - `appointment_date`: Sort by appointment date
- `order` (optional): Sort order. Options:
  - `desc` (default): Descending order (newest first)
  - `asc`: Ascending order (oldest first)

**Example Request** (filter by creation date):
```http
GET /functions/v1/api-tickets/search-duration?startDate=2024-01-01&endDate=2024-01-31&date_type=create&page=1&limit=20
Authorization: Bearer <token>
```

**Example Request** (filter by appointment date):
```http
GET /functions/v1/api-tickets/search-duration?startDate=2024-01-15&endDate=2024-01-20&date_type=appointed&page=1&limit=20
Authorization: Bearer <token>
```

**Example Request** (with sorting):
```http
GET /functions/v1/api-tickets/search-duration?startDate=2024-01-01&endDate=2024-01-31&date_type=create&sort=appointment_date&order=asc&page=1&limit=20
Authorization: Bearer <token>
```

**Example Response**:
```json
{
  "data": {
    "data": [
      {
        "id": "123e4567-e89b-12d3-a456-426614174000",
        "details": "Fix printer issue",
        "work_type_name": "PM",
        "work_type_code": "pm",
        "assigner_name": "John Doe",
        "assigner_code": "EMP001",
        "creator_name": "Jane Smith",
        "status_name": "In Progress",
        "status_code": "in_progress",
        "additional": "Additional notes",
        "created_at": "2024-01-01T00:00:00Z",
        "updated_at": "2024-01-01T00:00:00Z",
        "site_name": "Main Office",
        "company_name": "Example Company",
        "provinceCode": 10,
        "districtCode": 101,
        "subDistrictCode": 10101,
        "contact_name": null,
        "appointment_id": "123e4567-e89b-12d3-a456-426614174007",
        "appointment_date": "2024-01-15",
        "appointment_time_start": "09:00:00",
        "appointment_time_end": "12:00:00",
        "appointment_type": "time_range",
        "employee_names": ["Employee 1"],
        "employee_count": 1,
        "merchandise": [],
        "merchandise_count": 0
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 50,
      "totalPages": 3,
      "hasNext": true,
      "hasPrevious": false
    }
  }
}
```

**Notes**:
- Date range is inclusive (includes both start and end dates)
- For `date_type=appointed`, only tickets with appointments in the date range are returned
- **Sorting**: Results can be sorted by `created_at`, `updated_at`, or `appointment_date`. Default is `created_at` in descending order (newest first). When sorting by `appointment_date`, tickets without appointments are placed at the end.
- Returns paginated results with pagination metadata
- Response contains flattened display fields (no nested objects)
- **Filter Options**: Filter options (work types, statuses, departments, etc.) should be loaded separately from the `/api-reference-data` endpoints. When filters are adjusted, only the table data should reload via this endpoint. Filter options should not be reloaded when filters change.

---

### Get Ticket by ID

Get a single ticket by its ID with full details including site, appointment, and work result.

**Endpoint**: `GET /:id`

**Required Level**: 0 (all authenticated users)

**Path Parameters**:
- `id` (required): Ticket ID (UUID)

**Example Request**:
```http
GET /functions/v1/api-tickets/123e4567-e89b-12d3-a456-426614174000
Authorization: Bearer <token>
```

**Example Response**:
```json
{
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "details": "Fix printer issue",
    "work_type_id": "123e4567-e89b-12d3-a456-426614174002",
    "assigner_id": "123e4567-e89b-12d3-a456-426614174003",
    "status_id": "123e4567-e89b-12d3-a456-426614174004",
    "additional": "Additional notes",
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z",
    "created_by": "123e4567-e89b-12d3-a456-426614174008",
    "site_id": "123e4567-e89b-12d3-a456-426614174001",
    "contact_id": "123e4567-e89b-12d3-a456-426614174005",
    "work_result_id": "123e4567-e89b-12d3-a456-426614174006",
    "appointment_id": "123e4567-e89b-12d3-a456-426614174007",
    "work_type": {
      "id": "123e4567-e89b-12d3-a456-426614174002",
      "code": "pm",
      "name": "PM",
      "created_at": "2024-01-01T00:00:00Z"
    },
    "assigner": {
      "id": "123e4567-e89b-12d3-a456-426614174003",
      "code": "EMP001",
      "name": "John Doe",
      "email": "john@example.com",
      "role_id": "...",
      "nickname": "John",
      "is_active": true,
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z",
      "auth_user_id": null,
      "supervisor_id": null,
      "profile_image_url": null
    },
    "creator": {
      "id": "123e4567-e89b-12d3-a456-426614174008",
      "code": "ADMIN001",
      "name": "System Administrator",
      "email": "admin@example.com",
      "role_id": "...",
      "nickname": "Admin",
      "is_active": true,
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z",
      "auth_user_id": "...",
      "supervisor_id": null,
      "profile_image_url": null
    },
    "status": {
      "id": "123e4567-e89b-12d3-a456-426614174004",
      "code": "in_progress",
      "name": "In Progress"
    },
    "site": {
      "id": "123e4567-e89b-12d3-a456-426614174001",
      "name": "Main Office",
      "company": {
        "tax_id": "1234567890123",
        "name_th": "บริษัทตัวอย่าง",
        "name_en": "Example Company",
        "address_detail": "เลขที่ 123, ถนน Main",
        "address_tambon": "บางรัก",
        "address_district": "บางรัก",
        "address_province": "กรุงเทพมหานคร",
        "address_tambon_code": "100405",
        "address_district_code": "1004",
        "address_province_code": "1"
      },
      "map_url": null,
      "company_id": "1234567890123",
      "contact_ids": [],
      "postal_code": 10100,
      "district_code": 1004,
      "province_code": 1,
      "address_detail": "123 Main Street",
      "is_main_branch": true,
      "safety_standard": null,
      "subdistrict_code": 100405
    },
    "contact": {
      "id": "123e4567-e89b-12d3-a456-426614174005",
      "person_name": "Jane Smith",
      "phone": ["0812345678"],
      "email": ["jane@example.com"]
    },
    "appointment": {
      "id": "123e4567-e89b-12d3-a456-426614174007",
      "ticket_id": "123e4567-e89b-12d3-a456-426614174000",
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z",
      "appointment_date": "2024-01-15",
      "appointment_type": "scheduled",
      "appointment_time_start": "09:00:00",
      "appointment_time_end": "12:00:00"
    },
    "employees": [
      {
        "id": "123e4567-e89b-12d3-a456-426614174009",
        "name": "Employee 1",
        "code": "EMP002"
      }
    ],
    "merchandise": [
      {
        "id": "123e4567-e89b-12d3-a456-426614174010",
        "serial_no": "SN12345",
        "model": {
          "id": "...",
          "model": "MODEL-001",
          "name": "Model Name"
        }
      }
    ],
    "time": "2024-01-01T00:00:00Z",
    "work_result": null,
    "creator_name": "System Administrator",
    "creator_code": "ADMIN001"
  }
}
```

**Response Fields**:
- All ticket fields (id, details, work_type_id, assigner_id, status_id, etc.)
- `created_by`: Creator employee ID (UUID, automatically set by backend when creating ticket)
- `work_type`: Work type details (id, name, code)
- `assigner`: Assigner employee details
- `creator`: Creator employee details (employee who created the ticket, automatically set by backend)
- `status`: Ticket status details (id, name, code)
- `site`: Full site details including company information
- `contact`: Contact person details
- `appointment`: Appointment details (always present - created automatically if not provided)
- `work_result`: Work result details with photos and documents (if exists)
- `employees`: Array of assigned employees
- `time`: Alias for created_at (for frontend compatibility)
- `creator_name`: Creator display name (for frontend compatibility)
- `creator_code`: Creator employee code (for frontend compatibility)

---

### Create Ticket

Create a new ticket with all related data (company, site, contact, appointment, employees, merchandise) in one API call.

**Endpoint**: `POST /`

**Required Level**: 1 (non-technician_l1 and above)

**Request Headers** (optional):
- `Idempotency-Key` (optional): A unique identifier (UUID recommended) to prevent duplicate ticket creation. If provided, duplicate requests with the same key and payload will return the cached response instead of creating a new ticket. See [Idempotency Guide](../IDEMPOTENCY.md) for details.

**Request Body**:
```json
{
  "ticket": {
    "work_type_id": "123e4567-e89b-12d3-a456-426614174001",
    "assigner_id": "123e4567-e89b-12d3-a456-426614174002",
    "status_id": "123e4567-e89b-12d3-a456-426614174003",
    "details": "Ticket description",
    "additional": "Additional notes"
  },
  "company": {
    "tax_id": "1234567890123",
    "name_th": "บริษัทตัวอย่าง",
    "name_en": "Example Company",
    "address_detail": "123 Main Street",
    "address_tambon_code": "10101",
    "address_district_code": "1001",
    "address_province_code": "10"
  },
  "site": {
    "id": "123e4567-e89b-12d3-a456-426614174010",
    "name": "Main Office",
    "address_detail": "123 Main Street",
    "subdistrict_code": 10101,
    "district_code": 101,
    "province_code": 10,
    "postal_code": 10100
  },
  "contact": {
    "id": "123e4567-e89b-12d3-a456-426614174011",
    "person_name": "John Doe",
    "phone": ["0812345678"],
    "email": ["john@example.com"]
  },
  "appointment": {
    "appointment_date": "2024-01-15",
    "appointment_time_start": "09:00:00",
    "appointment_time_end": "12:00:00",
    "appointment_type": "scheduled"
  },
  "employee_ids": [
    "123e4567-e89b-12d3-a456-426614174004",
    "123e4567-e89b-12d3-a456-426614174005"
  ],
  "merchandise_ids": ["123e4567-e89b-12d3-a456-426614174006"]
}
```

**Required Fields**:
- `ticket.work_type_id`: Work type ID (UUID)
- `ticket.assigner_id`: Assigner employee ID (UUID)
- `ticket.status_id`: Ticket status ID (UUID)

**Optional Fields**:
- `ticket.details`: Ticket description
- `ticket.additional`: Additional notes
- `company`: Company data
  - If `tax_id` exists in database: Use existing company
  - If `tax_id` doesn't exist: Create new company
  - **Required fields for new company**: `tax_id`, `name_th`, `address_tambon_code`, `address_district_code`, `address_province_code`
- `site`: Site data
  - If `id` provided: Use existing site (validates it exists)
  - If `id` not provided: Create new site
  - **Required fields for new site**: `name`, `subdistrict_code`, `district_code`, `province_code`, `postal_code`
- `contact`: Contact data
  - If `id` provided: Use existing contact (validates it exists)
  - If `id` not provided: Create new contact
- `appointment`: Appointment data (optional - if not provided, an empty appointment record will be created automatically)
- `employee_ids`: Array of employee IDs to assign (supports multiple technicians)
- `merchandise_ids`: Array of merchandise IDs to link

**Example Request** (with idempotency):
```http
POST /functions/v1/api-tickets
Authorization: Bearer <token>
Content-Type: application/json
Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000

{
  "ticket": {
    "work_type_id": "123e4567-e89b-12d3-a456-426614174001",
    "assigner_id": "123e4567-e89b-12d3-a456-426614174002",
    "status_id": "123e4567-e89b-12d3-a456-426614174003",
    "details": "Ticket description"
  },
  // ... rest of data
}
```

**Example Response** (201 Created):
```json
{
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "details": "Ticket description",
    "work_type_id": "123e4567-e89b-12d3-a456-426614174001",
    "assigner_id": "123e4567-e89b-12d3-a456-426614174002",
    "status_id": "123e4567-e89b-12d3-a456-426614174003",
    "created_at": "2024-01-01T00:00:00Z",
    "created_by": "123e4567-e89b-12d3-a456-426614174008",
    // ... full ticket data with related entities
  }
}
```

**Notes**:
- **Idempotency**: This endpoint supports idempotency to prevent duplicate ticket creation. Include an `Idempotency-Key` header with a unique UUID. If the same key and payload are used again, the original response is returned without creating a duplicate ticket. See [Idempotency Guide](../IDEMPOTENCY.md) for complete documentation and examples.
- **Created By**: Automatically set by the backend system using the authenticated employee's ID. Users should not provide `created_by` in the request.
- **Appointment**: An appointment record is **always created** for every ticket, even if no appointment data is provided. If `appointment` is not provided in the request, an empty appointment record will be created automatically.
- **Company**: If `tax_id` exists, it will be used. Otherwise, a new company is created. No updates to existing companies.
- **Site**: If `id` is provided, it must exist and will be used. Otherwise, a new site is created. No updates to existing sites.
- **Contact**: If `id` is provided, it must exist and will be used. Otherwise, a new contact is created. No updates to existing contacts.
- **Employee Assignment**: Employees can be assigned to multiple appointments on the same date. No overlap validation is performed.
- All merchandise must be in the same site as the ticket (enforced at database level)

---

### Update Ticket

Update an existing ticket with all related data (company, site, contact, appointment, employees, merchandise).

**Endpoint**: `PUT /:id`

**Required Level**: 1 (non-technician_l1 and above)

**Path Parameters**:
- `id` (required): Ticket ID (UUID)

**Request Body**:
```json
{
  "ticket": {
    "details": "Updated description",
    "status_id": "uuid-here",
    "work_type_id": "uuid-here",
    "additional": "Updated notes"
  },
  "company": {
    "tax_id": "1234567890123",
    "name_th": "บริษัทตัวอย่าง",
    "address_detail": "Updated address"
  },
  "site": {
    "id": "123e4567-e89b-12d3-a456-426614174010"
  },
  "contact": {
    "id": "123e4567-e89b-12d3-a456-426614174011"
  },
  "appointment": {
    "appointment_date": "2024-01-20",
    "appointment_time_start": "10:00:00",
    "appointment_time_end": "13:00:00"
  },
  "employee_ids": [
    "employee-uuid-1",
    "employee-uuid-2",
    "employee-uuid-3"
  ],
  "merchandise_ids": ["merchandise-uuid-1", "merchandise-uuid-2"]
}
```

**Fields** (all optional - only provided fields will be updated):
- `ticket`: Ticket fields to update
- `company`: Company data
  - If `tax_id` exists: Use existing company
  - If `tax_id` doesn't exist: Create new company
  - **No updates to existing companies**
- `site`: Site data
  - If `id` provided: Use existing site (must exist)
  - If `id` not provided: Create new site
  - **No updates to existing sites**
  - If `null`: Clear the site from ticket
- `contact`: Contact data
  - If `id` provided: Use existing contact (must exist)
  - If `id` not provided: Create new contact
  - **No updates to existing contacts**
  - If `null`: Clear the contact from ticket
- `appointment`: Appointment data
  - If appointment exists: Update it
  - If appointment doesn't exist: Create new one
  - If `null`: Unlink appointment from ticket
- `employee_ids`: Array of employee IDs to replace all employee assignments (supports multiple technicians)
- `merchandise_ids`: Array of merchandise IDs to replace all merchandise associations

**Notes**:
- All fields are optional - only provided fields will be updated
- **Company/Site/Contact**: Cannot be updated after creation. You can only:
  - Use existing entity by providing `id` (or `tax_id` for company)
  - Create new entity by providing details without `id`
- If `employee_ids` is provided, it replaces all existing employee assignments
- If `merchandise_ids` is provided, it replaces all existing merchandise associations
- To remove all employees/merchandise, send an empty array `[]`
- To keep existing employees/merchandise unchanged, omit the field
- To clear site/contact, send `null` for that field

**Validation**:
- All merchandise in `merchandise_ids` must exist
- All merchandise must be in the same site as the ticket (if ticket has a site)
- Duplicate IDs in the array are automatically deduplicated
- **Employee Assignment**: Employees can be assigned to multiple appointments on the same date. No overlap validation is performed.

---

### Remove Ticket-Employee Assignment

Remove a specific employee assignment from a ticket. The assignment is uniquely identified by the combination of `ticket_id`, `employee_id`, and `date`.

**Endpoint**: `DELETE /employees`

**Required Level**: 2 (level 2 and above)

**Request Body**:
```json
{
  "ticket_id": "123e4567-e89b-12d3-a456-426614174000",
  "employee_id": "123e4567-e89b-12d3-a456-426614174001",
  "date": "2024-12-02"
}
```

**Request Fields**:
- `ticket_id` (required): UUID of the ticket
- `employee_id` (required): UUID of the employee to remove
- `date` (required): Date of the assignment (YYYY-MM-DD format)

**Example Request**:
```http
DELETE /functions/v1/api-tickets/employees
Authorization: Bearer <token>
Content-Type: application/json

{
  "ticket_id": "123e4567-e89b-12d3-a456-426614174000",
  "employee_id": "123e4567-e89b-12d3-a456-426614174001",
  "date": "2024-12-02"
}
```

**Example Response** (200 OK):
```json
{
  "data": {
    "message": "ลบการมอบหมายพนักงานสำเร็จ"
  }
}
```

**Error Responses**:
- `400 Bad Request`: Missing required fields or invalid date format
- `403 Forbidden`: Insufficient permission level
- `404 Not Found`: Assignment not found

**Notes**:
- The assignment is uniquely identified by the combination of `date`, `employee_id`, and `ticket_id`
- This endpoint allows de-assigning employees from tickets without deleting the entire ticket
- Only level 2+ employees can remove assignments

---

### Delete Ticket

Delete a ticket and optionally related data (appointment, contact). All related data (employees, merchandise, work results) are automatically cleaned up.

**Endpoint**: `DELETE /:id`

**Required Level**: 1 (non-technician_l1 and above)

**Path Parameters**:
- `id` (required): Ticket ID (UUID)

**Query Parameters** (optional):
- `delete_appointment` (optional): Set to `true` to also delete the associated appointment (default: `false`)
- `delete_contact` (optional): Set to `true` to also delete the associated contact if no other tickets use it (default: `false`)

**Example Request**:
```http
DELETE /functions/v1/api-tickets/123e4567-e89b-12d3-a456-426614174000?delete_appointment=true&delete_contact=true
Authorization: Bearer <token>
```

**Example Response**:
```json
{
  "data": {
    "message": "ลบตั๋วงานสำเร็จ"
  }
}
```

**Notes**:
- Ticket is always deleted
- Employee assignments are automatically removed
- Merchandise associations are automatically removed
- Work results are automatically removed
- Appointment is only deleted if `delete_appointment=true`
- Contact is only deleted if `delete_contact=true` and no other tickets use it

---

## Error Responses

Standard error responses apply (400, 401, 403, 404, 500).

### 400 Bad Request - Employee Appointment Conflict

When creating or updating a ticket with employee assignments that conflict with existing appointments:

```json
{
  "error": "พนักงานต่อไปนี้มีนัดหมายซ้อนทับในวันที่ 2025-01-15: John Technician, Jane Technician"
}
```

This error occurs when:
- Employees being assigned already have appointments on the same date
- If time ranges are provided, the error occurs when time ranges overlap
- The error message lists all employees with conflicts

### 400 Bad Request - Idempotency Errors

When using idempotency keys, the following errors may occur:

**Concurrent Request (Operation in Progress)**:
```json
{
  "error": "คำขอกำลังดำเนินการอยู่ กรุณารอสักครู่"
}
```
- Occurs when two requests with the same idempotency key arrive simultaneously
- Solution: Wait 1-2 seconds and retry with the same key

**Mismatched Payload**:
```json
{
  "error": "Idempotency key นี้ถูกใช้กับข้อมูลที่แตกต่างกันแล้ว"
}
```
- Occurs when the same idempotency key is used with different request data
- Solution: Generate a new unique key for each distinct request

**Key Used by Different Employee**:
```json
{
  "error": "Idempotency key นี้ถูกใช้โดยพนักงานคนอื่นแล้ว"
}
```
- Occurs when an idempotency key is reused by a different employee
- Solution: Each employee should use their own unique keys

For complete idempotency documentation, see [Idempotency Guide](../IDEMPOTENCY.md).

---

## Notes

- Tickets are linked to companies, sites, and work types
- Tickets can have appointments and work results associated
- Status changes may trigger workflow actions
- Merchandise linked to tickets must be in the same site as the ticket (enforced at database level)
- Multiple merchandise can be linked to a single ticket
- Merchandise associations are automatically deleted when ticket or merchandise is deleted
- **Company/Site/Contact cannot be updated after creation** - you can only select existing (by ID) or create new
- Use the `/search` endpoint for listing and filtering tickets (replaces the old `/` list endpoint)
