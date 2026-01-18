# API Notifications

## Overview

The Notifications API manages in-app notifications for authenticated users in the Field Service Management system. Notifications are automatically generated for various system events such as ticket approvals, technician confirmations, comments, mentions, fleet movements, and general ticket updates.

This API allows users to:
- Retrieve their notifications with pagination and filtering
- Mark notifications as read (individually or in bulk)

---

## Base URL

```
/api-notifications
```

---

## Authentication

All endpoints require a valid JWT token in the Authorization header (except `/warmup`).

```
Authorization: Bearer <jwt_token>
```

**Required Permission Level:** 0 (Technician L1 or higher)

All authenticated users can access their own notifications. Users can only view and manage notifications where they are the recipient.

---

## Notification Types

| Type | Description (Thai) | Trigger | Recipients |
|------|-------------------|---------|------------|
| `approval` | การนัดหมายถูกอนุมัติ | Appointment approved | Confirmed technicians |
| `unapproval` | การนัดหมายถูกยกเลิก | Appointment unapproved | Confirmed technicians, original approver |
| `technician_confirmed` | คุณถูกยืนยันสำหรับงาน | Technician assigned and confirmed | The confirmed technician |
| `new_comment` | มีความคิดเห็นใหม่ | New comment on a ticket | Previous commenters |
| `mention` | คุณถูกกล่าวถึงในความคิดเห็น | User @mentioned in a comment | Mentioned users |
| `ticket_update` | ตั๋วงานมีการเปลี่ยนแปลง | General ticket updates | Ticket watchers |
| `approval_request` | มีตั๋วงานใหม่รอการอนุมัติ | New ticket pending approval | Approvers |
| `fleet_departure` | พนักงานออกเดินทาง | Vehicle leaves garage/office | Superadmins (level 3) |
| `fleet_arrival` | พนักงานถึงออฟฟิศ | Vehicle arrives at garage/office | Superadmins (level 3) |

---

## Endpoints Summary

| Method | Path | Description | Auth Required |
|--------|------|-------------|---------------|
| GET | `/` | List notifications for current user | Yes |
| PUT/PATCH | `/read` | Mark notifications as read | Yes |
| GET | `/warmup` | Keep function warm | No |

---

## Endpoints

### 1. Get Notifications

Retrieve a paginated list of notifications for the authenticated user.

**Request**

```
GET /api-notifications
```

**Query Parameters**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `page` | integer | No | 1 | Page number (minimum: 1) |
| `limit` | integer | No | 20 | Items per page (1-100) |
| `unread_only` | boolean | No | false | Filter to show only unread notifications |
| `search` | string | No | - | Search text in notification title and message |

**Response**

```json
{
  "data": [
    {
      "id": "uuid",
      "recipient_id": "uuid",
      "type": "approval",
      "title": "การนัดหมายถูกอนุมัติ",
      "message": "นัดหมายสำหรับ บริษัท ABC ได้รับการอนุมัติแล้ว",
      "ticket_id": "uuid",
      "comment_id": null,
      "audit_id": "uuid",
      "actor_id": "uuid",
      "is_read": false,
      "read_at": null,
      "metadata": {
        "audit_action": "approved"
      },
      "created_at": "2024-01-15T10:30:00Z",
      "actor": {
        "id": "uuid",
        "name": "สมชาย ใจดี",
        "nickname": "ชาย"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "totalPages": 3,
    "hasNext": true,
    "hasPrevious": false
  },
  "unread_count": 12
}
```

**Response Fields**

| Field | Type | Description |
|-------|------|-------------|
| `data` | array | List of notification objects |
| `pagination` | object | Pagination metadata |
| `unread_count` | integer | Total unread notifications (regardless of filters) |

**Notification Object Fields**

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `id` | uuid | No | Unique notification identifier |
| `recipient_id` | uuid | No | User who receives this notification |
| `type` | string | No | Notification type (see types table above) |
| `title` | string | No | Notification title (Thai) |
| `message` | string | No | Notification message (Thai) |
| `ticket_id` | uuid | Yes | Related ticket ID |
| `comment_id` | uuid | Yes | Related comment ID (for comment notifications) |
| `audit_id` | uuid | Yes | Related audit log entry ID |
| `actor_id` | uuid | Yes | User who triggered the notification |
| `is_read` | boolean | No | Whether notification has been read |
| `read_at` | timestamp | Yes | When notification was marked as read |
| `metadata` | object | Yes | Additional context data |
| `created_at` | timestamp | No | Notification creation time |
| `actor` | object | Yes | Actor employee details |

**Example Request**

```bash
# Get all notifications (first page)
curl -X GET "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-notifications" \
  -H "Authorization: Bearer <token>"

# Get unread notifications only
curl -X GET "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-notifications?unread_only=true" \
  -H "Authorization: Bearer <token>"

# Search notifications with pagination
curl -X GET "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-notifications?search=อนุมัติ&page=2&limit=10" \
  -H "Authorization: Bearer <token>"
```

---

### 2. Mark Notifications as Read

