# Tickets API

## Overview

The Tickets API handles ticket management operations for work orders and service requests.

**Base URL**: `/functions/v1/api-tickets`

**Authentication**: All endpoints require Bearer token authentication.

---

## Endpoints

### List Tickets

Get a paginated list of all tickets.

**Endpoint**: `GET /`

**Required Level**: 0 (all authenticated users)

**Query Parameters**:
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)

---

### Get Ticket by ID

Get a single ticket by its ID.

**Endpoint**: `GET /:id`

**Required Level**: 0 (all authenticated users)

**Path Parameters**:
- `id` (required): Ticket ID (UUID)

---

### Create Ticket

Create a new ticket.

**Endpoint**: `POST /`

**Required Level**: 1 (non-technician_l1 and above)

**Request Body**:
```json
{
  "company_id": "1234567890123",
  "site_id": "123e4567-e89b-12d3-a456-426614174000",
  "work_type_id": "123e4567-e89b-12d3-a456-426614174001",
  "description": "Ticket description",
  "priority": "normal"
}
```

**Required Fields**:
- `work_type_id`: Work type ID (UUID)
- `status_id`: Ticket status ID (UUID)

---

### Update Ticket

Update an existing ticket.

**Endpoint**: `PUT /:id`

**Required Level**: 1 (non-technician_l1 and above)

**Path Parameters**:
- `id` (required): Ticket ID (UUID)

---

### Delete Ticket

Delete a ticket.

**Endpoint**: `DELETE /:id`

**Required Level**: 1 (non-technician_l1 and above)

**Path Parameters**:
- `id` (required): Ticket ID (UUID)

---

## Error Responses

Standard error responses apply (400, 401, 403, 404, 500).

---

## Notes

- Tickets are linked to companies, sites, and work types
- Tickets can have appointments and work results associated
- Status changes may trigger workflow actions

