# API Contacts Documentation

## Overview

The Contacts API manages site contact persons within the PDE Service system. Contacts are associated with customer sites and store information about the people at those locations who can be reached for service-related communications.

This API provides full CRUD (Create, Read, Update, Delete) operations for managing contacts linked to sites (`main_sites`).

## Base URL

```
/api-contacts
```

## Authentication

All endpoints require JWT authentication. Include the Bearer token in the Authorization header:

```
Authorization: Bearer <jwt_token>
```

## Authorization Levels

| Level | Role | Capabilities |
|-------|------|--------------|
| 0 | Technician L1 | Read-only (list, get, search) |
| 1 | Assigner, PM, Sales | Create, Update |
| 2 | Admin | Delete |
| 3 | Superadmin | Full access |

---

## Data Model

### Contact Object (`child_site_contacts`)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | UUID | Auto | Unique identifier (auto-generated) |
| `site_id` | UUID | No | Reference to `main_sites.id` |
| `person_name` | string | **Yes** | Full name of the contact person |
| `nickname` | string | No | Nickname or short name |
| `phone` | string[] | No | Array of phone numbers |
| `email` | string[] | No | Array of email addresses |
| `line_id` | string | No | LINE messenger ID |
| `note` | string | No | Additional notes |
| `created_at` | timestamp | Auto | Creation timestamp |
| `updated_at` | timestamp | Auto | Last update timestamp |

---

## Endpoints

### 1. List Contacts

Retrieves a paginated list of all contacts, optionally filtered by site.

**Endpoint:** `GET /api-contacts` or `GET /api-contacts/list`

**Permission Level:** 0 (All authenticated users)

#### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | 1 | Page number (1-indexed) |
| `limit` | integer | 20 | Items per page |
| `site_id` | UUID | - | Filter by site ID (optional) |

#### Response

```json
{
  "data": {
    "data": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440001",
        "site_id": "550e8400-e29b-41d4-a716-446655440000",
        "person_name": "Somchai Jaidee",
        "nickname": "Chai",
        "phone": ["081-234-5678", "02-123-4567"],
        "email": ["somchai@example.com"],
        "line_id": "somchai_line",
        "note": "Available during business hours",
        "created_at": "2024-01-15T10:30:00Z",
        "updated_at": "2024-01-15T10:30:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 45,
      "totalPages": 3,
      "hasNextPage": true,
      "hasPrevPage": false
    }
  }
}
```

#### Example Request

```bash
# List all contacts (page 1)
curl -X GET "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-contacts?page=1&limit=10" \
  -H "Authorization: Bearer <token>"

# List contacts for a specific site
curl -X GET "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-contacts?site_id=550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer <token>"
```

---

### 2. Get Contact by ID

Retrieves a single contact by its unique identifier.

**Endpoint:** `GET /api-contacts/:id`

**Permission Level:** 0 (All authenticated users)

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Contact ID |

#### Response

```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "site_id": "550e8400-e29b-41d4-a716-446655440000",
    "person_name": "Somchai Jaidee",
    "nickname": "Chai",
    "phone": ["081-234-5678", "02-123-4567"],
    "email": ["somchai@example.com"],
    "line_id": "somchai_line",
    "note": "Available during business hours",
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T10:30:00Z"
  }
}
```

#### Example Request

```bash
curl -X GET "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-contacts/550e8400-e29b-41d4-a716-446655440001" \
  -H "Authorization: Bearer <token>"
```

---

### 3. Get Contacts by Site

Retrieves all contacts associated with a specific site, ordered by creation date (newest first).

**Endpoint:** `GET /api-contacts/site/:siteId`

**Permission Level:** 0 (All authenticated users)

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `siteId` | UUID | Site ID to fetch contacts for |

#### Response

