# Sites API

## Overview

The Sites API handles site/location management operations for company locations. Sites can have safety standards configured to specify required safety equipment.

**Base URL**: `/functions/v1/api-sites`

**Authentication**: All endpoints require Bearer token authentication.

**Key Features**:
- Site CRUD operations
- Safety standards management (safety_shoes, safety_vest, safety_helmet, training)
- Company and contact linking

---

## Endpoints

### Global Search Sites

Search sites by name or address with pagination.

**Endpoint**: `GET /global-search`

**Required Level**: 0 (all authenticated users)

**Query Parameters**:
- `q` (optional): Search query string
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)
- `company_id` (optional): Filter by company ID

**Example Request**:
```http
GET /functions/v1/api-sites/global-search?q=Main&page=1&limit=20
Authorization: Bearer <token>
```

**Example Response**:
```json
{
    "data": [
      {
        "id": "123e4567-e89b-12d3-a456-426614174000",
        "name": "Main Office",
      "description": "123 Main Street",
        "company_id": "1234567890123",
      "company_name": "บริษัทตัวอย่าง",
      "is_main_branch": true
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
    "total": 15,
    "totalPages": 1,
    "hasNext": false,
      "hasPrevious": false
  }
}
```

**Response Fields**:
- `id`: Site ID (UUID)
- `name`: Site name
- `description`: Site address detail (nullable)
- `company_id`: Company tax ID (nullable)
- `company_name`: Company name (Thai name preferred, falls back to English name, nullable)
- `is_main_branch`: Boolean indicating if this is the main branch (default: false)

---

### Get Site Hints

Get up to 5 site hints. If query is empty, returns 5 sites ordered by name. If query is provided, searches and returns matching sites.

**Endpoint**: `GET /hint`

**Required Level**: 0 (all authenticated users)

**Query Parameters**:
- `q` (optional): Search query string. If empty, returns 5 sites ordered by name.
- `company_id` (optional): Filter by company ID

**Example Request** (with query):
```http
GET /functions/v1/api-sites/hint?q=Main
Authorization: Bearer <token>
```

**Example Request** (empty query - returns 5 sites):
```http
GET /functions/v1/api-sites/hint
Authorization: Bearer <token>
```

**Example Response**:
```json
{
  "data": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "name": "Main Office",
      "description": "123 Main Street",
      "company_id": "1234567890123",
      "company_name": "บริษัทตัวอย่าง",
      "is_main_branch": true
    },
    ...
  ]
}
```

**Note**: Always returns up to 5 sites maximum.

---

### Get Site by ID

Get a single site by its ID.

**Endpoint**: `GET /:id`

**Required Level**: 0 (all authenticated users)

**Path Parameters**:
- `id` (required): Site ID (UUID)

**Example Request**:
```http
GET /functions/v1/api-sites/123e4567-e89b-12d3-a456-426614174000
Authorization: Bearer <token>
```

**Example Response**:
```json
{
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "name": "Main Office",
    "company_id": "1234567890123",
    "address_detail": "123 Main Street",
    "subdistrict_code": 10101,
    "district_code": 101,
    "province_code": 10,
    "postal_code": 10100,
    "map_url": "https://maps.google.com/...",
    "contact_ids": ["123e4567-e89b-12d3-a456-426614174001"],
    "is_main_branch": true,
    "safety_standard": ["safety_shoes", "safety_vest", "safety_helmet"],
    "company": {
      "tax_id": "1234567890123",
      "name_th": "บริษัทตัวอย่าง",
      "name_en": "Example Company"
    },
    "tickets": [
      {
        "id": "123e4567-e89b-12d3-a456-426614174002",
        "description": "Fix air conditioning unit",
        "worktype": "PM"
      },
      {
        "id": "123e4567-e89b-12d3-a456-426614174003",
        "description": "Install new equipment",
        "worktype": "Sales"
      }
    ],
    "merchandise": [
      {
        "id": "123e4567-e89b-12d3-a456-426614174004",
        "model": "AC-2024",
        "serial": "SN123456789"
      },
      {
        "id": "123e4567-e89b-12d3-a456-426614174005",
        "model": "HVAC-5000",
        "serial": "SN987654321"
      }
    ],
    "contacts": [
      {
        "id": "123e4567-e89b-12d3-a456-426614174001",
        "contact_name": "John Doe"
      },
      {
        "id": "123e4567-e89b-12d3-a456-426614174006",
        "contact_name": "Jane Smith"
      }
    ]
  }
}
```

**Response Fields**:
- All site fields (id, name, address_detail, etc.)
- `company`: Company information (tax_id, name_th, name_en)
- `tickets`: Array of tickets linked to this site, each containing:
  - `id`: Ticket ID (UUID)
  - `description`: Ticket description/details
  - `worktype`: Work type name
