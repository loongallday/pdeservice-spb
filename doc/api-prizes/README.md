# Prizes API

## Overview

The Prizes API handles prize management operations for lottery system including prize creation, assignment, and winner tracking.

**Base URL**: `/functions/v1/api-prizes`

**Authentication**: All endpoints require Bearer token authentication.

**Key Features**:
- Prize CRUD operations
- Prize assignment to users
- Winner tracking and management
- Prize lottery system integration

---

## Endpoints

### List Prizes

Get a paginated list of all prizes.

**Endpoint**: `GET /`

**Required Level**: 0 (all authenticated users)

**Query Parameters**:
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)

**Example Request**:
```http
GET /functions/v1/api-prizes?page=1&limit=20
Authorization: Bearer <token>
```

**Response** (200 OK):
```json
{
  "data": {
    "data": [
      {
        "id": "123e4567-e89b-12d3-a456-426614174000",
        "name": "iPhone 15 Pro",
        "image_url": "https://example.com/iphone15pro.jpg",
        "created_at": "2025-12-01T00:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 1,
      "totalPages": 1,
      "hasNext": false,
      "hasPrevious": false
    }
  }
}
```

---

### Get Prize by ID

Get a single prize by its ID.

**Endpoint**: `GET /:id`

**Required Level**: 0 (all authenticated users)

**Path Parameters**:
- `id` (required): Prize ID (UUID)

**Example Request**:
```http
GET /functions/v1/api-prizes/123e4567-e89b-12d3-a456-426614174000
Authorization: Bearer <token>
```

**Response** (200 OK):
```json
{
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "name": "iPhone 15 Pro",
    "image_url": "https://example.com/iphone15pro.jpg",
    "created_at": "2025-12-01T00:00:00Z"
  }
}
```

---

### Create Prize

Create a new prize.

**Endpoint**: `POST /`

**Required Level**: 2 (management level and above)

**Request Body**:
```json
{
  "name": "iPhone 15 Pro",
  "image_url": "https://example.com/iphone15pro.jpg"
}
```

**Required Fields**:
- `name`: Prize name (string)

**Optional Fields**:
- `image_url`: Prize image URL (string)

**Example Request**:
```http
POST /functions/v1/api-prizes
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "iPhone 15 Pro",
  "image_url": "https://example.com/iphone15pro.jpg"
}
```

**Response** (201 Created):
```json
{
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "name": "iPhone 15 Pro",
    "image_url": "https://example.com/iphone15pro.jpg",
    "created_at": "2025-12-01T00:00:00Z"
  }
}
```

---

### Update Prize

Update an existing prize.

**Endpoint**: `PUT /:id`

**Required Level**: 2 (management level and above)

**Path Parameters**:
- `id` (required): Prize ID (UUID)

**Request Body**:
```json
{
  "name": "iPhone 16 Pro",
  "image_url": "https://example.com/iphone16pro.jpg"
}
```

**Example Request**:
```http
PUT /functions/v1/api-prizes/123e4567-e89b-12d3-a456-426614174000
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "iPhone 16 Pro",
  "image_url": "https://example.com/iphone16pro.jpg"
}
```

**Response** (200 OK):
```json
{
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "name": "iPhone 16 Pro",
    "image_url": "https://example.com/iphone16pro.jpg",
    "created_at": "2025-12-01T00:00:00Z"
  }
}
```

---

### Delete Prize

Delete a prize.

**Endpoint**: `DELETE /:id`

**Required Level**: 2 (management level and above)

**Path Parameters**:
- `id` (required): Prize ID (UUID)

**Example Request**:
```http
DELETE /functions/v1/api-prizes/123e4567-e89b-12d3-a456-426614174000
Authorization: Bearer <token>
```

**Response** (200 OK):
```json
{
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "name": "iPhone 15 Pro",
    "image_url": "https://example.com/iphone15pro.jpg",
    "created_at": "2025-12-01T00:00:00Z"
  }
}
```

---

## Prize Assignment Management

### List Winners

Get a paginated list of all prize winners (prize assignments).

**Endpoint**: `GET /winners`

**Required Level**: 0 (all authenticated users)

**Query Parameters**:
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)

**Example Request**:
```http
GET /functions/v1/api-prizes/winners?page=1&limit=20
Authorization: Bearer <token>
```

