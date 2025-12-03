# Departments API

## Overview

The Departments API handles department/organizational unit management.

**Base URL**: `/functions/v1/api-departments`

**Authentication**: All endpoints require Bearer token authentication.

---

## Endpoints

### List Departments

Get a list of all departments.

**Endpoint**: `GET /`

**Required Level**: 0 (all authenticated users)

**Example Request**:
```http
GET /functions/v1/api-departments
Authorization: Bearer <token>
```

**Example Response**:
```json
{
  "data": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "code": "IT",
      "name_th": "แผนกเทคโนโลยี",
      "name_en": "IT Department",
      "description": "Information Technology",
      "is_active": true
    }
  ]
}
```

---

### Search Departments

Search for departments by code or name.

**Endpoint**: `GET /search`

**Required Level**: 0 (all authenticated users)

**Query Parameters**:
- `q` (required): Search query string (1+ characters)

**Example Request**:
```http
GET /functions/v1/api-departments/search?q=IT
Authorization: Bearer <token>
```

**Example Response**:
```json
{
  "data": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "code": "IT",
      "name_th": "แผนกเทคโนโลยีสารสนเทศ",
      "name_en": "Information Technology",
      "description": "IT and Software Development",
      "is_active": true,
      "head_id": null,
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

**Searchable Fields**:
- `code` - Department code (partial match)
- `name_th` - Thai name (partial match)
- `name_en` - English name (partial match)

**Notes**:
- Search is case-insensitive
- Returns up to 20 results
- Results are sorted by code
- Empty query returns empty array
- Partial matches are supported

---

### Create Department

Create a new department.

**Endpoint**: `POST /`

**Required Level**: 3 (Superadmin only)

**Request Body**:
```json
{
  "code": "SALES",
  "name_th": "ฝ่ายขาย",
  "name_en": "Sales Department",
  "description": "Sales and marketing",
  "is_active": true
}
```

**Required Fields**:
- `code`: Department code (unique)
- `name_th`: Department name in Thai

---

### Update Department

Update an existing department.

**Endpoint**: `PUT /:id`

**Required Level**: 3 (Superadmin only)

**Path Parameters**:
- `id` (required): Department ID (UUID)

**Request Body**:
```json
{
  "name_th": "แผนกเทคโนโลยี (อัพเดท)",
  "name_en": "IT Department (Updated)",
  "description": "Updated description",
  "is_active": true
}
```

**Note**: All fields are optional. Only provided fields will be updated.

---

### Delete Department

Delete a department.

**Endpoint**: `DELETE /:id`

**Required Level**: 3 (Superadmin only)

**Path Parameters**:
- `id` (required): Department ID (UUID)

---

## Error Responses

Standard error responses apply (400, 401, 403, 404, 500).

---

## Notes

- Department codes must be unique
- Departments can have a head (manager) assigned
- Departments are linked to roles

