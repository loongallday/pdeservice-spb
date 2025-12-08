# Employee-Site Trainings API

## Overview

Manages training records linking employees to sites (who is trained for which site).

**Base URL**: `/functions/v1/api-employee-site-trainings`

**Authentication**: Bearer token required.

---

## Endpoints

### List Trainings

Get paginated training records with optional filters.

**Endpoint**: `GET /`

**Required Level**: 0

**Query Parameters**:
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)
- `employee_id` (optional): Filter by employee UUID
- `site_id` (optional): Filter by site UUID

---

### Get Training by ID

**Endpoint**: `GET /:id`

**Required Level**: 0

**Path Parameters**:
- `id` (required): Training record ID (UUID)

---

### Create Training

Create a training record for an employee and site.

**Endpoint**: `POST /`

**Required Level**: 1

**Request Body**:
```json
{
  "employee_id": "uuid",
  "site_id": "uuid",
  "trained_at": "2025-12-08"
}
```

**Required Fields**:
- `employee_id`
- `site_id`

**Notes**:
- `trained_at` defaults to the current date if omitted.
- Duplicate employee-site pairs are not allowed.

---

### Update Training

Update training details (e.g., trained_at).

**Endpoint**: `PUT /:id`

**Required Level**: 1

**Path Parameters**:
- `id` (required): Training record ID (UUID)

---

## Error Responses

Standard error responses apply (400, 401, 403, 404, 409, 500).

---

## Notes

- Uses `employee_site_trainings` table.
- Enforces unique employee-site pairs.