**Response** (200 OK):
```json
{
  "data": {
    "data": [
      {
        "id": "123e4567-e89b-12d3-a456-426614174001",
        "prize_id": "123e4567-e89b-12d3-a456-426614174000",
        "user_id": "123e4567-e89b-12d3-a456-426614174002",
        "assigned_at": "2025-12-01T10:00:00Z",
        "prize": {
          "id": "123e4567-e89b-12d3-a456-426614174000",
          "name": "iPhone 15 Pro",
          "image_url": "https://example.com/iphone15pro.jpg"
        },
        "user": {
          "id": "123e4567-e89b-12d3-a456-426614174002",
          "name": "John Doe"
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 1,
      "totalPages": 1,
      "hasNext": false,
      "hasPrevious": false
    }
  }
}
```

---

### Assign Prize

Assign a prize to a user (create a winner record).

**Endpoint**: `POST /:prizeId/assign`

**Required Level**: 2 (management level and above)

**Path Parameters**:
- `prizeId` (required): Prize ID (UUID)

**Request Body**:
```json
{
  "user_id": "123e4567-e89b-12d3-a456-426614174002"
}
```

**Required Fields**:
- `user_id`: User ID to assign the prize to (UUID)

**Example Request**:
```http
POST /functions/v1/api-prizes/123e4567-e89b-12d3-a456-426614174000/assign
Authorization: Bearer <token>
Content-Type: application/json

{
  "user_id": "123e4567-e89b-12d3-a456-426614174002"
}
```

**Response** (201 Created):
```json
{
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174001",
    "prize_id": "123e4567-e89b-12d3-a456-426614174000",
    "user_id": "123e4567-e89b-12d3-a456-426614174002",
    "assigned_at": "2025-12-01T10:00:00Z",
    "prize": {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "name": "iPhone 15 Pro",
      "image_url": "https://example.com/iphone15pro.jpg"
    },
    "user": {
      "id": "123e4567-e89b-12d3-a456-426614174002",
      "name": "John Doe"
    }
  }
}
```

---

### Unassign Prize

Unassign a prize from a user (remove winner record).

**Endpoint**: `DELETE /:prizeId/unassign/:userId`

**Required Level**: 2 (management level and above)

**Path Parameters**:
- `prizeId` (required): Prize ID (UUID)
- `userId` (required): User ID (UUID)

**Example Request**:
```http
DELETE /functions/v1/api-prizes/123e4567-e89b-12d3-a456-426614174000/unassign/123e4567-e89b-12d3-a456-426614174002
Authorization: Bearer <token>
```

**Response** (200 OK):
```json
{
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174001",
    "prize_id": "123e4567-e89b-12d3-a456-426614174000",
    "user_id": "123e4567-e89b-12d3-a456-426614174002",
    "assigned_at": "2025-12-01T10:00:00Z",
    "prize": {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "name": "iPhone 15 Pro",
      "image_url": "https://example.com/iphone15pro.jpg"
    },
    "user": {
      "id": "123e4567-e89b-12d3-a456-426614174002",
      "name": "John Doe"
    }
  }
}
```

---

## Authorization Levels

| Level | Description | Operations |
|-------|-------------|------------|
| 0 | All authenticated users | List prizes, Get prize, List winners |
| 2 | Management level | Create/Update/Delete prizes, Assign/Unassign prizes |

---

## Error Responses

### 400 Bad Request
```json
{
  "error": "จำเป็นต้องระบุ ชื่อรางวัล"
}
```

### 401 Unauthorized
```json
{
  "error": "ไม่ได้รับอนุญาต"
}
```

### 403 Forbidden
```json
{
  "error": "ต้องมีสิทธิ์ระดับ 2"
}
```

### 404 Not Found
```json
{
  "error": "ไม่พบข้อมูลที่ระบุ"
}
```

---

## Data Models

### Prize
```typescript
interface Prize {
  id: string;           // UUID
  name: string;         // Prize name
  image_url?: string;   // Prize image URL (optional)
  created_at: string;   // ISO timestamp
}
```

### Prize Assignment (Winner)
```typescript
interface PrizeAssignment {
  id: string;           // UUID
  prize_id: string;     // Prize ID (UUID)
  user_id: string;      // User ID (UUID)
  assigned_at: string;  // ISO timestamp
  prize: Prize;         // Prize details
  user: {
    id: string;         // User ID
    name: string;       // User name
  };
}
```

### Pagination
```typescript
interface Pagination {
  page: number;         // Current page number
  limit: number;        // Items per page
  total: number;        // Total number of items
  totalPages: number;   // Total number of pages
  hasNext: boolean;     // Whether there's a next page
  hasPrevious: boolean; // Whether there's a previous page
}
```
