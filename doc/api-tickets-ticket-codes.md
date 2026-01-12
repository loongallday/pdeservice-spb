# Ticket Codes Feature - Frontend Integration Guide

## Overview

Tickets now have Jira-style human-readable codes (e.g., `PDE-1`, `PDE-123`) in addition to UUIDs. This makes tickets easier to reference, search, and communicate about.

---

## New Response Fields

### `ticket_code` (string)
- **Format:** `PDE-{number}` (e.g., `PDE-1`, `PDE-42`, `PDE-1234`)
- **Type:** `string`
- **Nullable:** No (always present)
- **Description:** Human-readable unique identifier for the ticket

### `ticket_number` (number)
- **Format:** Sequential integer starting from 1
- **Type:** `number` (integer)
- **Nullable:** No (always present)
- **Description:** The numeric portion of the ticket code, useful for sorting

---

## API Response Examples

### Single Ticket Response (`GET /api-tickets/{id}`)

```json
{
  "data": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "ticket_code": "PDE-42",
    "ticket_number": 42,
    "details": "UPS ไม่ทำงาน ไฟกระพริบสีแดง",
    "details_summary": "UPS ชำรุด ไฟแดงกระพริบ",
    "status": {
      "id": "...",
      "name": "รอดำเนินการ",
      "code": "pending"
    },
    "work_type": {
      "id": "...",
      "name": "ซ่อม",
      "code": "rma"
    },
    "site": {
      "id": "...",
      "name": "สาขาสีลม"
    },
    "appointment": {
      "id": "...",
      "date": "2026-01-15",
      "time_start": "09:00",
      "time_end": "12:00",
      "type": "time_range",
      "type_display": "09:00 - 12:00",
      "is_approved": true
    },
    "created_at": "2026-01-10T08:30:00Z",
    "updated_at": "2026-01-11T14:22:00Z"
  }
}
```

### Search Response (`GET /api-tickets`)

```json
{
  "data": {
    "data": [
      {
        "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        "ticket_code": "PDE-42",
        "ticket_number": 42,
        "site_name": "สาขาสีลม",
        "company_name": "บริษัท ABC จำกัด",
        "work_type_name": "ซ่อม",
        "work_type_code": "rma",
        "status_name": "รอดำเนินการ",
        "status_code": "pending",
        "assigner_name": "สมชาย ใจดี",
        "creator_name": "สมหญิง รักงาน",
        "location": {
          "province_code": 10,
          "province_name": "กรุงเทพมหานคร",
          "district_code": 1001,
          "district_name": "บางรัก",
          "subdistrict_code": 100101,
          "subdistrict_name": "สีลม",
          "address_detail": "123 ถนนสีลม",
          "display": "สีลม, บางรัก, กทม."
        },
        "appointment": {
          "id": "...",
          "date": "2026-01-15",
          "time_start": "09:00",
          "time_end": "12:00",
          "type": "time_range",
          "type_display": "09:00 - 12:00",
          "is_approved": true
        },
        "employees": [
          {
            "id": "...",
            "name": "ช่างวิชัย",
            "code": "T001",
            "is_key": true,
            "profile_image_url": "https://..."
          }
        ],
        "employee_count": 1,
        "cf_employees": [],
        "cf_employee_count": 0,
        "details": "UPS ไม่ทำงาน ไฟกระพริบสีแดง",
        "details_summary": "UPS ชำรุด ไฟแดงกระพริบ",
        "additional": null,
        "merchandise": [
          {
            "id": "...",
            "serial_no": "UPS-2024-001",
            "model_name": "APC Smart-UPS 3000"
          }
        ],
        "merchandise_count": 1,
        "work_giver": {
          "id": "...",
          "code": "WG001",
          "name": "APC Thailand"
        },
        "created_at": "2026-01-10T08:30:00Z",
        "updated_at": "2026-01-11T14:22:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 156,
      "totalPages": 8,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

---

## Searching by Ticket Code

### Via `details` Parameter

The existing `details` search parameter now also searches ticket codes.

```
GET /api-tickets?details=PDE-42
```

This searches across:
- `ticket_code` (e.g., "PDE-42") ✅ **NEW**
- `ticket.id` (UUID)
- `ticket.details` (ticket description)
- `site.name` (site name)
- `company.name_th` (company Thai name)
- `company.name_en` (company English name)

### Search Examples

| Query | Matches |
|-------|---------|
| `?details=PDE-42` | Ticket with code PDE-42 |
| `?details=PDE-` | All tickets (partial match) |
| `?details=42` | Tickets with "42" in code, details, site name, etc. |
| `?details=สีลม` | Tickets with "สีลม" in any searchable field |

---

## TypeScript Interface

```typescript
interface TicketDisplayItem {
  // === Core Identity ===
  id: string;                    // UUID
  ticket_code: string;           // "PDE-42"
  ticket_number: number;         // 42

