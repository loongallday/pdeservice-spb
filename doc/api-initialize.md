# API Initialize Documentation

## Overview

The **Initialize API** provides essential endpoints for application bootstrapping and user session management. This API is designed to be called when a user first opens the application or needs to refresh their session data.

The API returns:
- Current user information with role and department details
- Reference constants (work types, statuses, roles, departments, work givers)
- Feature flags based on user permissions
- Appointment approval capabilities
- External links (quotation URL)

**Base URL:** `/api-initialize`

---

## Authentication

Most endpoints require a valid JWT token in the Authorization header:

```
Authorization: Bearer <jwt_token>
```

The token must be a valid Supabase Auth JWT. If authentication fails, appropriate error responses will be returned.

**Exception:** The `/warmup` endpoint does not require authentication.

---

## Endpoints

### 1. Get Current User Information

Retrieves the authenticated user's complete profile including role, department, approval permissions, and all reference constants for optimized app bootstrap. This endpoint combines multiple API calls into a single request.

| Property | Value |
|----------|-------|
| **Method** | `GET` |
| **Path** | `/api-initialize/me` |
| **Permission Level** | 0+ (All authenticated users) |

#### Request

No request body or query parameters required.

**Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

#### Response

**Success (200 OK):**

```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Somchai Jaidee",
    "code": "EMP001",
    "email": "somchai@company.com",
    "role_id": "d290f1ee-6c54-4b01-90e6-d701748f0851",
    "auth_user_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "is_active": true,
    "phone": "0812345678",
    "profile_image_url": "https://storage.example.com/profiles/somchai.jpg",
    "created_at": "2024-01-15T08:00:00.000Z",
    "updated_at": "2024-01-20T10:30:00.000Z",
    "role_data": {
      "id": "d290f1ee-6c54-4b01-90e6-d701748f0851",
      "code": "technician",
      "name_th": "ช่างเทคนิค",
      "name_en": "Technician",
      "description": "Field service technician",
      "level": 1,
      "department_id": "c3d4e5f6-7890-1234-abcd-567890abcdef",
      "is_active": true,
      "requires_auth": true,
      "can_approve": false,
      "department": {
        "id": "c3d4e5f6-7890-1234-abcd-567890abcdef",
        "code": "service",
        "name_th": "ฝ่ายบริการ",
        "name_en": "Service Department",
        "description": "Field service operations",
        "is_active": true
      }
    },
    "constants": {
      "work_types": [
        {
          "id": 1,
          "code": "pm",
          "name": "PM",
          "description": "Preventive Maintenance"
        }
      ],
      "ticket_statuses": [
        {
          "id": 1,
          "code": "open",
          "name": "Open",
          "description": "Ticket is open"
        }
      ],
      "roles": [
        {
          "id": "d290f1ee-6c54-4b01-90e6-d701748f0851",
          "code": "technician",
          "name_th": "ช่างเทคนิค",
          "name_en": "Technician",
          "level": 1,
          "is_active": true
        }
      ],
      "departments": [
        {
          "id": "c3d4e5f6-7890-1234-abcd-567890abcdef",
          "code": "service",
          "name_th": "ฝ่ายบริการ",
          "name_en": "Service Department",
          "is_active": true
        }
      ],
      "work_givers": [
        {
          "id": 1,
          "code": "internal",
          "name": "Internal",
          "is_active": true
        }
      ]
    },
    "quotation_url": "https://parchment-pen.lovable.app"
  }
}
```

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Employee unique identifier |
| `name` | string | Full name of the employee |
| `code` | string | Employee code (e.g., EMP001) |
| `email` | string | Email address |
| `role_id` | UUID | Reference to the employee's role |
| `auth_user_id` | UUID | Supabase Auth user ID |
| `is_active` | boolean | Whether the employee is active |
| `role_data` | object | Detailed role information |
| `role_data.level` | number | Permission level (0-3) |
| `role_data.can_approve` | boolean | Whether user can approve appointments (based on `jct_appointment_approvers` table) |
| `role_data.department` | object | Department the role belongs to |
| `constants` | object | Reference data for the application |
| `constants.work_types` | array | All ticket work types from `ref_ticket_work_types` |
| `constants.ticket_statuses` | array | All ticket statuses from `ref_ticket_statuses` |
| `constants.roles` | array | Active roles from `main_org_roles` |
| `constants.departments` | array | Active departments from `main_org_departments` |
| `constants.work_givers` | array | Active work givers from `ref_work_givers` |
| `quotation_url` | string | External URL for quotation system |

