# Todos API Documentation

## Overview

The Todos API provides endpoints for managing todo items and reminders in the Field Service Management system. Todos can be assigned to employees, linked to tickets, and tracked with priorities and deadlines. This API supports creating, reading, updating, deleting, completing, and reopening todos.

**Key Features:**
- Create and assign todos to employees
- Link todos to specific tickets for context
- Set priorities (low, normal, high, urgent)
- Track completion status with timestamps
- Filter and search todos by various criteria
- Automatic deadline-based notifications

---

## Base URL

```
/api-todos
```

---

## Authentication

All endpoints require JWT authentication via Bearer token in the Authorization header:

```
Authorization: Bearer <jwt_token>
```

---

## Authorization Levels

| Level | Role | Capabilities |
|-------|------|--------------|
| 0 | Technician L1 | View own todos (created by or assigned to), complete/reopen own todos |
| 1 | Assigner, PM, Sales, Technician L2 | Create, update, delete own todos |
| 2+ | Admin, Superadmin | Full access to all todos |

**Access Rules:**
- **View**: Level 0-1 users can only view todos they created or are assigned to. Level 2+ can view all todos.
- **Create**: Requires Level 1 or higher.
- **Update/Delete**: Level 0-1 users can only modify todos they created. Level 2+ can modify all todos.
- **Complete/Reopen**: Creator or assignee can complete/reopen. Level 2+ can complete/reopen any todo.

---

## Endpoints

### 1. List Todos

Retrieves a paginated list of todos with optional filters.

**Endpoint:** `GET /api-todos`

**Permission Level:** 0 (Technician L1 or higher)

#### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `page` | integer | No | 1 | Page number (minimum: 1) |
| `limit` | integer | No | 50 | Items per page (1-100) |
| `assignee_id` | UUID | No | - | Filter by assignee employee ID |
| `creator_id` | UUID | No | - | Filter by creator employee ID |
| `is_completed` | boolean | No | - | Filter by completion status (`true` or `false`) |
| `priority` | string | No | - | Filter by priority: `low`, `normal`, `high`, `urgent` |
| `ticket_id` | UUID | No | - | Filter by linked ticket ID |
| `from_date` | ISO datetime | No | - | Filter todos with deadline >= this date |
| `to_date` | ISO datetime | No | - | Filter todos with deadline <= this date |
| `own` | boolean | No | false | If `true`, show only user's own todos (created by or assigned to) |
| `p` | string | No | - | Search term to filter by title or description |

#### Response

```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "title": "Follow up with customer",
      "description": "Call customer to confirm installation date",
      "deadline": "2026-01-20T09:00:00.000Z",
      "ticket_id": "660e8400-e29b-41d4-a716-446655440001",
      "is_completed": false,
      "completed_at": null,
      "notified_at": null,
      "priority": "high",
      "creator": {
        "id": "770e8400-e29b-41d4-a716-446655440002",
        "code": "EMP001",
        "name": "Somchai Jaidee",
        "nickname": "Chai"
      },
      "assignee": {
        "id": "880e8400-e29b-41d4-a716-446655440003",
        "code": "EMP002",
        "name": "Somying Rakthai",
        "nickname": "Ying"
      },
      "ticket": {
        "id": "660e8400-e29b-41d4-a716-446655440001",
        "code": "TKT-2026-001234"
      },
      "created_at": "2026-01-15T08:30:00.000Z",
      "updated_at": "2026-01-15T08:30:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 25,
    "totalPages": 1,
    "hasNext": false,
    "hasPrevious": false
  }
}
```

#### Example Requests

**Get all incomplete todos assigned to a specific employee:**
```
GET /api-todos?assignee_id=880e8400-e29b-41d4-a716-446655440003&is_completed=false
```

**Get high priority todos due this week:**
```
GET /api-todos?priority=high&from_date=2026-01-13&to_date=2026-01-19
```

**Search todos by keyword:**
```
GET /api-todos?p=customer%20callback
```

**Get only my own todos:**
```
GET /api-todos?own=true
```

---

### 2. Get Todo by ID

Retrieves a single todo by its ID.

**Endpoint:** `GET /api-todos/:id`

**Permission Level:** 0 (Technician L1 or higher)

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | UUID | Yes | The todo ID |

#### Response

