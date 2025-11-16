# Contacts API

## Overview

The Contacts API handles contact information management for sites.

**Base URL**: `/functions/v1/api-contacts`

**Authentication**: All endpoints require Bearer token authentication.

---

## Endpoints

### List Contacts

Get a paginated list of all contacts.

**Endpoint**: `GET /` or `GET /list`

**Required Level**: 0 (all authenticated users)

**Query Parameters**:
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)

---

### Search Contacts

Search contacts by name, phone, or email.

**Endpoint**: `GET /search`

**Required Level**: 0 (all authenticated users)

**Query Parameters**:
- `q` (required): Search query string
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)

---

### Get Contacts by Site

Get all contacts for a specific site.

**Endpoint**: `GET /site/:siteId`

**Required Level**: 0 (all authenticated users)

**Path Parameters**:
- `siteId` (required): Site ID (UUID)

---

### Get Contact by ID

Get a single contact by its ID.

**Endpoint**: `GET /:id`

**Required Level**: 0 (all authenticated users)

**Path Parameters**:
- `id` (required): Contact ID (UUID)

**Note**: Must be a valid UUID format.

---

### Create Contact

Create a new contact.

**Endpoint**: `POST /`

**Required Level**: 1 (non-technician_l1 and above)

**Request Body**:
```json
{
  "site_id": "123e4567-e89b-12d3-a456-426614174000",
  "person_name": "John Doe",
  "phone": "0812345678",
  "email": "john@example.com"
}
```

**Required Fields**:
- `site_id`: Site ID (UUID)
- `person_name`: Contact person name

---

### Update Contact

Update an existing contact.

**Endpoint**: `PUT /:id`

**Required Level**: 1 (non-technician_l1 and above)

---

### Delete Contact

Delete a contact.

**Endpoint**: `DELETE /:id`

**Required Level**: 1 (non-technician_l1 and above)

---

## Error Responses

Standard error responses apply (400, 401, 403, 404, 500).

---

## Notes

- Contacts are linked to sites
- Contacts are used in ticket creation
- Phone and email are optional fields

