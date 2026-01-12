# Ticket Rating API - Frontend Integration Guide

## Overview

ระบบให้คะแนนตั๋วงาน สำหรับพนักงานโทรสอบถามความพึงพอใจจากลูกค้าหลังจบงาน

## Rating Categories

| Field | Description | Scale |
|-------|-------------|-------|
| `serviceQualityRating` | คุณภาพบริการ | 1-5 |
| `responseTimeRating` | ความรวดเร็ว | 1-5 |
| `professionalismRating` | ความเป็นมืออาชีพ | 1-5 |

## API Endpoints

### Base URL
```
/api-tickets/{ticketId}/rating
```

---

### 1. GET Rating

ดึงข้อมูลคะแนนของตั๋วงาน

```http
GET /api-tickets/{ticketId}/rating
Authorization: Bearer {token}
```

**Response (มีคะแนน):**
```json
{
  "data": {
    "rating": {
      "id": "uuid",
      "ticketId": "uuid",
      "serviceQualityRating": 5,
      "responseTimeRating": 4,
      "professionalismRating": 5,
      "averageRating": 4.67,
      "customerComment": "บริการดีมาก",
      "callNotes": "ลูกค้าชมช่างว่าทำงานรวดเร็ว",
      "ratedAt": "2026-01-12T10:30:00.000Z",
      "ratedBy": {
        "id": "uuid",
        "code": "EMP001",
        "name": "สมชาย ใจดี",
        "nickname": "ชาย"
      },
      "createdAt": "2026-01-12T10:30:00.000Z",
      "updatedAt": "2026-01-12T10:30:00.000Z"
    },
    "hasRating": true
  }
}
```

**Response (ยังไม่มีคะแนน):**
```json
{
  "data": {
    "rating": null,
    "hasRating": false
  }
}
```

---

### 2. POST Create Rating

บันทึกคะแนนใหม่ (ใช้ครั้งแรก)

```http
POST /api-tickets/{ticketId}/rating
Authorization: Bearer {token}
Content-Type: application/json
```

**Request Body:**
```json
{
  "serviceQualityRating": 5,
  "responseTimeRating": 4,
  "professionalismRating": 5,
  "customerComment": "บริการดีมาก ช่างมาตรงเวลา",
  "callNotes": "โทรติดตามวันที่ 12 ม.ค. ลูกค้าพอใจมาก"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `serviceQualityRating` | number | ✅ | 1-5 |
| `responseTimeRating` | number | ✅ | 1-5 |
| `professionalismRating` | number | ✅ | 1-5 |
| `customerComment` | string | ❌ | ความคิดเห็นจากลูกค้า |
| `callNotes` | string | ❌ | บันทึกภายในจากพนักงานที่โทร |

**Response (201 Created):**
```json
{
  "data": {
    "rating": {
      "id": "uuid",
      "ticketId": "uuid",
      "serviceQualityRating": 5,
      "responseTimeRating": 4,
      "professionalismRating": 5,
      "averageRating": 4.67,
      "customerComment": "บริการดีมาก ช่างมาตรงเวลา",
      "callNotes": "โทรติดตามวันที่ 12 ม.ค. ลูกค้าพอใจมาก",
      "ratedAt": "2026-01-12T10:30:00.000Z",
      "ratedBy": { ... }
    }
  }
}
```

**Error (ถ้ามีคะแนนอยู่แล้ว):**
```json
{
  "error": "ตั๋วงานนี้มีคะแนนแล้ว กรุณาใช้ PUT เพื่ออัปเดต"
}
```

---

### 3. PUT Update Rating

แก้ไขคะแนนที่มีอยู่

```http
PUT /api-tickets/{ticketId}/rating
Authorization: Bearer {token}
Content-Type: application/json
```

**Request Body:** (เหมือน POST)
```json
{
  "serviceQualityRating": 4,
  "responseTimeRating": 4,
  "professionalismRating": 5,
  "customerComment": "แก้ไขความคิดเห็น",
  "callNotes": "โทรติดตามครั้งที่ 2"
}
```

**Response (200 OK):**
```json
{
  "data": {
    "rating": { ... }
  }
}
```

---

### 4. DELETE Rating

ลบคะแนน (ต้องเป็น Admin Level 2+)

```http
DELETE /api-tickets/{ticketId}/rating
Authorization: Bearer {token}
```

**Response (200 OK):**
```json
{
  "data": {
    "message": "ลบคะแนนสำเร็จ"
  }
}
```

---

## Authorization Levels

| Action | Required Level |
|--------|---------------|
| View Rating | Level 0+ (ทุกคน) |
| Create Rating | Level 1+ (Assigner, PM, Sales) |
| Update Rating | Level 1+ (Assigner, PM, Sales) |
| Delete Rating | Level 2+ (Admin) |

---

## Frontend Implementation Guide

### 1. TypeScript Interface

```typescript
interface TicketRating {
  id: string;
  ticketId: string;
  serviceQualityRating: number;  // 1-5
  responseTimeRating: number;    // 1-5
  professionalismRating: number; // 1-5
  averageRating: number;         // calculated
  customerComment: string | null;
  callNotes: string | null;
  ratedAt: string;
  ratedBy: {
    id: string;
    code: string;
    name: string;
    nickname: string | null;
  };
  createdAt: string;
  updatedAt: string;
}

