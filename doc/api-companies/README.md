# Companies API

## Overview

The Companies API handles company management operations including CRUD, search, and find-or-create functionality.

**Base URL**: `/functions/v1/api-companies`

**Authentication**: All endpoints require Bearer token authentication.

---

## Endpoints

### List Companies

Get a paginated list of all companies.

**Endpoint**: `GET /`

**Required Level**: 0 (all authenticated users)

**Query Parameters**:
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)

---

### Search Companies

Search companies by name (Thai or English).

**Endpoint**: `GET /search`

**Required Level**: 0 (all authenticated users)

**Query Parameters**:
- `q` (required): Search query string
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)

**Example Request**:
```http
GET /functions/v1/api-companies/search?q=บริษัท&page=1&limit=20
Authorization: Bearer <token>
```

---

### Get Recent Companies

Get recently created companies.

**Endpoint**: `GET /recent`

**Required Level**: 0 (all authenticated users)

**Query Parameters**:
- `limit` (optional): Number of companies to return (default: 5)

---

### Get Company by Tax ID

Get a single company by its tax ID.

**Endpoint**: `GET /:taxId`

**Required Level**: 0 (all authenticated users)

**Path Parameters**:
- `taxId` (required): Company tax ID (string)

**Note**: Tax ID is used as the primary key, not UUID.

---

### Create Company

Create a new company.

**Endpoint**: `POST /`

**Required Level**: 1 (non-technician_l1 and above)

**Request Body**:
```json
{
  "tax_id": "1234567890123",
  "name_th": "บริษัท ทดสอบ จำกัด",
  "name_en": "Test Company Ltd."
}
```

**Required Fields**:
- `tax_id`: Company tax ID (unique)
- `name_th`: Company name in Thai

---

### Find or Create Company

Find an existing company or create a new one if not found.

**Endpoint**: `POST /find-or-create`

**Required Level**: 1 (non-technician_l1 and above)

**Request Body**:
```json
{
  "tax_id": "1234567890123",
  "name_th": "บริษัท ทดสอบ จำกัด",
  "name_en": "Test Company Ltd."
}
```

**Response**:
- Returns existing company if found by `tax_id`
- Creates new company if not found

---

### Update Company

Update an existing company.

**Endpoint**: `PUT /:taxId`

**Required Level**: 1 (non-technician_l1 and above)

**Path Parameters**:
- `taxId` (required): Company tax ID

---

### Delete Company

Delete a company.

**Endpoint**: `DELETE /:taxId`

**Required Level**: 1 (non-technician_l1 and above)

**Path Parameters**:
- `taxId` (required): Company tax ID

---

## Error Responses

Standard error responses apply (400, 401, 403, 404, 500).

---

## Notes

- Tax ID is the primary identifier (not UUID)
- Tax ID must be unique
- Search is case-insensitive and searches both Thai and English names

