# Leave Requests API

## Overview

The Leave Requests API handles leave request management including creation, approval, rejection, and cancellation.

**Base URL**: `/functions/v1/api-leave-requests`

**Authentication**: All endpoints require Bearer token authentication.

---

## Endpoints

### List Leave Requests

Get a paginated list of all leave requests.

**Endpoint**: `GET /`

**Required Level**: 0 (all authenticated users)

**Query Parameters**:
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)

---

### Get Leave Request by ID

Get a single leave request by its ID.

**Endpoint**: `GET /:id`

**Required Level**: 0 (all authenticated users)

**Path Parameters**:
- `id` (required): Leave request ID (UUID)

---

### Create Leave Request

Create a new leave request.

**Endpoint**: `POST /`

**Required Level**: 0 (all authenticated users)

**Request Body**:
```json
{
  "leave_type_id": "123e4567-e89b-12d3-a456-426614174000",
  "start_date": "2025-01-15",
  "end_date": "2025-01-16",
  "reason": "Personal reasons"
}
```

**Required Fields**:
- `leave_type_id`: Leave type ID (UUID)
- `start_date`: Start date (YYYY-MM-DD)
- `end_date`: End date (YYYY-MM-DD)
- `reason`: Reason for leave

---

### Update Leave Request

Update an existing leave request (only if pending).

**Endpoint**: `PUT /:id`

**Required Level**: 0 (all authenticated users)

**Path Parameters**:
- `id` (required): Leave request ID (UUID)

---

### Approve Leave Request

Approve a pending leave request.

**Endpoint**: `POST /:id/approve`

**Required Level**: 2 (admin and above)

**Path Parameters**:
- `id` (required): Leave request ID (UUID)

**Request Body**:
```json
{
  "notes": "Approved"
}
```

---

### Reject Leave Request

Reject a pending leave request.

**Endpoint**: `POST /:id/reject`

**Required Level**: 2 (admin and above)

**Path Parameters**:
- `id` (required): Leave request ID (UUID)

**Request Body**:
```json
{
  "notes": "Rejected due to insufficient leave balance"
}
```

---

### Cancel Leave Request

Cancel a leave request (by requester or admin).

**Endpoint**: `POST /:id/cancel`

**Required Level**: 0 (all authenticated users)

**Path Parameters**:
- `id` (required): Leave request ID (UUID)

**Note**: Users can only cancel their own requests unless they are admin (level 2+).

---

### Delete Leave Request

Delete a leave request.

**Endpoint**: `DELETE /:id`

**Required Level**: 2 (admin and above)

**Path Parameters**:
- `id` (required): Leave request ID (UUID)

---

## Leave Request Statuses

- `pending`: Awaiting approval
- `approved`: Approved by admin
- `rejected`: Rejected by admin
- `cancelled`: Cancelled by requester or admin

---

## Error Responses

Standard error responses apply (400, 401, 403, 404, 500).

---

## Notes

- Leave requests are automatically linked to the authenticated employee
- Only pending requests can be updated
- Approval/rejection requires admin level (2+)
- Leave balance is checked when creating requests

