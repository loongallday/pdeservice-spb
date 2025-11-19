# Master Ticket API - Quick Reference Card

## Endpoints

| Method | Endpoint | Level | Description |
|--------|----------|-------|-------------|
| POST | `/api-tickets/master` | 1+ | Create ticket with all related data |
| PUT | `/api-tickets/master/:id` | 1+ | Update ticket with all related data |
| DELETE | `/api-tickets/master/:id` | 2+ | Delete ticket (+ optional cleanup) |

---

## Create Master Ticket

```bash
POST /api-tickets/master
```

**Minimum Required**:
```json
{
  "ticket": {
    "work_type_id": "uuid",
    "assigner_id": "uuid",
    "status_id": "uuid"
  }
}
```

**Full Example**:
```json
{
  "ticket": {
    "details": "รายละเอียด",
    "work_type_id": "uuid",
    "assigner_id": "uuid",
    "status_id": "uuid",
    "additional": "ข้อมูลเพิ่มเติม"
  },
  "company": {
    "tax_id": "0123456789012",
    "name_th": "ชื่อบริษัท",
    "name_en": "Company Name"
  },
  "site": {
    "name": "ชื่อสถานที่",
    "address_detail": "ที่อยู่",
    "postal_code": 10110
  },
  "contact": {
    "person_name": "ชื่อผู้ติดต่อ",
    "phone": ["0812345678"],
    "email": ["email@example.com"]
  },
  "appointment": {
    "appointment_date": "2025-11-20",
    "appointment_time_start": "09:00:00",
    "appointment_time_end": "12:00:00",
    "appointment_type": "scheduled"
  },
  "employee_ids": ["uuid1", "uuid2"],
  "merchandise_ids": ["uuid1", "uuid2"]
}
```

---

## Update Master Ticket

```bash
PUT /api-tickets/master/:id
```

**All fields optional** - include only what you want to update:

```json
{
  "ticket": {
    "status_id": "completed-uuid"
  }
}
```

**Update Multiple**:
```json
{
  "ticket": {
    "status_id": "uuid",
    "details": "อัพเดท"
  },
  "appointment": {
    "appointment_date": "2025-11-21"
  },
  "employee_ids": ["uuid1"]  // Replaces all
}
```

**⚠️ Important**: 
- `employee_ids` and `merchandise_ids` **replace** all existing values
- Set fields to `null` to **clear** them: `"contact": null`, `"site": null`, `"appointment": null`
- **Omit** fields to **keep** them unchanged

---

## Delete Master Ticket

```bash
DELETE /api-tickets/master/:id
```

**Query Parameters**:
- `delete_appointment=true` - Also delete appointment
- `delete_contact=true` - Delete contact if unused by other tickets

**Examples**:
```bash
# Delete ticket only
DELETE /api-tickets/master/uuid

# Delete ticket + appointment
DELETE /api-tickets/master/uuid?delete_appointment=true

# Full cleanup
DELETE /api-tickets/master/uuid?delete_appointment=true&delete_contact=true
```

---

## Field Reference

### Ticket (Required Fields)
- ✅ `work_type_id` - UUID
- ✅ `assigner_id` - UUID
- ✅ `status_id` - UUID
- ⭕ `details` - Text
- ⭕ `additional` - Text

### Company (Find-or-Create)
- ✅ `tax_id` - 13 digits (PK)
- ⭕ `name_th` - Thai name
- ⭕ `name_en` - English name
- ⭕ `address_detail` - Address

### Site (Find-or-Create)
- ⭕ `id` - Use existing (UUID)
- ⭕ `name` - Site name
- ⭕ `address_detail` - Address
- ⭕ `postal_code` - Number
- ⭕ `company_id` - Tax ID

### Contact (Find-or-Create)
- ⭕ `id` - Use existing (UUID)
- ⭕ `person_name` - Name
- ⭕ `nickname` - Nickname
- ⭕ `phone` - Array of strings
- ⭕ `email` - Array of strings
- ⭕ `line_id` - LINE ID
- ⭕ `note` - Notes

### Appointment
- ⭕ `appointment_date` - YYYY-MM-DD
- ⭕ `appointment_time_start` - HH:MM:SS
- ⭕ `appointment_time_end` - HH:MM:SS
- ⭕ `appointment_type` - `call_to_schedule` | `scheduled` | `backlog`

### Arrays
- ⭕ `employee_ids` - Array of UUIDs
- ⭕ `merchandise_ids` - Array of UUIDs

**Legend**: ✅ Required | ⭕ Optional

---

## Response Format

All operations return complete ticket data:

```json
{
  "data": {
    "id": "uuid",
    "details": "...",
    "work_type_id": "uuid",
    "assigner_id": "uuid",
    "status_id": "uuid",
    "site_id": "uuid",
    "contact_id": "uuid",
    "appointment_id": "uuid",
    "work_type": { /* expanded */ },
    "assigner": { /* expanded */ },
    "status": { /* expanded */ },
    "site": {
      /* expanded */,
      "company": { /* expanded */ }
    },
    "contact": { /* expanded */ },
    "appointment": { /* expanded */ },
    "employees": [ /* array */ ],
    "merchandise": [ /* array */ ]
  }
}
```

---

## Common Patterns

### New Customer Ticket
```json
{
  "ticket": { /* required fields */ },
  "company": { "tax_id": "...", "name_th": "..." },
  "site": { "name": "...", "address_detail": "..." },
  "contact": { "person_name": "...", "phone": ["..."] },
  "appointment": { "appointment_type": "call_to_schedule" }
}
```

### Existing Customer Ticket
```json
{
  "ticket": { /* required fields */ },
  "site": { "id": "existing-uuid" },
  "contact": { "id": "existing-uuid" },
  "merchandise_ids": ["..."],
  "appointment": { "appointment_date": "2025-11-20", ... }
}
```

### Update Status
```json
{
  "ticket": { "status_id": "new-status-uuid" }
}
```

### Reschedule
```json
{
  "appointment": {
    "appointment_date": "2025-11-25",
    "appointment_time_start": "14:00:00"
  }
}
```

### Assign Technicians
```json
{
  "employee_ids": ["tech1-uuid", "tech2-uuid"]
}
```

### Complete Ticket
```json
{
  "ticket": {
    "status_id": "completed-uuid",
    "additional": "งานเสร็จสิ้น"
  }
}
```

### Clear Contact/Site
```json
{
  "contact": null,  // Clear contact link
  "site": null      // Clear site link
}
```

### Unlink Appointment (Make Backlog)
```json
{
  "appointment": null
}
```

---

## Tips

✅ **Use existing IDs** when possible (site.id, contact.id)  
✅ **Include only what you need** - all fields optional (except ticket required fields for create)  
✅ **Validate UUIDs** before sending  
✅ **Check date/time formats**  
⚠️ **Remember**: `employee_ids` and `merchandise_ids` are **replacements**, not additions  
⚠️ **Merchandise** must be in same site as ticket  

---

## Error Codes

| Code | Description |
|------|-------------|
| 400 | Validation error (missing required fields, invalid format) |
| 401 | Authentication required |
| 403 | Insufficient permissions |
| 404 | Ticket/resource not found |
| 500 | Database/server error |

---

## Full Documentation

📖 [Complete Master Ticket API Documentation](./MASTER-TICKET-API.md)

📖 [Individual Tickets API](./README.md)

