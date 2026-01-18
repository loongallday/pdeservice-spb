# Extra Fields API

API สำหรับจัดการ custom key-value fields บน ticket

## Base URL

```
https://ogzyihacqbasolfxymgo.supabase.co/functions/v1/api-tickets
```

## Endpoints

### 1. List Extra Fields

ดึงรายการ extra fields ทั้งหมดของ ticket

```
GET /:ticketId/extra-fields
```

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "ticket_id": "uuid",
      "field_key": "customer_note",
      "field_value": "ลูกค้าไม่อยู่บ้าน",
      "created_by": "uuid",
      "created_at": "2024-01-16T10:00:00Z",
      "updated_at": "2024-01-16T10:00:00Z"
    }
  ]
}
```

---

### 2. Create Extra Field

สร้าง extra field ใหม่

```
POST /:ticketId/extra-fields
```

**Request Body:**
```json
{
  "field_key": "customer_note",
  "field_value": "ลูกค้าไม่อยู่บ้าน"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `field_key` | string | Yes | ชื่อ key (ไม่เกิน 100 ตัวอักษร, unique per ticket) |
| `field_value` | string \| null | No | ค่าของ field |

**Response (201):**
```json
{
  "data": {
    "id": "uuid",
    "ticket_id": "uuid",
    "field_key": "customer_note",
    "field_value": "ลูกค้าไม่อยู่บ้าน",
    "created_by": "uuid",
    "created_at": "2024-01-16T10:00:00Z",
    "updated_at": "2024-01-16T10:00:00Z"
  }
}
```

**Errors:**
- `400` - field_key ซ้ำสำหรับ ticket นี้
- `404` - ไม่พบ ticket

---

### 3. Bulk Upsert Extra Fields

สร้างหรืออัพเดท extra fields หลายรายการพร้อมกัน (ใช้ field_key เป็น key ในการ upsert)

```
POST /:ticketId/extra-fields/bulk
```

**Request Body:**
```json
{
  "fields": [
    { "field_key": "priority_reason", "field_value": "urgent" },
    { "field_key": "special_tools", "field_value": "ladder required" },
    { "field_key": "access_code", "field_value": "1234" }
  ]
}
```

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "ticket_id": "uuid",
      "field_key": "priority_reason",
      "field_value": "urgent",
      "created_by": "uuid",
      "created_at": "2024-01-16T10:00:00Z",
      "updated_at": "2024-01-16T10:00:00Z"
    },
    ...
  ]
}
```

**Note:** ถ้า `field_key` มีอยู่แล้ว จะอัพเดท `field_value` แทนการสร้างใหม่

---

### 4. Update Extra Field

แก้ไข extra field

```
PUT /:ticketId/extra-fields/:fieldId
```

**Request Body:**
```json
{
  "field_key": "customer_note",
  "field_value": "ลูกค้านัดใหม่เป็นวันพรุ่งนี้"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `field_key` | string | No | ชื่อ key ใหม่ |
| `field_value` | string \| null | No | ค่าใหม่ |

**Response:**
```json
{
  "data": {
    "id": "uuid",
    "ticket_id": "uuid",
    "field_key": "customer_note",
    "field_value": "ลูกค้านัดใหม่เป็นวันพรุ่งนี้",
    "created_by": "uuid",
    "created_at": "2024-01-16T10:00:00Z",
    "updated_at": "2024-01-16T11:00:00Z"
  }
}
```

---

### 5. Delete Extra Field

ลบ extra field

```
DELETE /:ticketId/extra-fields/:fieldId
```

**Response:**
```json
{
  "data": {
    "message": "ลบ extra field สำเร็จ"
  }
}
```

---

## TypeScript Types

```typescript
interface ExtraField {
  id: string;
  ticket_id: string;
  field_key: string;
  field_value: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface CreateExtraFieldRequest {
  field_key: string;
  field_value?: string | null;
}

interface BulkUpsertRequest {
  fields: CreateExtraFieldRequest[];
}

interface UpdateExtraFieldRequest {
  field_key?: string;
  field_value?: string | null;
}
```

---

## Usage Examples

### React Query Example

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// List extra fields
export function useExtraFields(ticketId: string) {
  return useQuery({
    queryKey: ['extra-fields', ticketId],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api-tickets/${ticketId}/extra-fields`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const json = await res.json();
      return json.data as ExtraField[];
    }
  });
}

// Create extra field
export function useCreateExtraField(ticketId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateExtraFieldRequest) => {
      const res = await fetch(`${API_URL}/api-tickets/${ticketId}/extra-fields`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(data)
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['extra-fields', ticketId] });
    }
  });
}

// Bulk upsert
export function useBulkUpsertExtraFields(ticketId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: BulkUpsertRequest) => {
      const res = await fetch(`${API_URL}/api-tickets/${ticketId}/extra-fields/bulk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(data)
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['extra-fields', ticketId] });
    }
  });
}
```

---

## Use Cases

1. **Custom Notes** - เพิ่มหมายเหตุพิเศษที่ไม่มีใน schema หลัก
2. **Access Information** - รหัสเข้าอาคาร, เบอร์ติดต่อพิเศษ
3. **Special Requirements** - อุปกรณ์พิเศษที่ต้องใช้
4. **Tracking Data** - ข้อมูล tracking จากระบบอื่น
5. **Temporary Flags** - flags ชั่วคราวสำหรับ workflow พิเศษ