  // === Display Strings ===
  site_name: string | null;
  company_name: string | null;
  work_type_name: string | null;
  work_type_code: string | null;
  status_name: string | null;
  status_code: string | null;
  assigner_name: string | null;
  creator_name: string | null;

  // === Location ===
  location: {
    province_code: number | null;
    province_name: string | null;
    district_code: number | null;
    district_name: string | null;
    subdistrict_code: number | null;
    subdistrict_name: string | null;
    address_detail: string | null;
    display: string;             // Pre-formatted location string
  };

  // === Appointment ===
  appointment: {
    id: string | null;
    date: string | null;         // "YYYY-MM-DD"
    time_start: string | null;   // "HH:MM"
    time_end: string | null;     // "HH:MM"
    type: 'full_day' | 'time_range' | 'half_morning' | 'half_afternoon' | 'call_to_schedule' | 'backlog' | 'scheduled' | null;
    type_display: string;        // Pre-formatted display string
    is_approved: boolean | null;
  };

  // === Employees ===
  employees: TicketEmployee[];
  employee_count: number;
  cf_employees: TicketEmployee[];  // Confirmed employees
  cf_employee_count: number;

  // === Content ===
  details: string | null;
  details_summary: string | null;  // AI-generated summary
  additional: string | null;

  // === Merchandise ===
  merchandise: TicketMerchandiseSummary[];
  merchandise_count: number;

  // === Work Giver ===
  work_giver: {
    id: string;
    code: string;
    name: string;
  } | null;

  // === Timestamps ===
  created_at: string;            // ISO 8601
  updated_at: string;            // ISO 8601

  // === IDs (only when include=full) ===
  _ids?: {
    site_id: string | null;
    status_id: string;
    work_type_id: string;
    assigner_id: string;
    creator_id: string | null;
    contact_id: string | null;
  };
}

interface TicketEmployee {
  id: string;
  name: string;
  code: string | null;
  is_key: boolean;
  profile_image_url: string | null;
}

interface TicketMerchandiseSummary {
  id: string;
  serial_no: string;
  model_name: string | null;
}
```

---

## Frontend Implementation Guide

### 1. Display Ticket Code in Lists/Tables

```tsx
// Table column
<TableCell>
  <span className="font-mono text-sm font-medium text-blue-600">
    {ticket.ticket_code}
  </span>
</TableCell>

// Card header
<CardHeader>
  <div className="flex items-center gap-2">
    <Badge variant="outline">{ticket.ticket_code}</Badge>
    <span className="text-muted-foreground">{ticket.status_name}</span>
  </div>
</CardHeader>
```

### 2. Display in Ticket Detail Page

```tsx
<div className="flex items-center gap-4">
  <h1 className="text-2xl font-bold">{ticket.ticket_code}</h1>
  <Badge>{ticket.status_name}</Badge>
</div>
<p className="text-muted-foreground text-sm">
  ID: {ticket.id}
