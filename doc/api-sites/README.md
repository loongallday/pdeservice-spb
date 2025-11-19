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

### List Sites

Get a paginated list of all sites.

**Endpoint**: `GET /`

**Required Level**: 0 (all authenticated users)

**Query Parameters**:
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)
- `company_id` (optional): Filter by company ID

**Response** (200 OK):
```json
{
  "data": {
    "data": [
      {
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
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 100,
      "totalPages": 5,
      "hasNext": true,
      "hasPrevious": false
    }
  }
}
```

---

### Search Sites

Search sites by name or address.

**Endpoint**: `GET /search`

**Required Level**: 0 (all authenticated users)

**Query Parameters**:
- `q` (required): Search query string
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)

---

### Get Recent Sites

Get recently created sites.

**Endpoint**: `GET /recent`

**Required Level**: 0 (all authenticated users)

**Query Parameters**:
- `limit` (optional): Number of sites to return (default: 5)

---

### Get Site by ID

Get a single site by its ID.

**Endpoint**: `GET /:id`

**Required Level**: 0 (all authenticated users)

**Path Parameters**:
- `id` (required): Site ID (UUID)

**Response** (200 OK):
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
    }
  }
}
```

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
- `company_id`: Company tax ID

**Optional Fields**:
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

### Find or Create Site

Find an existing site or create a new one if not found.

**Endpoint**: `POST /find-or-create`

**Required Level**: 1 (non-technician_l1 and above)

**Request Body**: (Same as Create Site)
```json
{
  "name": "Main Office",
  "company_id": "1234567890123",
  "address_detail": "123 Main Street",
  "safety_standard": ["safety_shoes", "safety_vest"]
}
```

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