```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "title": "Follow up with customer",
    "description": "Call customer to confirm installation date",
    "deadline": "2026-01-20T09:00:00.000Z",
    "ticket_id": "660e8400-e29b-41d4-a716-446655440001",
    "is_completed": false,
    "completed_at": null,
    "notified_at": null,
    "priority": "high",
    "creator": {
      "id": "770e8400-e29b-41d4-a716-446655440002",
      "code": "EMP001",
      "name": "Somchai Jaidee",
      "nickname": "Chai"
    },
    "assignee": {
      "id": "880e8400-e29b-41d4-a716-446655440003",
      "code": "EMP002",
      "name": "Somying Rakthai",
      "nickname": "Ying"
    },
    "ticket": {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "code": "TKT-2026-001234"
    },
    "created_at": "2026-01-15T08:30:00.000Z",
    "updated_at": "2026-01-15T08:30:00.000Z"
  }
}
```

#### Example Request

```
GET /api-todos/550e8400-e29b-41d4-a716-446655440000
```

---

### 3. Create Todo

Creates a new todo item.

**Endpoint:** `POST /api-todos`

**Permission Level:** 1 (Assigner, PM, Sales, or higher)

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | Yes | Todo title/subject |
| `description` | string | No | Detailed description |
| `deadline` | ISO datetime | Yes | Due date and time |
| `assignee_id` | UUID | Yes | Employee ID of the assignee |
| `ticket_id` | UUID | No | Optional linked ticket ID |
| `priority` | string | No | Priority level: `low`, `normal` (default), `high`, `urgent` |

#### Request Example

```json
{
  "title": "Follow up with customer",
  "description": "Call customer to confirm installation date",
  "deadline": "2026-01-20T09:00:00.000Z",
  "assignee_id": "880e8400-e29b-41d4-a716-446655440003",
  "ticket_id": "660e8400-e29b-41d4-a716-446655440001",
  "priority": "high"
}
```

#### Response (HTTP 201 Created)

```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "title": "Follow up with customer",
    "description": "Call customer to confirm installation date",
    "deadline": "2026-01-20T09:00:00.000Z",
    "ticket_id": "660e8400-e29b-41d4-a716-446655440001",
    "is_completed": false,
    "completed_at": null,
    "notified_at": null,
    "priority": "high",
    "creator": {
      "id": "770e8400-e29b-41d4-a716-446655440002",
      "code": "EMP001",
      "name": "Somchai Jaidee",
      "nickname": "Chai"
    },
    "assignee": {
      "id": "880e8400-e29b-41d4-a716-446655440003",
      "code": "EMP002",
      "name": "Somying Rakthai",
      "nickname": "Ying"
    },
    "ticket": {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "code": "TKT-2026-001234"
    },
    "created_at": "2026-01-15T08:30:00.000Z",
    "updated_at": "2026-01-15T08:30:00.000Z"
  }
}
```

---

### 4. Update Todo

Updates an existing todo item.

**Endpoint:** `PUT /api-todos/:id`

**Permission Level:** 1 (Assigner, PM, Sales, or higher)

**Note:** Level 0-1 users can only update todos they created. Level 2+ can update any todo.

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | UUID | Yes | The todo ID |

#### Request Body

All fields are optional. Only include fields you want to update.

| Field | Type | Description |
|-------|------|-------------|
| `title` | string | Todo title/subject |
| `description` | string | Detailed description |
| `deadline` | ISO datetime | Due date and time (resets notification status) |
| `assignee_id` | UUID | Employee ID of the assignee |
| `ticket_id` | UUID | Linked ticket ID (set to `null` to remove link) |
| `priority` | string | Priority level: `low`, `normal`, `high`, `urgent` |

#### Request Example

```json
{
  "deadline": "2026-01-22T14:00:00.000Z",
  "priority": "urgent"
}
```

#### Response

```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "title": "Follow up with customer",
    "description": "Call customer to confirm installation date",
    "deadline": "2026-01-22T14:00:00.000Z",
    "ticket_id": "660e8400-e29b-41d4-a716-446655440001",
    "is_completed": false,
    "completed_at": null,
    "notified_at": null,
    "priority": "urgent",
    "creator": {
      "id": "770e8400-e29b-41d4-a716-446655440002",
      "code": "EMP001",
      "name": "Somchai Jaidee",
      "nickname": "Chai"
    },
    "assignee": {
      "id": "880e8400-e29b-41d4-a716-446655440003",
      "code": "EMP002",
      "name": "Somying Rakthai",
      "nickname": "Ying"
    },
    "ticket": {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "code": "TKT-2026-001234"
    },
    "created_at": "2026-01-15T08:30:00.000Z",
    "updated_at": "2026-01-16T10:15:00.000Z"
  }
}
```

