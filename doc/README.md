# PDE Service API Documentation

Complete API documentation for all PDE Service Edge Functions.

## Overview

PDE Service is a Supabase-based edge function API service for managing enterprise operations. All APIs follow RESTful conventions and require Bearer token authentication.

**Base URL Pattern**: `/functions/v1/api-{resource}`

**Authentication**: All endpoints require `Authorization: Bearer <token>` header.

---

## API Endpoints

### Core APIs

- **[Initialize API](./api-initialize/README.md)** - Get all initial app data (employee, roles, departments, features)
- **[Employees API](./api-employees/README.md)** - Employee management and auth linking
- **[Features API](./api-features/README.md)** - Feature flags and menu items
- **[Roles API](./api-roles/README.md)** - Role management and permissions
- **[Departments API](./api-departments/README.md)** - Department/organizational unit management

### Business Operations

- **[Tickets API](./api-tickets/README.md)** - Ticket/work order management (includes merchandise linking)
- **[Appointments API](./api-appointments/README.md)** - Appointment scheduling
- **[Work Results API](./api-work-results/README.md)** - Work result documentation with photos and documents
- **[Leave Requests API](./api-leave-requests/README.md)** - Leave request management and approvals

### Company & Location Management

- **[Companies API](./api-companies/README.md)** - Company records management
- **[Sites API](./api-sites/README.md)** - Site/location management (includes safety standards)
- **[Contacts API](./api-contacts/README.md)** - Contact information management
- **[Employee-Site Trainings API](./api-employee-site-trainings/README.md)** - Track employee training readiness per site

### Equipment & Maintenance

- **[Merchandise API](./api-merchandise/README.md)** - Equipment/merchandise management
- **[Models API](./api-models/README.md)** - Equipment model catalog
- **[PM Log API](./api-pmlog/README.md)** - Preventive maintenance log entries
- **[PM Summary API](./api-pm-summary/README.md)** - PM summary and warranty tracking

### Additional Features

- **[Polls API](./api-polls/README.md)** - Poll creation and voting
- **[Reference Data API](./api-reference-data/README.md)** - Static reference data (work types, statuses, leave types, provinces)
- **[Announcements API](./api-announcements/README.md)** - Publish announcement messages

---

## Authentication

All APIs require authentication via Bearer token:

```http
Authorization: Bearer <your-jwt-token>
```

Tokens are obtained through Supabase Auth:
```http
POST /auth/v1/token?grant_type=password
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password"
}
```

---

## Authorization Levels

APIs use role-based access control with levels 0-10:

- **Level 0**: Basic read access (all authenticated users)
- **Level 1**: Create/update operations (non-technician_l1)
- **Level 2**: Admin operations
- **Level 3+**: Super admin operations

Each endpoint documents its required level.

---

## Common Response Formats

### Success Response
```json
{
  "data": {
    // Response data
  }
}
```

### Paginated Response
```json
{
  "data": {
    "data": [...],
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

### Error Response
```json
{
  "error": "Error message in Thai"
}
```

---

## Common HTTP Status Codes

- **200 OK**: Successful request
- **201 Created**: Resource created successfully
- **400 Bad Request**: Validation error or invalid input
- **401 Unauthorized**: Missing or invalid authentication
- **403 Forbidden**: Insufficient permissions
- **404 Not Found**: Resource not found
- **405 Method Not Allowed**: HTTP method not supported
- **409 Conflict**: Duplicate data or constraint violation
- **500 Internal Server Error**: Server error

---

## Error Messages

All error messages are in Thai language for user-facing responses.

---

## Pagination

List endpoints support pagination via query parameters:

- `page`: Page number (default: 1, 1-indexed)
- `limit`: Items per page (default: 20)

Example:
```http
GET /functions/v1/api-employees?page=2&limit=50
```

---

## UUID Format

Most resource IDs use UUID format:
```
123e4567-e89b-12d3-a456-426614174000
```

Some resources use other identifiers:
- Companies: Tax ID (string)
- Employees: Employee code (string) or UUID

---

## CORS

All APIs support CORS and handle preflight OPTIONS requests automatically.

---

## Rate Limiting

Rate limiting may apply. Check response headers for rate limit information.

---

## Testing

Use the [Postman Collection](../postman/) for testing all APIs locally.

---

## Quick Start

1. **Authenticate**: Get a JWT token via Supabase Auth
2. **Initialize**: Call `/api-initialize` to get all bootstrap data
3. **Use APIs**: Make requests to specific endpoints as needed

---

## Support

For issues or questions, refer to individual API documentation or check the project README.