```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "site_id": "550e8400-e29b-41d4-a716-446655440000",
      "person_name": "Somchai Jaidee",
      "nickname": "Chai",
      "phone": ["081-234-5678"],
      "email": ["somchai@example.com"],
      "line_id": "somchai_line",
      "note": null,
      "created_at": "2024-01-15T10:30:00Z",
      "updated_at": "2024-01-15T10:30:00Z"
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440002",
      "site_id": "550e8400-e29b-41d4-a716-446655440000",
      "person_name": "Somying Rakdee",
      "nickname": "Ying",
      "phone": ["089-876-5432"],
      "email": null,
      "line_id": null,
      "note": "Primary coordinator",
      "created_at": "2024-01-10T08:00:00Z",
      "updated_at": "2024-01-10T08:00:00Z"
    }
  ]
}
```

#### Example Request

```bash
curl -X GET "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-contacts/site/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer <token>"
```

---

### 4. Search Contacts

Searches contacts by name or nickname. Returns up to 10 matching results.

**Endpoint:** `GET /api-contacts/search`

**Permission Level:** 0 (All authenticated users)

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `q` | string | Yes | Search query (minimum 2 characters) |
| `site_id` | UUID | No | Limit search to a specific site |

#### Response

```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "site_id": "550e8400-e29b-41d4-a716-446655440000",
      "person_name": "Somchai Jaidee",
      "nickname": "Chai",
      "phone": ["081-234-5678"],
      "email": ["somchai@example.com"],
      "line_id": "somchai_line",
      "note": null,
      "created_at": "2024-01-15T10:30:00Z",
      "updated_at": "2024-01-15T10:30:00Z"
    }
  ]
}
```

#### Search Behavior

- Searches both `person_name` and `nickname` fields
- Case-insensitive partial matching (uses `ILIKE`)
- Minimum query length: 2 characters (returns empty array if shorter)
- Maximum results: 10
- Results ordered alphabetically by `person_name`

#### Example Request

```bash
# Search all contacts
curl -X GET "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-contacts/search?q=somchai" \
  -H "Authorization: Bearer <token>"

# Search within a specific site
curl -X GET "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-contacts/search?q=som&site_id=550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer <token>"
```

---

### 5. Create Contact

Creates a new contact record.

**Endpoint:** `POST /api-contacts`

**Permission Level:** 1 (Assigner, PM, Sales and above)

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `site_id` | UUID | No | Site to associate the contact with |
| `person_name` | string | **Yes** | Full name of the contact |
| `nickname` | string | No | Nickname |
| `phone` | string[] | No | Array of phone numbers |
| `email` | string[] | No | Array of email addresses |
| `line_id` | string | No | LINE messenger ID |
| `note` | string | No | Additional notes |

#### Request Example

```json
{
  "site_id": "550e8400-e29b-41d4-a716-446655440000",
  "person_name": "Somchai Jaidee",
  "nickname": "Chai",
  "phone": ["081-234-5678", "02-123-4567"],
  "email": ["somchai@example.com"],
  "line_id": "somchai_line",
  "note": "Available on business days 9:00-17:00"
}
```

#### Response (HTTP 201 Created)

```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "site_id": "550e8400-e29b-41d4-a716-446655440000",
    "person_name": "Somchai Jaidee",
    "nickname": "Chai",
    "phone": ["081-234-5678", "02-123-4567"],
    "email": ["somchai@example.com"],
    "line_id": "somchai_line",
    "note": "Available on business days 9:00-17:00",
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T10:30:00Z"
  }
}
```

#### Example Request

```bash
curl -X POST "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-contacts" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "site_id": "550e8400-e29b-41d4-a716-446655440000",
    "person_name": "Somchai Jaidee",
    "nickname": "Chai",
    "phone": ["081-234-5678"]
  }'
```

---

### 6. Update Contact

Updates an existing contact record. Only provided fields will be updated.

**Endpoint:** `PUT /api-contacts/:id`

**Permission Level:** 1 (Assigner, PM, Sales and above)

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Contact ID to update |

#### Request Body

All fields are optional. Only include fields you want to update.