---

### 2. Get Enabled Features

Retrieves all features available to the authenticated user based on their role level and role type.

| Property | Value |
|----------|-------|
| **Method** | `GET` |
| **Path** | `/api-initialize/features` |
| **Permission Level** | 0+ (All authenticated users) |

#### Request

No request body or query parameters required.

**Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

#### Response

**Success (200 OK):**

```json
{
  "data": [
    {
      "id": 1,
      "code": "ticket_view",
      "name_th": "ดูรายการใบงาน",
      "name_en": "View Tickets",
      "description": "View and search service tickets",
      "is_active": true,
      "allowed_roles": null
    },
    {
      "id": 2,
      "code": "ticket_create",
      "name_th": "สร้างใบงาน",
      "name_en": "Create Tickets",
      "description": "Create new service tickets",
      "is_active": true,
      "allowed_roles": ["assigner", "pm_l1", "pm_l2", "admin"]
    },
    {
      "id": 3,
      "code": "appointment_approval",
      "name_th": "อนุมัตินัดหมาย",
      "name_en": "Approve Appointments",
      "description": "Approve or reject appointment requests",
      "is_active": true,
      "allowed_roles": ["pm_l1", "pm_l2", "admin"]
    }
  ]
}
```

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | number | Feature ID |
| `code` | string | Unique feature code for frontend use |
| `name_th` | string | Feature name in Thai |
| `name_en` | string | Feature name in English |
| `description` | string | Feature description |
| `is_active` | boolean | Whether the feature is enabled |
| `allowed_roles` | string[] \| null | Roles that can access this feature (null = all roles) |

#### Feature Filtering Logic

Features are filtered based on:

1. **Active Status**: Only features with `is_active = true` are returned
2. **Minimum Level**: User's role level must be >= feature's `min_level` (this field is hidden from the response for security)
3. **Allowed Roles**: If `allowed_roles` is specified, user's role code must be in the list

---

### 3. Warmup (Keep Function Warm)

Pings the function to keep it warm and reduce cold start latency. This endpoint does not require authentication and is designed to be called by a scheduled cron job.

| Property | Value |
|----------|-------|
| **Method** | `GET` |
| **Path** | `/api-initialize/warmup` |
| **Permission Level** | None (Public endpoint) |

#### Request

No request body, query parameters, or authentication required.

#### Response

**Success (200 OK):**

```json
{
  "status": "warm",
  "timestamp": "2024-01-20T10:30:00.000Z"
}
```

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `status` | string | Always returns "warm" |
| `timestamp` | string | ISO 8601 timestamp of when the request was processed |

---

## Error Responses

### Authentication Errors

**401 Unauthorized - Missing Token:**
```json
{
  "error": "ไม่พบข้อมูลการยืนยันตัวตน"
}
```
*Translation: Authentication information not found*

**401 Unauthorized - Invalid/Expired Token:**
```json
{
  "error": "Session หมดอายุกรุณาเข้าใช้งานใหม่"
}
```
*Translation: Session expired, please log in again*

**401 Unauthorized - Employee Not Found:**
```json
{
  "error": "ไม่พบข้อมูลพนักงาน"
}
```
*Translation: Employee information not found*

### Authorization Errors

**403 Forbidden - Insufficient Permission:**
```json
{
  "error": "ต้องมีสิทธิ์ระดับ 1 ขึ้นไป"
}
```
*Translation: Requires permission level 1 or higher*

### Server Errors

**500 Internal Server Error - Database Error:**
```json
{
  "error": "ไม่สามารถดึงข้อมูลพนักงานได้"
}
```
*Translation: Unable to retrieve employee information*