- `merchandise`: Array of merchandise at this site, each containing:
  - `id`: Merchandise ID (UUID)
  - `model`: Model identifier
  - `serial`: Serial number
- `contacts`: Array of contacts linked to this site, each containing:
  - `id`: Contact ID (UUID)
  - `contact_name`: Contact person name

---

### Create Site

Create a new site.

**Endpoint**: `POST /`

**Required Level**: 1 (non-technician_l1 and above)

**Request Body**:
```json
{
  "name": "Main Office",
  "company_id": "1234567890123",
  "address_detail": "123 Main Street",
  "safety_standard": ["safety_shoes", "safety_vest", "safety_helmet"]
}
```

**Required Fields**:
- `name`: Site name
- `subdistrict_code`: Subdistrict code (รหัสตำบล)
- `district_code`: District code (รหัสอำเภอ)
- `province_code`: Province code (รหัสจังหวัด)
- `postal_code`: Postal code (รหัสไปรษณีย์)

**Optional Fields**:
- `company_id`: Company tax ID
- `address_detail`: Detailed address
- `subdistrict_code`: Subdistrict code (integer)
- `district_code`: District code (integer)
- `province_code`: Province code (integer)
- `postal_code`: Postal code (integer)
- `map_url`: Google Maps URL
- `contact_ids`: Array of contact IDs (UUID[])
- `is_main_branch`: Boolean indicating if this is the main branch
- `safety_standard`: Array of required safety standards. Valid values:
  - `safety_shoes`: Safety shoes required
  - `safety_vest`: Safety vest required
  - `safety_helmet`: Safety helmet required
  - `training`: Safety training required

---

### Create or Replace Site

Create a new site or replace an existing one if the site ID is provided. If site with given ID exists, it will be completely replaced. If site doesn't exist, a new one will be created.

**Endpoint**: `POST /create-or-replace`

**Required Level**: 1 (non-technician_l1 and above)

**Request Body**:
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "name": "Main Office",
  "company_id": "1234567890123",
  "address_detail": "123 Main Street",
  "subdistrict_code": 10101,
  "district_code": 101,
  "province_code": 10,
  "postal_code": 10100,
  "safety_standard": ["safety_shoes", "safety_vest", "safety_helmet"]
}
```

**Required Fields**:
- `id`: Site ID (UUID) - required for create or replace
- `name`: Site name
- `subdistrict_code`: Subdistrict code (รหัสตำบล)
- `district_code`: District code (รหัสอำเภอ)
- `province_code`: Province code (รหัสจังหวัด)
- `postal_code`: Postal code (รหัสไปรษณีย์)

**Optional Fields**:
- `company_id`: Company tax ID
- `address_detail`: Detailed address
- `map_url`: Google Maps URL
- `contact_ids`: Array of contact IDs (UUID[])
- `is_main_branch`: Boolean indicating if this is the main branch
- `safety_standard`: Array of required safety standards

**Behavior**:
- **If site with `id` exists**: Completely replaces the existing site with new data
- **If site with `id` doesn't exist**: Creates a new site with the provided ID

---

### Update Site

Update an existing site.

**Endpoint**: `PUT /:id`

**Required Level**: 1 (non-technician_l1 and above)

**Path Parameters**:
- `id` (required): Site ID (UUID)

**Request Body**:
```json
{
  "name": "Updated Site Name",
  "address_detail": "Updated Address",
  "safety_standard": ["safety_shoes", "safety_vest", "safety_helmet", "training"]
}
```

**Note**: All fields are optional. Only provided fields will be updated. To clear `safety_standard`, send `null` or an empty array `[]`.

---

### Delete Site

Delete a site.

**Endpoint**: `DELETE /:id`

**Required Level**: 1 (non-technician_l1 and above)

**Path Parameters**:
- `id` (required): Site ID (UUID)

**Example Request**:
```http
DELETE /functions/v1/api-sites/123e4567-e89b-12d3-a456-426614174000
Authorization: Bearer <token>
```

**Example Response**:
```json
{
  "data": {
    "message": "ลบสถานที่สำเร็จ"
  }
}
```

---

## Error Responses

Standard error responses apply (400, 401, 403, 404, 500).

---

## Notes

- Sites are linked to companies via `company_id`
- Sites can have multiple contacts
- Sites are used in ticket creation
- `safety_standard` is an optional array field that specifies required safety equipment/standards for the site
- Multiple safety standards can be assigned to a single site
- Global search returns only summary fields (id, name, description, company_id) for better performance
- Hint endpoint always returns up to 5 sites maximum