---

### 5. Delete Todo

Deletes a todo item permanently.

**Endpoint:** `DELETE /api-todos/:id`

**Permission Level:** 1 (Assigner, PM, Sales, or higher)

**Note:** Level 0-1 users can only delete todos they created. Level 2+ can delete any todo.

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | UUID | Yes | The todo ID |

#### Response

```json
{
  "data": {
    "message": "ลบงานสำเร็จ"
  }
}
```

---

### 6. Complete Todo

Marks a todo as completed.

**Endpoint:** `POST /api-todos/:id/complete` or `PUT /api-todos/:id/complete`

**Permission Level:** 0 (Technician L1 or higher)

**Note:** Only the creator, assignee, or Level 2+ users can complete a todo.

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | UUID | Yes | The todo ID |

#### Response

```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "title": "Follow up with customer",
    "description": "Call customer to confirm installation date",
    "deadline": "2026-01-20T09:00:00.000Z",
    "ticket_id": "660e8400-e29b-41d4-a716-446655440001",
    "is_completed": true,
    "completed_at": "2026-01-18T15:30:00.000Z",
    "notified_at": null,
    "priority": "high",
    "creator": {
      "id": "770e8400-e29b-41d4-a716-446655440002",
      "code": "EMP001",
      "name": "Somchai Jaidee",
      "nickname": "Chai"
    },
    "assignee": {
      "id": "880e8400-e29b-41d4-a716-446655440003",
      "code": "EMP002",
      "name": "Somying Rakthai",
      "nickname": "Ying"
    },
    "ticket": {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "code": "TKT-2026-001234"
    },
    "created_at": "2026-01-15T08:30:00.000Z",
    "updated_at": "2026-01-18T15:30:00.000Z"
  }
}
```

---

### 7. Reopen Todo

Reopens a completed todo, marking it as incomplete.

**Endpoint:** `POST /api-todos/:id/reopen` or `PUT /api-todos/:id/reopen`

**Permission Level:** 0 (Technician L1 or higher)

**Note:** Only the creator, assignee, or Level 2+ users can reopen a todo. Reopening resets the `notified_at` field so the system can send notifications again if the deadline passes.

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | UUID | Yes | The todo ID |

#### Response

```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "title": "Follow up with customer",
    "description": "Call customer to confirm installation date",
    "deadline": "2026-01-20T09:00:00.000Z",
    "ticket_id": "660e8400-e29b-41d4-a716-446655440001",
    "is_completed": false,
    "completed_at": null,
    "notified_at": null,
    "priority": "high",
    "creator": {
      "id": "770e8400-e29b-41d4-a716-446655440002",
      "code": "EMP001",
      "name": "Somchai Jaidee",
      "nickname": "Chai"
    },
    "assignee": {
      "id": "880e8400-e29b-41d4-a716-446655440003",
      "code": "EMP002",
      "name": "Somying Rakthai",
      "nickname": "Ying"
    },
    "ticket": {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "code": "TKT-2026-001234"
    },
    "created_at": "2026-01-15T08:30:00.000Z",
    "updated_at": "2026-01-19T09:00:00.000Z"
  }
}
```

---

## Data Types

### Todo Object

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Unique identifier |
| `title` | string | Todo title/subject |
| `description` | string or null | Detailed description |
| `deadline` | ISO datetime | Due date and time |
| `ticket_id` | UUID or null | Linked ticket ID |
| `is_completed` | boolean | Completion status |
| `completed_at` | ISO datetime or null | When the todo was completed |
| `notified_at` | ISO datetime or null | When the notification was sent |
| `priority` | string | Priority: `low`, `normal`, `high`, `urgent` |
| `creator` | Employee | Employee who created the todo |
| `assignee` | Employee | Employee responsible for the todo |
| `ticket` | Ticket or null | Linked ticket info |
| `created_at` | ISO datetime | Creation timestamp |
| `updated_at` | ISO datetime | Last update timestamp |

### Employee (Embedded)

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Employee ID |
| `code` | string | Employee code (e.g., "EMP001") |
| `name` | string | Full name |
| `nickname` | string or null | Nickname |

### Ticket (Embedded)

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Ticket ID |
| `code` | string | Ticket code (e.g., "TKT-2026-001234") |

### Priority Values

| Value | Description (Thai) |
|-------|-------------------|
| `low` | Low priority |
| `normal` | Normal priority (default) |
| `high` | High priority |
| `urgent` | Urgent priority |

