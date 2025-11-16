# Sites API

## Overview

The Sites API handles site/location management operations for company locations.

**Base URL**: `/functions/v1/api-sites`

**Authentication**: All endpoints require Bearer token authentication.

---

## Endpoints

### List Sites

Get a paginated list of all sites.

**Endpoint**: `GET /`

**Required Level**: 0 (all authenticated users)

**Query Parameters**:
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)

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
  "address_detail": "123 Main Street"
}
```

**Required Fields**:
- `name`: Site name
- `company_id`: Company tax ID

---

### Find or Create Site

Find an existing site or create a new one if not found.

**Endpoint**: `POST /find-or-create`

**Required Level**: 1 (non-technician_l1 and above)

---

### Update Site

Update an existing site.

**Endpoint**: `PUT /:id`

**Required Level**: 1 (non-technician_l1 and above)

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