</p>
```

### 3. Search Input with Ticket Code Support

```tsx
const [searchQuery, setSearchQuery] = useState('');

// Detect if user is searching by ticket code
const isTicketCodeSearch = /^PDE-\d+$/i.test(searchQuery);

<div className="relative">
  <Input
    placeholder="ค้นหาด้วยรหัสตั๋ว (PDE-123) หรือรายละเอียด..."
    value={searchQuery}
    onChange={(e) => setSearchQuery(e.target.value)}
  />
  {isTicketCodeSearch && (
    <Badge className="absolute right-2 top-2" variant="secondary">
      รหัสตั๋ว
    </Badge>
  )}
</div>
```

### 4. Copy Ticket Code to Clipboard

```tsx
const copyTicketCode = async (code: string) => {
  await navigator.clipboard.writeText(code);
  toast.success(`คัดลอก ${code} แล้ว`);
};

<Button
  variant="ghost"
  size="sm"
  onClick={() => copyTicketCode(ticket.ticket_code)}
>
  <Copy className="h-4 w-4 mr-1" />
  {ticket.ticket_code}
</Button>
```

### 5. Link to Ticket by Code

```tsx
// URL structure options:

// Option A: Keep using UUID in URL (recommended for security)
<Link href={`/tickets/${ticket.id}`}>
  {ticket.ticket_code}
</Link>

// Option B: Use ticket code in URL (requires backend route support)
<Link href={`/tickets/${ticket.ticket_code}`}>
  {ticket.ticket_code}
</Link>
```

### 6. Sorting by Ticket Number

```tsx
// Sort by ticket_number for chronological order
const sortedTickets = [...tickets].sort((a, b) =>
  b.ticket_number - a.ticket_number  // Newest first
);

// Or use ticket_number in API sort parameter
// GET /api-tickets?sort=ticket_number&order=desc
```

---

## Migration Notes

### Existing Tickets
- All existing tickets have been backfilled with ticket codes
- Codes were assigned in chronological order by `created_at`
- The first ticket created is `PDE-1`, second is `PDE-2`, etc.

### New Tickets
- New tickets automatically receive the next sequential code
- Codes are generated by a database trigger on insert
- No action required from frontend when creating tickets

### Breaking Changes
- **None** - This is an additive change
- Existing API calls continue to work
- `id` (UUID) is still the primary identifier

---

## Best Practices

### DO ✅
- Display `ticket_code` prominently in UI
- Use `ticket_code` for user-facing references
- Allow search by ticket code
- Copy ticket code to clipboard for sharing
- Show both `ticket_code` and `id` in admin/debug views

### DON'T ❌
- Replace `id` with `ticket_code` in API calls (use `id` for updates/deletes)
- Assume ticket codes are purely sequential (gaps may occur)
- Parse `ticket_code` to extract the number (use `ticket_number` instead)
- Hard-code the "PDE-" prefix (it may change in the future)

---

## FAQ

### Q: Can I search by just the number?
**A:** Yes. Searching `?details=42` will match `PDE-42` as well as any ticket with "42" in other fields.

### Q: Will there be gaps in ticket numbers?
**A:** Possibly. If a ticket creation fails after getting a sequence number, that number will be skipped. This is normal and expected.

### Q: Can I update a ticket using the ticket_code instead of id?
**A:** No. The API still requires the UUID `id` for update/delete operations. Use `ticket_code` for display and search only.

### Q: What's the maximum ticket number?
**A:** PostgreSQL INTEGER max is 2,147,483,647. You won't run out.

### Q: Is the prefix "PDE" configurable?
**A:** Currently no. The prefix is hardcoded. Future versions may support configuration.

---

## Changelog

| Date | Version | Changes |
|------|---------|---------|
| 2026-01-11 | 1.0.0 | Initial release - Added `ticket_code` and `ticket_number` fields |
