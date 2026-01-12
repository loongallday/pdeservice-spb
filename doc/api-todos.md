# Todo/Reminder API - Frontend Integration Guide

## Overview

ระบบ Todo/Reminder สำหรับสร้างงานพร้อมกำหนดเวลา สามารถมอบหมายให้ตัวเองหรือพนักงานคนอื่นได้ ระบบจะส่ง Notification อัตโนมัติเมื่อถึงกำหนด

## Features
- สร้าง Todo พร้อมกำหนดเวลา (deadline)
- มอบหมายให้ตัวเองหรือพนักงานคนอื่น
- เชื่อมโยงกับตั๋วงาน (optional)
- ระบบแจ้งเตือนอัตโนมัติเมื่อถึงกำหนด
- 4 ระดับความสำคัญ: low, normal, high, urgent

---

## API Endpoints

### Base URL
```
/api-todos
```

---

### 1. GET List Todos

ดึงรายการ Todo (แสดงเฉพาะที่ตัวเองสร้างหรือได้รับมอบหมาย, Admin เห็นทั้งหมด)

```http
GET /api-todos?page=1&limit=20
Authorization: Bearer {token}
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | number | หน้าที่ต้องการ (default: 1) |
| `limit` | number | จำนวนต่อหน้า (default: 20) |
| `assignee_id` | uuid | กรองตามผู้รับมอบหมาย |
| `creator_id` | uuid | กรองตามผู้สร้าง |
| `is_completed` | boolean | กรองตามสถานะ (true/false) |
| `priority` | string | กรองตามความสำคัญ (low/normal/high/urgent) |
| `ticket_id` | uuid | กรองตามตั๋วงานที่เชื่อมโยง |
| `from_date` | ISO date | กำหนดเวลาตั้งแต่ |
| `to_date` | ISO date | กำหนดเวลาถึง |

**Response:**
```json
{
  "data": {
    "data": [
      {
        "id": "uuid",
        "title": "โทรติดตามลูกค้า",
        "description": "ติดตามงาน PM ที่ค้างอยู่",
        "deadline": "2026-01-15T09:00:00.000Z",
        "ticketId": "uuid or null",
        "isCompleted": false,
        "completedAt": null,
        "notifiedAt": null,
        "priority": "high",
        "creator": {
          "id": "uuid",
          "code": "EMP001",
          "name": "สมชาย ใจดี",
          "nickname": "ชาย"
        },
        "assignee": {
          "id": "uuid",
          "code": "EMP002",
          "name": "สมหญิง รักงาน",
          "nickname": "หญิง"
        },
        "ticket": {
          "id": "uuid",
          "code": "TK-2026-0001"
        },
        "createdAt": "2026-01-12T10:00:00.000Z",
        "updatedAt": "2026-01-12T10:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 45,
      "totalPages": 3
    }
  }
}
```

---

### 2. GET Single Todo

```http
GET /api-todos/{todoId}
Authorization: Bearer {token}
```

**Response:**
```json
{
  "data": {
    "id": "uuid",
    "title": "โทรติดตามลูกค้า",
    "description": "ติดตามงาน PM",
    "deadline": "2026-01-15T09:00:00.000Z",
    "ticketId": "uuid",
    "isCompleted": false,
    "completedAt": null,
    "notifiedAt": null,
    "priority": "high",
    "creator": { ... },
    "assignee": { ... },
    "ticket": { ... },
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

---

### 3. POST Create Todo

```http
POST /api-todos
Authorization: Bearer {token}
Content-Type: application/json
```

**Request Body:**
```json
{
  "title": "โทรติดตามลูกค้า",
  "description": "ติดตามงาน PM ที่ค้างอยู่",
  "deadline": "2026-01-15T09:00:00Z",
  "assigneeId": "uuid",
  "ticketId": "uuid (optional)",
  "priority": "high"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | ✅ | หัวข้องาน |
| `description` | string | ❌ | รายละเอียด |
| `deadline` | ISO datetime | ✅ | กำหนดเวลา |
| `assigneeId` | uuid | ✅ | ผู้รับมอบหมาย |
| `ticketId` | uuid | ❌ | ตั๋วงานที่เชื่อมโยง |
| `priority` | string | ❌ | ความสำคัญ (default: normal) |

**Response (201 Created):**
```json
{
  "data": {
    "id": "uuid",
    "title": "โทรติดตามลูกค้า",
    ...
  }
}
```

---

### 4. PUT Update Todo

```http
PUT /api-todos/{todoId}
Authorization: Bearer {token}
Content-Type: application/json
```

**Request Body:** (ส่งเฉพาะ field ที่ต้องการแก้ไข)
```json
{
  "title": "โทรติดตามลูกค้า (แก้ไข)",
  "deadline": "2026-01-16T14:00:00Z",
  "priority": "urgent"
}
```

> **Note:** หากแก้ไข deadline จะ reset การแจ้งเตือน (notifiedAt = null) เพื่อให้แจ้งเตือนใหม่ตามเวลาที่กำหนด

**Response:**
```json
{
  "data": { ... }
}
```

---

### 5. DELETE Todo

```http
DELETE /api-todos/{todoId}
Authorization: Bearer {token}
```

**Response:**
```json
{
  "data": {
    "message": "ลบงานสำเร็จ"
  }
}
```

---

### 6. POST Mark as Completed

```http
POST /api-todos/{todoId}/complete
Authorization: Bearer {token}
```

**Response:**
```json
{
  "data": {
    "id": "uuid",
    "isCompleted": true,
    "completedAt": "2026-01-12T15:30:00.000Z",
    ...
  }
}
```

---

### 7. POST Reopen Todo

เปิดงานที่เสร็จแล้วอีกครั้ง

```http
POST /api-todos/{todoId}/reopen
Authorization: Bearer {token}
```

**Response:**
```json
{
  "data": {
    "id": "uuid",
    "isCompleted": false,
    "completedAt": null,
    "notifiedAt": null,
    ...
  }
}
```

---

## Authorization Levels

| Action | Required Level | Notes |
|--------|---------------|-------|
| View Todos | Level 0+ | เห็นเฉพาะที่ตัวเองสร้าง/ได้รับมอบหมาย |
| View All Todos | Level 2+ | Admin เห็นทั้งหมด |
| Create Todo | Level 1+ | |
| Update Todo | Level 1+ | เฉพาะผู้สร้าง หรือ Admin |
| Delete Todo | Level 1+ | เฉพาะผู้สร้าง หรือ Admin |
| Complete/Reopen | Level 0+ | ผู้สร้าง หรือ ผู้รับมอบหมาย |

---

## Deadline Notifications

### How it works
- ระบบตรวจสอบ deadline ทุก **5 นาที** (pg_cron)
- เมื่อถึงกำหนด → สร้าง Notification ให้ผู้รับมอบหมาย
- Notification type: `todo_reminder`

### Notification Format
```json
{
  "type": "todo_reminder",
  "title": "ถึงกำหนดงาน: โทรติดตามลูกค้า",
  "message": "งานจาก สมชาย ใจดี ถึงกำหนดแล้ว",
  "metadata": {
    "todo_id": "uuid",
    "priority": "high",
    "deadline": "2026-01-15T09:00:00Z"
  }
}
```

### Important Notes
- แต่ละ Todo จะแจ้งเตือน **1 ครั้ง** เท่านั้น (tracked by `notifiedAt`)
- หาก reopen Todo → reset `notifiedAt` → แจ้งเตือนใหม่ได้ถ้ายังเลยกำหนด
- หากแก้ไข deadline → reset `notifiedAt` → รอแจ้งเตือนตามเวลาใหม่

---

## Frontend Implementation Guide

### 1. TypeScript Interfaces

```typescript
type TodoPriority = 'low' | 'normal' | 'high' | 'urgent';

interface TodoEmployee {
  id: string;
  code: string;
  name: string;
  nickname: string | null;
}

interface TodoTicket {
  id: string;
  code: string;
}

interface Todo {
  id: string;
  title: string;
  description: string | null;
  deadline: string;
  ticketId: string | null;
  isCompleted: boolean;
  completedAt: string | null;
  notifiedAt: string | null;
  priority: TodoPriority;
  creator: TodoEmployee;
  assignee: TodoEmployee;
  ticket: TodoTicket | null;
  createdAt: string;
  updatedAt: string;
}

interface TodoInput {
  title: string;
  description?: string;
  deadline: string;
  assigneeId: string;
  ticketId?: string;
  priority?: TodoPriority;
}

interface TodoListResponse {
  data: {
    data: Todo[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}
```

### 2. Priority Display

```typescript
const priorityConfig = {
  low: { label: 'ต่ำ', color: 'gray', icon: '○' },
  normal: { label: 'ปกติ', color: 'blue', icon: '●' },
  high: { label: 'สูง', color: 'orange', icon: '●●' },
  urgent: { label: 'ด่วนมาก', color: 'red', icon: '🔥' },
};
```

### 3. Deadline Status Helper

```typescript
const getDeadlineStatus = (deadline: string, isCompleted: boolean) => {
  if (isCompleted) return { status: 'completed', color: 'green' };

  const now = new Date();
  const deadlineDate = new Date(deadline);
  const diffHours = (deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60);

  if (diffHours < 0) return { status: 'overdue', color: 'red', label: 'เลยกำหนด' };
  if (diffHours < 24) return { status: 'due_soon', color: 'orange', label: 'ใกล้ถึงกำหนด' };
  return { status: 'on_track', color: 'green', label: 'ปกติ' };
};
```

### 4. UI Components Needed

```
┌─────────────────────────────────────────────────────────────┐
│  📋 รายการงาน                          [+ สร้างงานใหม่]     │
├─────────────────────────────────────────────────────────────┤
│  ┌─ Filters ──────────────────────────────────────────────┐ │
│  │ สถานะ: [ทั้งหมด ▾]  ความสำคัญ: [ทั้งหมด ▾]            │ │
│  │ ผู้รับมอบหมาย: [ทั้งหมด ▾]  กำหนด: [__ ถึง __]        │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌─ Todo Item ────────────────────────────────────────────┐ │
│  │ ☐ โทรติดตามลูกค้า                        🔥 ด่วนมาก   │ │
│  │   📅 15 ม.ค. 09:00  👤 สมหญิง  🎫 TK-2026-0001        │ │
│  │   ⚠️ เลยกำหนด 2 ชม.                      [✓] [✏️] [🗑] │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌─ Todo Item ────────────────────────────────────────────┐ │
│  │ ☑ ส่งใบเสนอราคา                          ● ปกติ       │ │
│  │   📅 14 ม.ค. 17:00  👤 ตัวเอง                          │ │
│  │   ✅ เสร็จแล้ว                            [↩️] [🗑]    │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 5. Create/Edit Form

```
┌─────────────────────────────────────────────────────────────┐
│  สร้างงานใหม่                                      [✕]     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  หัวข้องาน *                                                │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ โทรติดตามลูกค้า                                      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  รายละเอียด                                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ ติดตามงาน PM ที่ค้างอยู่                              │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  กำหนดเวลา *                     ความสำคัญ                  │
│  ┌───────────────────────┐      ┌───────────────────┐      │
│  │ 15/01/2026 09:00     │      │ 🔥 ด่วนมาก    ▾   │      │
│  └───────────────────────┘      └───────────────────┘      │
│                                                             │
│  มอบหมายให้ *                                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 🔍 ค้นหาพนักงาน...                                   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  เชื่อมโยงตั๋วงาน (optional)                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 🔍 ค้นหาตั๋วงาน...                                   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│                              [ ยกเลิก ]  [ 💾 บันทึก ]     │
└─────────────────────────────────────────────────────────────┘
```

### 6. API Helper Functions

```typescript
// List todos
const getTodos = async (params: {
  page?: number;
  limit?: number;
  assigneeId?: string;
  isCompleted?: boolean;
  priority?: TodoPriority;
}): Promise<TodoListResponse> => {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.set('page', String(params.page));
  if (params.limit) searchParams.set('limit', String(params.limit));
  if (params.assigneeId) searchParams.set('assignee_id', params.assigneeId);
  if (params.isCompleted !== undefined) searchParams.set('is_completed', String(params.isCompleted));
  if (params.priority) searchParams.set('priority', params.priority);

  const res = await fetch(`/api-todos?${searchParams}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.json();
};

// Create todo
const createTodo = async (input: TodoInput): Promise<{ data: Todo }> => {
  const res = await fetch('/api-todos', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(input)
  });
  return res.json();
};

// Complete todo
const completeTodo = async (todoId: string): Promise<{ data: Todo }> => {
  const res = await fetch(`/api-todos/${todoId}/complete`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.json();
};

// Reopen todo
const reopenTodo = async (todoId: string): Promise<{ data: Todo }> => {
  const res = await fetch(`/api-todos/${todoId}/reopen`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.json();
};
```

### 7. Handling Notification Click

เมื่อ user คลิก notification ประเภท `todo_reminder`:

```typescript
const handleNotificationClick = (notification: Notification) => {
  if (notification.type === 'todo_reminder') {
    const todoId = notification.metadata?.todo_id;
    if (todoId) {
      // Navigate to todo detail or open todo modal
      router.push(`/todos/${todoId}`);
      // or
      openTodoModal(todoId);
    }
  }
};
```

---

## Error Handling

| Error | Status | Message |
|-------|--------|---------|
| Missing title | 400 | `กรุณาระบุหัวข้องาน` |
| Missing deadline | 400 | `กรุณาระบุกำหนดเวลา` |
| Invalid date | 400 | `รูปแบบวันที่ไม่ถูกต้อง` |
| Missing assignee | 400 | `กรุณาระบุผู้รับผิดชอบ` |
| Invalid priority | 400 | `ความสำคัญไม่ถูกต้อง` |
| Todo not found | 404 | `ไม่พบงานที่ต้องการ` |
| No permission to view | 403 | `ไม่มีสิทธิ์ดูงานนี้` |
| No permission to edit | 403 | `ไม่มีสิทธิ์แก้ไขงานนี้` |
| Already completed | 400 | `งานนี้เสร็จสิ้นแล้ว` |
| Not yet completed | 400 | `งานนี้ยังไม่เสร็จสิ้น` |