```json
{
  "error": "ไม่สามารถดึงข้อมูลฟีเจอร์ได้"
}
```
*Translation: Unable to retrieve feature information*

### Not Found

**404 Not Found - Invalid Endpoint:**
```json
{
  "error": "Not found"
}
```

---

## Permission Levels Reference

| Level | Role Examples | Capabilities |
|-------|---------------|--------------|
| 0 | technician_l1 | Read-only access |
| 1 | assigner, pm_l1, pm_l2, sale_l1, technician | Create and update operations |
| 2 | admin | User management |
| 3 | superadmin | Full system access |

---

## Usage Examples

### cURL Examples

**Get Current User Info:**
```bash
curl -X GET "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-initialize/me" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json"
```

**Get Enabled Features:**
```bash
curl -X GET "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-initialize/features" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json"
```

**Warmup (Keep Function Warm):**
```bash
curl -X GET "https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-initialize/warmup"
```

### JavaScript/TypeScript Example

```typescript
// Initialize service for frontend applications
class InitializeService {
  private baseUrl: string;
  private token: string;

  constructor(baseUrl: string, token: string) {
    this.baseUrl = baseUrl;
    this.token = token;
  }

  private async request(endpoint: string) {
    const response = await fetch(`${this.baseUrl}/api-initialize${endpoint}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Request failed');
    }

    return response.json();
  }

  // Get current user information
  async getMe() {
    const result = await this.request('/me');
    return result.data;
  }

  // Get enabled features for current user
  async getFeatures() {
    const result = await this.request('/features');
    return result.data;
  }

  // Initialize app with all required data
  async initializeApp() {
    const [user, features] = await Promise.all([
      this.getMe(),
      this.getFeatures(),
    ]);

    return {
      user,
      features,
      constants: user.constants, // Reference data included in /me response
      quotationUrl: user.quotation_url,
      canApprove: user.role_data?.can_approve ?? false,
    };
  }
}

// Usage
const service = new InitializeService(
  'https://ogzyihacqbasolfxymgo.supabase.co/functions/v1',
  authToken
);

try {
  const { user, features, constants, quotationUrl, canApprove } = await service.initializeApp();
  console.log('User:', user.name);
  console.log('Available features:', features.map(f => f.code));
  console.log('Work types:', constants.work_types.length);
  console.log('Quotation URL:', quotationUrl);
  console.log('Can approve appointments:', canApprove);
} catch (error) {
  console.error('Initialization failed:', error.message);
}
```

---

## Best Practices for Frontend Integration

### 1. Call on App Start
Call `/me` and `/features` endpoints when the application initializes after user login. The `/me` endpoint now includes all reference constants, reducing the number of API calls needed.

### 2. Store in Global State
Store the user info, features, and constants in your application's global state (e.g., Redux, Zustand, Context API).

### 3. Use Constants from /me Response
The `/me` endpoint includes reference data (work types, statuses, roles, departments, work givers) to reduce additional API calls:

```typescript
const { constants } = user;
// Use constants.work_types, constants.ticket_statuses, etc.
```

### 4. Feature Flag Usage
Use the features array to conditionally render UI elements:

```typescript
const hasFeature = (featureCode: string): boolean => {
  return features.some(f => f.code === featureCode);
};

// In component
{hasFeature('ticket_create') && <CreateTicketButton />}
```

### 5. Handle Session Expiry
If you receive a 401 error with session expired message, redirect the user to the login page.

### 6. Check Approval Permission
Use the `can_approve` field from role_data to show/hide appointment approval UI:

```typescript
{user.role_data?.can_approve && <ApprovalDashboard />}
```

### 7. Cold Start Optimization
The `/warmup` endpoint can be called by a scheduled cron job to keep the function warm and reduce latency for users.

---

## Related APIs

- **api-employees** - Employee management
- **api-reference-data** - Reference data (roles, departments)
- **api-appointments** - Appointment management
- **api-features** - Feature management

---

## Changelog

| Date | Change |
|------|--------|
| 2026-01-18 | Added constants to /me response, added /warmup endpoint, updated documentation |
| 2024-01-15 | Initial documentation |