interface RatingInput {
  serviceQualityRating: number;
  responseTimeRating: number;
  professionalismRating: number;
  customerComment?: string;
  callNotes?: string;
}

interface GetRatingResponse {
  data: {
    rating: TicketRating | null;
    hasRating: boolean;
  };
}
```

### 2. UI Components Needed

```
┌─────────────────────────────────────────────────┐
│  ให้คะแนนความพึงพอใจ                              │
├─────────────────────────────────────────────────┤
│                                                 │
│  คุณภาพบริการ        ★ ★ ★ ★ ★                  │
│  ความรวดเร็ว         ★ ★ ★ ★ ☆                  │
│  ความเป็นมืออาชีพ     ★ ★ ★ ★ ★                  │
│                                                 │
│  ความคิดเห็นลูกค้า                                │
│  ┌─────────────────────────────────────────┐   │
│  │ บริการดีมาก ช่างมาตรงเวลา                  │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
│  บันทึกภายใน (ไม่แสดงลูกค้า)                      │
│  ┌─────────────────────────────────────────┐   │
│  │ โทรติดตามวันที่ 12 ม.ค.                    │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
│              [ บันทึกคะแนน ]                     │
└─────────────────────────────────────────────────┘
```

### 3. Star Rating Component

```tsx
// Example star rating component
interface StarRatingProps {
  value: number;
  onChange: (value: number) => void;
  label: string;
  readonly?: boolean;
}

const ratingLabels = {
  serviceQualityRating: 'คุณภาพบริการ',
  responseTimeRating: 'ความรวดเร็ว',
  professionalismRating: 'ความเป็นมืออาชีพ',
};
```

### 4. Display Average Rating

```tsx
// Show average with color coding
const getAverageColor = (avg: number) => {
  if (avg >= 4.5) return 'text-green-500';  // Excellent
  if (avg >= 3.5) return 'text-blue-500';   // Good
  if (avg >= 2.5) return 'text-yellow-500'; // Average
  return 'text-red-500';                     // Poor
};

// Display: "4.67 / 5.00"
```

### 5. API Helper Functions

```typescript
// Get rating
const getRating = async (ticketId: string): Promise<GetRatingResponse> => {
  const res = await fetch(`/api-tickets/${ticketId}/rating`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.json();
};

// Create or update rating
const saveRating = async (
  ticketId: string,
  input: RatingInput,
  hasExisting: boolean
): Promise<void> => {
  const method = hasExisting ? 'PUT' : 'POST';
  await fetch(`/api-tickets/${ticketId}/rating`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(input)
  });
};
```

### 6. When to Show Rating UI

แสดง UI ให้คะแนนเมื่อ:
- ตั๋วงานมีสถานะ "เสร็จสิ้น" หรือ "ปิดงาน"
- ผู้ใช้มี Level 1+ (สำหรับการบันทึก)
- แสดงเป็น read-only สำหรับ Level 0

```typescript
const canEditRating = employee.level >= 1;
const showRatingSection = ticket.status === 'completed' || ticket.status === 'closed';
```

---

## Error Handling

| Error | Status | Message |
|-------|--------|---------|
| Invalid rating value | 400 | `คะแนน{field}ต้องเป็นตัวเลข 1-5` |
| Rating exists | 400 | `ตั๋วงานนี้มีคะแนนแล้ว กรุณาใช้ PUT เพื่ออัปเดต` |
| Rating not found | 404 | `ไม่พบคะแนนสำหรับตั๋วงานนี้` |
| Ticket not found | 404 | `ไม่พบตั๋วงาน` |
| Unauthorized | 403 | `ไม่มีสิทธิ์ดำเนินการ` |