---

## Error Responses

### Authentication Errors (HTTP 401)

```json
{
  "error": "ไม่พบข้อมูลการยืนยันตัวตน"
}
```

```json
{
  "error": "Session หมดอายุกรุณาเข้าใช้งานใหม่"
}
```

### Authorization Errors (HTTP 403)

```json
{
  "error": "ไม่มีสิทธิ์ดูงานนี้"
}
```

```json
{
  "error": "ไม่มีสิทธิ์แก้ไขงานนี้"
}
```

```json
{
  "error": "ไม่มีสิทธิ์ลบงานนี้"
}
```

```json
{
  "error": "ไม่มีสิทธิ์ทำเครื่องหมายงานนี้"
}
```

```json
{
  "error": "ไม่มีสิทธิ์เปิดงานนี้อีกครั้ง"
}
```

```json
{
  "error": "ต้องมีสิทธิ์ระดับ 1 ขึ้นไป"
}
```

### Not Found Errors (HTTP 404)

```json
{
  "error": "ไม่พบงานที่ต้องการ"
}
```

### Validation Errors (HTTP 400)

```json
{
  "error": "กรุณาระบุหัวข้องาน"
}
```

```json
{
  "error": "กรุณาระบุกำหนดเวลา"
}
```

```json
{
  "error": "รูปแบบวันที่ไม่ถูกต้อง"
}
```

```json
{
  "error": "กรุณาระบุผู้รับผิดชอบ"
}
```

```json
{
  "error": "ความสำคัญไม่ถูกต้อง"
}
```

```json
{
  "error": "Todo ID ไม่ถูกต้อง"
}
```

```json
{
  "error": "งานนี้เสร็จสิ้นแล้ว"
}
```

```json
{
  "error": "งานนี้ยังไม่เสร็จสิ้น"
}
```

### Database Errors (HTTP 500)

```json
{
  "error": "ไม่สามารถดึงรายการงานได้: <details>"
}
```

```json
{
  "error": "ไม่สามารถสร้างงานได้: <details>"
}
```

```json
{
  "error": "ไม่สามารถแก้ไขงานได้: <details>"
}
```

```json
{
  "error": "ไม่สามารถลบงานได้: <details>"
}
```

---

## Usage Examples

### Create a Todo for Ticket Follow-up

```bash
curl -X POST "https://your-project.supabase.co/functions/v1/api-todos" \
  -H "Authorization: Bearer <jwt_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Call customer for feedback",
    "description": "Follow up on installation satisfaction",
    "deadline": "2026-01-20T10:00:00.000Z",
    "assignee_id": "880e8400-e29b-41d4-a716-446655440003",
    "ticket_id": "660e8400-e29b-41d4-a716-446655440001",
    "priority": "normal"
  }'
```

### Get My Incomplete Todos

```bash
curl -X GET "https://your-project.supabase.co/functions/v1/api-todos?own=true&is_completed=false" \
  -H "Authorization: Bearer <jwt_token>"
```

### Complete a Todo

```bash
curl -X POST "https://your-project.supabase.co/functions/v1/api-todos/550e8400-e29b-41d4-a716-446655440000/complete" \
  -H "Authorization: Bearer <jwt_token>"
```

### Update Todo Priority

```bash
curl -X PUT "https://your-project.supabase.co/functions/v1/api-todos/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer <jwt_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "priority": "urgent"
  }'
```

---

## Notes for Frontend Developers

1. **Sorting**: The list endpoint returns todos sorted by deadline in ascending order (earliest first).

2. **Deadline Updates**: When updating the deadline, the `notified_at` field is automatically reset to `null`, allowing the notification system to send reminders again.

3. **Reopening Todos**: When a completed todo is reopened, both `completed_at` and `notified_at` are reset to `null`.

4. **Permission Checks**: The API performs permission checks on the server side. Frontend should handle 403 errors gracefully with appropriate user messaging.

5. **Pagination Defaults**: If not specified, `page` defaults to 1 and `limit` defaults to 50. Maximum limit is 100.

6. **Date Format**: All dates should be sent and received in ISO 8601 format (e.g., `2026-01-20T09:00:00.000Z`).

7. **Own Filter**: Use `own=true` to get only the current user's todos regardless of their permission level. This is useful for personal todo dashboards.

8. **Search**: The `p` parameter searches in both `title` and `description` fields using case-insensitive matching.