| Field | Type | Description |
|-------|------|-------------|
| `site_id` | UUID | Site to associate the contact with |
| `person_name` | string | Full name of the contact |
| `nickname` | string | Nickname |
| `phone` | string[] | Array of phone numbers |
| `email` | string[] | Array of email addresses |
| `line_id` | string | LINE messenger ID |
| `note` | string | Additional notes |

#### Request Example

```json
{
  "nickname": "Big Chai",
  "phone": ["081-234-5678", "089-999-8888"],
  "note": "Primary contact - Available 24/7"
}
```

#### Response

```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "site_id": "550e8400-e29b-41d4-a716-446655440000",
    "person_name": "Somchai Jaidee",
    "nickname": "Big Chai",
    "phone": ["081-234-5678", "089-999-8888"],
    "email": ["somchai@example.com"],
    "line_id": "somchai_line",
    "note": "Primary contact - Available 24/7",
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-16T14:20:00Z"
  }
}
```

#### Example Request

```bash
curl -X PUT "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-contacts/550e8400-e29b-41d4-a716-446655440001" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "nickname": "Big Chai",
    "phone": ["081-234-5678", "089-999-8888"]
  }'
```

---

### 7. Delete Contact

Permanently deletes a contact record.

**Endpoint:** `DELETE /api-contacts/:id`

**Permission Level:** 2 (Admin and above)

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Contact ID to delete |

#### Response

```json
{
  "data": {
    "message": "ลบผู้ติดต่อสำเร็จ"
  }
}
```

#### Example Request

```bash
curl -X DELETE "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-contacts/550e8400-e29b-41d4-a716-446655440001" \
  -H "Authorization: Bearer <token>"
```

---

## Error Responses

All errors return a JSON object with an `error` field containing a Thai language message.

### Common Error Codes

| HTTP Status | Error Type | Description |
|-------------|------------|-------------|
| 400 | ValidationError | Invalid input data |
| 401 | Unauthorized | Missing or invalid JWT token |
| 403 | Forbidden | Insufficient permission level |
| 404 | NotFoundError | Contact not found |
| 500 | DatabaseError | Database operation failed |

### Error Response Format

```json
{
  "error": "Error message in Thai"
}
```

### Example Error Responses

**Validation Error (Missing Required Field)**
```json
{
  "error": "กรุณาระบุ ชื่อผู้ติดต่อ"
}
```

**Not Found Error**
```json
{
  "error": "ไม่พบข้อมูลผู้ติดต่อ"
}
```

**Forbidden Error (Insufficient Permission)**
```json
{
  "error": "ไม่มีสิทธิ์เข้าถึง"
}
```

**Invalid UUID Format**
```json
{
  "error": "Contact ID ไม่ถูกต้อง"
}
```

---

## Usage Notes

### Phone and Email Arrays

The `phone` and `email` fields accept arrays of strings. When sending data:

```json
{
  "phone": ["081-234-5678", "02-123-4567"],
  "email": ["primary@example.com", "secondary@example.com"]
}
```

### Site Association

- Contacts can optionally be associated with a site via `site_id`
- Use `GET /api-contacts/site/:siteId` to efficiently fetch all contacts for a site
- Use `site_id` query parameter with list/search endpoints for filtering

### Pagination

The list endpoint uses page-based pagination:
- Default page size: 20 items
- Results are ordered alphabetically by `person_name`
- Use `page` and `limit` parameters to navigate through results

### Search Limitations

- Minimum search query length: 2 characters
- Maximum results: 10 items
- Searches `person_name` and `nickname` fields only

---

## Related APIs

- **Sites API** (`/api-sites`) - Manage customer sites that contacts belong to
- **Tickets API** (`/api-tickets`) - Work orders that may reference site contacts
- **Companies API** (`/api-companies`) - Company information linked to sites

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.1 | 2026-01-18 | Documentation review and verification |
| 1.0.0 | 2024-01-15 | Initial release |