Mark one or more notifications as read. Can mark specific notifications or all unread notifications at once.

**Request**

```
PUT /api-notifications/read
```

or

```
PATCH /api-notifications/read
```

**Request Body**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `notification_ids` | string[] | No | Array of notification UUIDs to mark as read. If omitted, marks ALL unread notifications as read. |

**Request Body Examples**

Mark specific notifications:
```json
{
  "notification_ids": [
    "550e8400-e29b-41d4-a716-446655440000",
    "550e8400-e29b-41d4-a716-446655440001"
  ]
}
```

Mark all notifications as read:
```json
{}
```

**Response**

```json
{
  "data": {
    "updated_count": 5
  }
}
```

**Response Fields**

| Field | Type | Description |
|-------|------|-------------|
| `updated_count` | integer | Number of notifications marked as read |

**Example Request**

```bash
# Mark specific notifications as read
curl -X PUT "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-notifications/read" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"notification_ids": ["550e8400-e29b-41d4-a716-446655440000"]}'

# Mark all unread notifications as read
curl -X PUT "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-notifications/read" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{}'
```

---

### 3. Warmup (Health Check)

Keep the Edge Function warm. This endpoint does not require authentication and is intended for health checks or scheduled warmup calls.

**Request**

```
GET /api-notifications/warmup
```

**Response**

```json
{
  "status": "warm",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**Example Request**

```bash
curl -X GET "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-notifications/warmup"
```

---

## Error Responses

All errors follow the standard API error format:

```json
{
  "error": "Error message in Thai",
  "code": "ERROR_CODE"
}
```

### Common Errors

| HTTP Status | Error Message | Description |
|-------------|---------------|-------------|
| 401 | ไม่มีสิทธิ์เข้าถึง | Missing or invalid authentication token |
| 404 | ไม่พบ endpoint ที่ระบุ | Invalid endpoint path |
| 400 | ข้อมูลที่ส่งมาไม่ถูกต้อง | Invalid request body format |
| 500 | ไม่สามารถดึงการแจ้งเตือนได้ | Database error fetching notifications |
| 500 | ไม่สามารถอัพเดทการแจ้งเตือนได้ | Database error updating notifications |

---

## Usage Notes

### Frontend Integration

1. **Badge Display**: Use the `unread_count` field from the GET response to display notification badges. This count is always the total unread count regardless of search/filter parameters.

2. **Polling Strategy**: Consider polling the notifications endpoint periodically or implementing real-time updates to keep the notification badge current.

3. **Mark as Read Flow**:
   - When user opens notification panel: optionally mark visible notifications as read
   - When user clicks a notification: mark that specific notification as read
   - "Mark all as read" button: send empty `notification_ids` array

4. **Search Feature**: The search parameter filters both `title` and `message` fields using case-insensitive partial matching.

### Notification Metadata

The `metadata` field contains additional context that varies by notification type:

| Type | Metadata Fields |
|------|-----------------|
| `ticket_update` | `audit_action` - the specific action that triggered the update |
| `technician_confirmed` | `appointment_date` - the scheduled appointment date |
| `unapproval` | `auto_unapproved` - boolean indicating if unapproval was automatic due to ticket edit |
| `fleet_departure` | `vehicle_id`, `vehicle_name`, `plate_number`, `garage_id`, `garage_name`, `employee_ids`, `employee_names`, `event_type`, `timestamp` |
| `fleet_arrival` | `vehicle_id`, `vehicle_name`, `plate_number`, `garage_id`, `garage_name`, `employee_ids`, `employee_names`, `event_type`, `timestamp` |

**Fleet Notification Metadata Example:**

```json
{
  "vehicle_id": "uuid",
  "vehicle_name": "Toyota Hilux 001",
  "plate_number": "กข-1234",
  "garage_id": "uuid",
  "garage_name": "สำนักงานใหญ่",
  "employee_ids": ["uuid1", "uuid2"],
  "employee_names": ["สมชาย ใจดี", "สมหญิง รักงาน"],
  "event_type": "departure",
  "timestamp": "2024-01-15T08:30:00+07:00"
}
```

---

## Related Endpoints

- **Tickets API** (`/api-tickets`) - Ticket operations that trigger notifications
- **Appointments API** (`/api-appointments`) - Appointment approvals trigger approval notifications
- **Comments** - Adding comments triggers `new_comment` and `mention` notifications
- **Fleet API** (`/api-fleet`) - Vehicle status changes trigger fleet notifications

---

## Database Table

Notifications are stored in the `main_notifications` table:

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| recipient_id | uuid | FK to main_employees |
| type | text | Notification type |
| title | text | Notification title |
| message | text | Notification message |
| ticket_id | uuid | FK to main_tickets (nullable) |
| comment_id | uuid | FK to child_ticket_comments (nullable) |
| audit_id | uuid | FK to child_ticket_audit (nullable) |
| actor_id | uuid | FK to main_employees (nullable) |
| is_read | boolean | Read status |
| read_at | timestamptz | Read timestamp |
| metadata | jsonb | Additional data |
| created_at | timestamptz | Creation timestamp |
