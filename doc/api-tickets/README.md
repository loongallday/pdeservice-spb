# Tickets API

## Overview

The Tickets API handles ticket management operations for work orders and service requests. It also provides endpoints for linking merchandise/equipment to tickets.

**Base URL**: `/functions/v1/api-tickets`

**Authentication**: All endpoints require Bearer token authentication.

**Key Features**:
- Ticket CRUD operations
- Merchandise linking (link equipment to tickets)
- Site validation (merchandise must be in the same site as ticket)

---

## 🚀 Master Ticket API (Recommended)

**For creating/updating tickets with all related data in one call**, see the [Master Ticket API Documentation](./MASTER-TICKET-API.md).

The Master Ticket API allows you to:
- ✅ Create ticket with company, site, contact, appointment, merchandise, and employees in **one API call**
- ✅ Update ticket and all related data simultaneously
- ✅ Delete ticket with automatic cleanup
- ✅ Automatic find-or-create for company/site/contact

**Quick Example**:
```json
POST /api-tickets/master
{
  "ticket": { "work_type_id": "...", "assigner_id": "...", "status_id": "..." },
  "company": { "tax_id": "...", "name_th": "..." },
  "site": { "name": "...", "address_detail": "..." },
  "contact": { "person_name": "...", "phone": ["..."] },
  "appointment": { "appointment_date": "2025-11-20", ... },
  "employee_ids": ["...", "..."],
  "merchandise_ids": ["...", "..."]
}
```

[📖 View Master Ticket API Documentation](./MASTER-TICKET-API.md)

---

## Individual Endpoints

The following endpoints operate on individual resources. For comprehensive operations, use the [Master Ticket API](./MASTER-TICKET-API.md) instead.

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

Update an existing ticket. You can update ticket data, employee assignments, and merchandise associations.

**Endpoint**: `PUT /:id`

**Required Level**: 1 (non-technician_l1 and above)

**Path Parameters**:
- `id` (required): Ticket ID (UUID)

**Request Body**:
```json
{
  "ticketData": {
    "description": "Updated description",
    "status_id": "uuid-here"
  },
  "employeeIds": ["employee-uuid-1", "employee-uuid-2"],
  "merchandiseIds": ["merchandise-uuid-1", "merchandise-uuid-2"]
}
```

**Fields**:
- `ticketData` (required): Object containing ticket fields to update
- `employeeIds` (optional): Array of employee IDs to replace all employee assignments
- `merchandiseIds` (optional): Array of merchandise IDs to replace all merchandise associations

**Merchandise Management Scenarios**:

1. **Remove all merchandise**: Send empty array
   ```json
   {
     "ticketData": {...},
     "merchandiseIds": []
   }
   ```

2. **Replace with new list**: Send array with desired merchandise IDs
   ```json
   {
     "ticketData": {...},
     "merchandiseIds": ["merchandise-uuid-1", "merchandise-uuid-3"]
   }
   ```
   - This removes all existing merchandise and links only the ones in the array
   - Example: If ticket had [serial-1, serial-2] and you send [serial-1], it will remove serial-2 and keep serial-1

3. **Keep existing merchandise unchanged**: Omit `merchandiseIds` field
   ```json
   {
     "ticketData": {...}
     // merchandiseIds not included - existing associations remain unchanged
   }
   ```

**Validation**:
- All merchandise in `merchandiseIds` must exist
- All merchandise must be in the same site as the ticket (if ticket has a site)
- Duplicate IDs in the array are automatically deduplicated

**Note**: 
- `employeeIds` and `merchandiseIds` **replace** all existing associations (not append)
- If `merchandiseIds` is provided (even if empty), it replaces all existing merchandise associations
- To keep existing associations unchanged, **omit** the `merchandiseIds` field from the request

---

### Delete Ticket

Delete a ticket.

**Endpoint**: `DELETE /:id`

**Required Level**: 1 (non-technician_l1 and above)

**Path Parameters**:
- `id` (required): Ticket ID (UUID)

---

