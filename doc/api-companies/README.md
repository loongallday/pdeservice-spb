# Companies API

## Overview

The Companies API handles company management operations including CRUD, search, and create-or-update functionality.

**Base URL**: `/functions/v1/api-companies`

**Authentication**: All endpoints require Bearer token authentication.

---

## Endpoints

### Global Search Companies

Search companies by name (Thai or English) or tax ID with pagination.

**Endpoint**: `GET /global-search`

**Required Level**: 0 (all authenticated users)

**Query Parameters**:
- `q` (optional): Search query string
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)

**Example Request**:
```http
GET /functions/v1/api-companies/global-search?q=บริษัท&page=1&limit=20
Authorization: Bearer <token>
```

**Example Response**:
```json
{
  "data": [
    {
      "tax_id": "1234567890123",
      "name_th": "บริษัท ทดสอบ จำกัด",
      "name_en": "Test Company Ltd.",
      "description": "123 ถนนสุขุมวิท"
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
- `tax_id`: Company tax ID
- `name_th`: Company name in Thai
- `name_en`: Company name in English (nullable)
- `description`: Company address detail (nullable)

---

### Get Company Hints

Get up to 5 company hints. If query is empty, returns 5 most recent companies. If query is provided, searches and returns matching companies.

**Endpoint**: `GET /hint`

**Required Level**: 0 (all authenticated users)

**Query Parameters**:
- `q` (optional): Search query string. If empty, returns 5 most recent companies.

**Example Request** (with query):
```http
GET /functions/v1/api-companies/hint?q=บริษัท
Authorization: Bearer <token>
```

**Example Request** (empty query - returns recent):
```http
GET /functions/v1/api-companies/hint
Authorization: Bearer <token>
```

**Example Response**:
```json
{
  "data": [
    {
      "tax_id": "1234567890123",
      "name_th": "บริษัท ทดสอบ จำกัด",
      "name_en": "Test Company Ltd.",
      ...
    },
    ...
  ]
}
```

**Note**: Always returns up to 5 companies maximum.

---

### Get Company by ID

Get a single company by its ID (tax_id).

**Endpoint**: `GET /:id`

**Required Level**: 0 (all authenticated users)

**Path Parameters**:
- `id` (required): Company tax ID (string)

**Note**: The ID parameter is the company's tax_id, which is used as the primary key (not UUID).

**Example Request**:
```http
GET /functions/v1/api-companies/1234567890123
Authorization: Bearer <token>
```

**Example Response**:
```json
{
  "data": {
    "tax_id": "1234567890123",
    "name_th": "บริษัท ทดสอบ จำกัด",
    "name_en": "Test Company Ltd.",
    "main-site": {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "name": "สำนักงานใหญ่"
    },
    "sites": [
      {
        "id": "123e4567-e89b-12d3-a456-426614174001",
        "name": "สาขา 1"
      },
      {
        "id": "123e4567-e89b-12d3-a456-426614174002",
        "name": "สาขา 2"
      }
    ],
    ...
  }
}
```

**Response Fields**:
- All company fields (tax_id, name_th, name_en, etc.)
- `main-site`: Main branch site object (nullable), containing:
  - `id`: Site ID (UUID)
  - `name`: Site name
- `sites`: Array of non-main branch sites linked to this company, each containing:
  - `id`: Site ID (UUID)
  - `name`: Site name

---

### Create Company

Create a new company or update an existing one if the same `tax_id` already exists. **Note**: When a company is created or updated, a main branch site is automatically created or updated with the same address information.

**Endpoint**: `POST /`

**Required Level**: 1 (non-technician_l1 and above)

**Request Body**:
```json
{
  "tax_id": "1234567890123",
  "name_th": "บริษัท ทดสอบ จำกัด",
  "name_en": "Test Company Ltd.",
  "address_detail": "123 ถนนสุขุมวิท",
  "address_tambon_code": "10101",
  "address_district_code": "1001",
  "address_province_code": "10"
}
```

**Required Fields**:
- `tax_id`: Company tax ID (unique, used as primary key)
- `name_th`: Company name in Thai
- `address_tambon_code`: Subdistrict code (รหัสตำบล)
- `address_district_code`: District code (รหัสอำเภอ)
- `address_province_code`: Province code (รหัสจังหวัด)

**Behavior**:
- **If `tax_id` doesn't exist**: Creates a new company record
- **If `tax_id` already exists**: Replaces/updates the existing company record with new data

**Automatic Main Branch Site Management**:
- **New Company**: A main branch site is automatically created with:
  - Name: `สำนักงานใหญ่ (company name)`
  - `is_main_branch = true`
  - Same address information as the company:
    - `address_detail` or `address_full` → site `address_detail`
    - `address_tambon_code` → site `subdistrict_code`
    - `address_district_code` → site `district_code`
    - `address_province_code` → site `province_code`
  - Linked to the company via `company_id` (tax_id)

- **Existing Company (Update)**: The existing main branch site (`is_main_branch = true`) is updated with:
  - Updated name: `สำนักงานใหญ่ (company name)`
  - Updated address information from the company
  - No duplicate sites are created

---

### Create or Update Company

Create a new company or update an existing one if found by tax_id. If company exists, it will be updated. If not found, a new company will be created. Main branch site is automatically managed.

**Endpoint**: `POST /create-or-update`

**Required Level**: 1 (non-technician_l1 and above)

**Request Body**:
```json
{
  "tax_id": "1234567890123",
  "name_th": "บริษัท ทดสอบ จำกัด",
  "name_en": "Test Company Ltd.",
  "address_detail": "123 ถนนสุขุมวิท",
  "address_tambon_code": "10101",
  "address_district_code": "1001",
  "address_province_code": "10"
}
```

**Required Fields**:
- `tax_id`: Company tax ID (unique, used as primary key)
- `name_th`: Company name in Thai
- `address_tambon_code`: Subdistrict code (รหัสตำบล)
- `address_district_code`: District code (รหัสอำเภอ)
- `address_province_code`: Province code (รหัสจังหวัด)

**Response**:
- Returns existing company if found by `tax_id` (updated)
- Creates new company if not found
- Main branch site is automatically created or updated

**Difference from Create**:
- `POST /` uses upsert behavior (always updates if tax_id exists)
- `POST /create-or-update` checks if company exists first, then updates or creates accordingly

---

### Update Company

Update an existing company. The ID parameter is the company's tax_id. Main branch site is automatically updated.

**Endpoint**: `PUT /:id`

**Required Level**: 1 (non-technician_l1 and above)

**Path Parameters**:
- `id` (required): Company tax ID

**Request Body**:
```json
{
  "name_th": "บริษัท ทดสอบ จำกัด (อัพเดท)",
  "name_en": "Test Company Ltd. (Updated)",
  "address_detail": "456 ถนนเพชรบุรี"
}
```

**Note**: The ID parameter is the company's tax_id. Main branch site is automatically updated with new address information.

---

### Delete Company

Delete a company. The ID parameter is the company's tax_id.

**Endpoint**: `DELETE /:id`

**Required Level**: 1 (non-technician_l1 and above)

**Path Parameters**:
- `id` (required): Company tax ID

**Example Request**:
```http
DELETE /functions/v1/api-companies/1234567890123
Authorization: Bearer <token>
```

**Example Response**:
```json
{
  "data": {
    "message": "ลบบริษัทสำเร็จ"
  }
}
```

---

## Error Responses

Standard error responses apply (400, 401, 403, 404, 500).

---

## Notes

- **Tax ID as Primary Key**: Tax ID is the primary identifier (not UUID)
- **Tax ID Uniqueness**: Tax ID must be unique
- **Upsert Behavior**: Creating a company with an existing `tax_id` will replace/update the existing company record
- **Main Branch Site**: Each company has one main branch site (`is_main_branch = true`) that is automatically managed:
  - Created when company is first created
  - Updated when company is updated (same `tax_id`)
  - Contains the company's head office address information
- **Search**: Global search is case-insensitive and searches both Thai and English names, as well as tax_id
- **Hints**: The hint endpoint always returns up to 5 companies maximum
- **ID Parameter**: All endpoints that use `:id` parameter actually use the company's tax_id as the identifier