## Merchandise Management

### List Merchandise for Ticket

Get all merchandise linked to a specific ticket.

**Endpoint**: `GET /:id/merchandise`

**Required Level**: 0 (all authenticated users)

**Path Parameters**:
- `id` (required): Ticket ID (UUID)

**Response** (200 OK):
```json
{
  "data": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "created_at": "2025-11-18T00:00:00Z",
      "merchandise": {
        "id": "123e4567-e89b-12d3-a456-426614174001",
        "serial_no": "SN12345",
        "model_id": "123e4567-e89b-12d3-a456-426614174002",
        "site_id": "123e4567-e89b-12d3-a456-426614174003",
        "pm_count": 10,
        "distributor_id": "1234567890123",
        "dealer_id": "1234567890124",
        "replaced_by_id": null,
        "created_at": "2025-11-17T00:00:00Z",
        "updated_at": "2025-11-17T00:00:00Z",
        "model": {
          "id": "123e4567-e89b-12d3-a456-426614174002",
          "model": "MODEL-001",
          "name": "Model Name",
          "website_url": "https://example.com"
        },
        "site": {
          "id": "123e4567-e89b-12d3-a456-426614174003",
          "name": "Site Name"
        }
      }
    }
  ]
}
```

---

### Add Merchandise to Ticket

Link merchandise to a ticket. The merchandise must be in the same site as the ticket. This operation is **idempotent** - if the merchandise is already linked, it will return the existing association without error.

**Endpoint**: `POST /:id/merchandise`

**Required Level**: 1 (non-technician_l1 and above)

**Path Parameters**:
- `id` (required): Ticket ID (UUID)

**Request Body**:
```json
{
  "merchandise_id": "123e4567-e89b-12d3-a456-426614174001"
}
```

**Required Fields**:
- `merchandise_id`: Merchandise ID (UUID)

**Response** (201 Created for new association, 200 OK if already exists):
```json
{
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174010",
    "created_at": "2025-11-18T00:00:00Z",
    "merchandise": {
      "id": "123e4567-e89b-12d3-a456-426614174001",
      "serial_no": "SN12345",
      "model_id": "123e4567-e89b-12d3-a456-426614174002",
      "site_id": "123e4567-e89b-12d3-a456-426614174003",
      "pm_count": 10,
      "model": {
        "id": "123e4567-e89b-12d3-a456-426614174002",
        "model": "MODEL-001",
        "name": "Model Name",
        "website_url": "https://example.com"
      },
      "site": {
        "id": "123e4567-e89b-12d3-a456-426614174003",
        "name": "Site Name"
      }
    }
  }
}
```

**Validation Rules**:
- Merchandise must exist
- Merchandise must be in the same site as the ticket (if ticket has a site)
- **Idempotent**: If merchandise is already linked, returns existing association (200 OK) instead of error

**Error Responses**:
- `400 Bad Request`: Invalid merchandise_id or validation failed (site mismatch)
- `404 Not Found`: Ticket or merchandise not found

---

### Remove Merchandise from Ticket

Unlink merchandise from a ticket.

**Endpoint**: `DELETE /:id/merchandise/:merchandiseId`

**Required Level**: 1 (non-technician_l1 and above)

**Path Parameters**:
- `id` (required): Ticket ID (UUID)
- `merchandiseId` (required): Merchandise ID (UUID)

**Response** (200 OK):
```json
{
  "data": {
    "message": "ลบการเชื่อมโยงอุปกรณ์สำเร็จ"
  }
}
```

**Error Responses**:
- `404 Not Found`: Ticket or merchandise association not found

---

## Error Responses

Standard error responses apply (400, 401, 403, 404, 500).

---

## Notes

- Tickets are linked to companies, sites, and work types
- Tickets can have appointments and work results associated
- Status changes may trigger workflow actions
- Merchandise linked to tickets must be in the same site as the ticket (enforced at database level)
- Multiple merchandise can be linked to a single ticket
- Merchandise associations are automatically deleted when ticket or merchandise is deleted

