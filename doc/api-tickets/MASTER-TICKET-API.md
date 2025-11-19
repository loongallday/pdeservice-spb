# Master Ticket API

## Overview

The Master Ticket API provides comprehensive endpoints for creating, updating, and deleting tickets along with **all related data** in a single operation. This eliminates the need to make multiple API calls to different endpoints when managing tickets with their associated company, site, contact, appointment, merchandise, and employee information.

**Base URL**: `/functions/v1/api-tickets/master`

**Authentication**: All endpoints require Bearer token authentication.

**Key Features**:
- Create ticket with all related data in one API call
- Update ticket and all associated entities simultaneously
- Delete ticket with optional cleanup of related data
- Automatic find-or-create logic for company, site, and contact
- Validation of merchandise-site relationships
- Complete data return including all relationships

---

## Table of Contents

1. [Create Master Ticket](#create-master-ticket)
2. [Update Master Ticket](#update-master-ticket)
3. [Delete Master Ticket](#delete-master-ticket)
4. [Request Body Examples](#request-body-examples)
5. [Common Use Cases](#common-use-cases)
6. [Error Handling](#error-handling)

---

## Create Master Ticket

Create a new ticket with all related data in a single operation.

**Endpoint**: `POST /master`

**Required Level**: 1 (non-technician_l1 and above)

### Request Body Structure

```typescript
{
  // REQUIRED: Ticket information
  ticket: {
    details?: string;                    // Ticket description/details
    work_type_id: string;                // UUID - Work type (REQUIRED)
    assigner_id: string;                 // UUID - Employee who assigns the ticket (REQUIRED)
    status_id: string;                   // UUID - Ticket status (REQUIRED)
    additional?: string;                 // Additional information
  },

  // OPTIONAL: Company information (find or create)
  company?: {
    tax_id: string;                      // 13-digit tax ID (company primary key)
    name_th?: string;                    // Thai company name
    name_en?: string;                    // English company name
    address_detail?: string;             // Address details
    // ... other company fields
  },

  // OPTIONAL: Site information (find or create)
  site?: {
    id?: string;                         // If provided, uses existing site
    name?: string;                       // Site name
    address_detail?: string;             // Site address
    subdistrict_code?: number;           // Subdistrict code
    postal_code?: number;                // Postal code
    district_code?: number;              // District code
    province_code?: number;              // Province code
    map_url?: string;                    // Google Maps URL
    company_id?: string;                 // Will use company.tax_id if company provided
  },

  // OPTIONAL: Contact information (find or create)
  contact?: {
    id?: string;                         // If provided, uses existing contact
    person_name?: string;                // Contact person name
    nickname?: string;                   // Nickname
    phone?: string[];                    // Array of phone numbers
    email?: string[];                    // Array of email addresses
    line_id?: string;                    // LINE ID
    note?: string;                       // Notes
  },

  // OPTIONAL: Appointment information
  appointment?: {
    appointment_date?: string;           // DATE format: YYYY-MM-DD
    appointment_time_start?: string;     // TIME format: HH:MM:SS
    appointment_time_end?: string;       // TIME format: HH:MM:SS
    appointment_type?: 'call_to_schedule' | 'scheduled' | 'backlog';
  },

  // OPTIONAL: Employee assignments (technicians)
  employee_ids?: string[];               // Array of employee UUIDs

  // OPTIONAL: Merchandise associations
  merchandise_ids?: string[];            // Array of merchandise UUIDs
}
```

### Required Fields

Only these fields are **required** in the request:
- `ticket.work_type_id`
- `ticket.assigner_id`
- `ticket.status_id`

All other fields are optional and can be omitted or included as needed.

### Find-or-Create Logic

The API uses intelligent find-or-create logic for related entities:

1. **Company**:
   - If `company.tax_id` matches existing → Uses existing company (updates if additional fields provided)
   - If not found → Creates new company

2. **Site**:
   - If `site.id` provided → Uses that existing site
   - If `site.name` + `site.company_id` match existing → Uses existing site
   - Otherwise → Creates new site

3. **Contact**:
   - If `contact.id` provided → Uses that existing contact
   - If `contact.person_name` + `contact.site_id` match existing → Uses existing contact
   - Otherwise → Creates new contact

### Response (201 Created)

Returns complete ticket data with all relationships:

```json
{
  "data": {
    "id": "ticket-uuid",
    "details": "Ticket details",
    "work_type_id": "work-type-uuid",
    "assigner_id": "employee-uuid",
    "status_id": "status-uuid",
    "additional": "Additional info",
    "site_id": "site-uuid",
    "contact_id": "contact-uuid",
    "appointment_id": "appointment-uuid",
    "created_at": "2025-11-19T00:00:00Z",
    "updated_at": "2025-11-19T00:00:00Z",
    
    // Expanded relationships
    "work_type": { /* work type object */ },
    "assigner": { /* employee object */ },
    "status": { /* ticket status object */ },
    "site": {
      /* site object */,
      "company": { /* company object */ }
    },
    "contact": { /* contact object */ },
    "appointment": { /* appointment object */ },
    "employees": [ /* array of assigned employees */ ],
    "merchandise": [ /* array of linked merchandise */ ]
  }
}
```

### Example Request

```json
{
  "ticket": {
    "details": "เครื่องปริ้นเตอร์เสีย ไม่สามารถพิมพ์เอกสารได้",
    "work_type_id": "123e4567-e89b-12d3-a456-426614174001",
    "assigner_id": "123e4567-e89b-12d3-a456-426614174002",
    "status_id": "123e4567-e89b-12d3-a456-426614174003",
    "additional": "ต้องการช่างด่วน"
  },
  "company": {
    "tax_id": "0123456789012",
    "name_th": "บริษัท ทดสอบ จำกัด",
    "name_en": "Test Company Limited"
  },
  "site": {
    "name": "สำนักงานใหญ่",
    "address_detail": "123 ถนนสุขุมวิท",
    "postal_code": 10110,
    "map_url": "https://maps.google.com/..."
  },
  "contact": {
    "person_name": "คุณสมชาย",
    "nickname": "ชาย",
    "phone": ["0812345678", "021234567"],
    "email": ["somchai@test.com"]
  },
  "appointment": {
    "appointment_date": "2025-11-20",
    "appointment_time_start": "09:00:00",
    "appointment_time_end": "12:00:00",
    "appointment_type": "scheduled"
  },
  "employee_ids": [
    "employee-uuid-1",
    "employee-uuid-2"
  ],
  "merchandise_ids": [
    "merchandise-uuid-1",
    "merchandise-uuid-2"
  ]
}
```

---

## Update Master Ticket

Update an existing ticket and all related data in a single operation.

**Endpoint**: `PUT /master/:id`

**Required Level**: 1 (non-technician_l1 and above)

**Path Parameters**:
- `id` (required): Ticket ID (UUID)

### Request Body Structure

Same structure as create, but **all fields are optional**. Only include the fields you want to update.

```typescript
{
  ticket?: { /* ticket fields to update */ },
  company?: { /* company fields to update/create */ },
  site?: { /* site fields to update/create */ },
  contact?: { /* contact fields to update/create */ },
  appointment?: { /* appointment fields to update/create */ },
  employee_ids?: string[],        // Replaces all employee assignments
  merchandise_ids?: string[]      // Replaces all merchandise associations
}
```

### Update Behavior

1. **Ticket**: Updates provided fields only
2. **Company**: Updates if exists, creates if doesn't exist
3. **Site**:
   - If `site.id` provided → Updates that site
   - If no `site.id` → Creates new site and links to ticket
4. **Contact**:
   - If `contact.id` provided → Updates that contact
   - If no `contact.id` → Creates new contact and links to ticket
5. **Appointment**:
   - If ticket has appointment → Updates it
   - If ticket has no appointment → Creates new appointment
6. **Employee IDs**: **Replaces all** existing employee assignments
7. **Merchandise IDs**: **Replaces all** existing merchandise associations

### Important Notes

- **Replacement behavior**: 
  - If you provide `employee_ids`, it replaces ALL existing employee assignments
  - If you provide `merchandise_ids`, it replaces ALL existing merchandise associations
  - To keep existing assignments, **omit** those fields from the request

- **Partial updates**:
  - You can update only the ticket without touching related data
  - You can update only specific relationships
  - Omitted fields remain unchanged

- **Clearing fields with `null`**:
  - Set `site: null` to clear/unlink the site from ticket
  - Set `contact: null` to clear/unlink the contact from ticket
  - Set `appointment: null` to unlink the appointment from ticket
  - This is different from omitting the field (which keeps existing value)

### Response (200 OK)

Returns complete updated ticket data with all relationships (same structure as create).

### Example Request - Full Update

```json
{
  "ticket": {
    "details": "อัพเดทรายละเอียด: เครื่องปริ้นเตอร์เสีย แก้ไขแล้ว",
    "status_id": "completed-status-uuid"
  },
  "appointment": {
    "appointment_date": "2025-11-21",
    "appointment_time_start": "14:00:00",
    "appointment_time_end": "16:00:00"
  },
  "employee_ids": [
    "employee-uuid-3"  // This REPLACES all existing employees
  ]
}
```

### Example Request - Partial Update (Ticket Only)

```json
{
  "ticket": {
    "status_id": "completed-status-uuid",
    "additional": "เสร็จสิ้นแล้ว"
  }
  // No other fields - all relationships remain unchanged
}
```

### Example Request - Update Site Link

```json
{
  "site": {
    "id": "different-site-uuid"  // Change ticket to different existing site
  }
}
```

### Example Request - Update Contact Information

```json
{
  "contact": {
    "id": "existing-contact-uuid",  // Update this contact
    "phone": ["0899999999"],        // Update phone number
    "note": "ติดต่อเวลาทำการเท่านั้น"
  }
}
```

### Example Request - Clear Contact/Site

```json
{
  "contact": null  // Clear the contact link from ticket
}
```

```json
{
  "site": null,      // Clear the site link
  "contact": null    // Also clear the contact link
}
```

### Example Request - Unlink Appointment

```json
{
  "appointment": null  // Unlink appointment (ticket becomes backlog)
}
```

---

## Delete Master Ticket

Delete a ticket and optionally clean up related data.

**Endpoint**: `DELETE /master/:id`

**Required Level**: 2 (supervisor and above)

**Path Parameters**:
- `id` (required): Ticket ID (UUID)

**Query Parameters**:
- `delete_appointment` (optional): `true` to also delete the appointment (default: `false`)
- `delete_contact` (optional): `true` to delete contact if no other tickets use it (default: `false`)

### Delete Behavior

1. **Always deleted**:
   - Ticket record
   - Ticket-employee associations (via cascade)
   - Ticket-merchandise associations (via cascade)

2. **Optionally deleted**:
   - Appointment (if `delete_appointment=true`)
   - Contact (if `delete_contact=true` AND no other tickets use the contact)

3. **Never deleted**:
   - Site (may be used by other tickets/contacts)
   - Company (may be used by other sites)
   - Employees (system users)
   - Merchandise (may be linked to other tickets)

### Response (200 OK)

```json
{
  "data": {
    "message": "ลบตั๋วงานสำเร็จ"
  }
}
```

### Example Requests

```bash
# Delete ticket only (keep appointment and contact)
DELETE /master/ticket-uuid

# Delete ticket and appointment
DELETE /master/ticket-uuid?delete_appointment=true

# Delete ticket, appointment, and contact (if not used by other tickets)
DELETE /master/ticket-uuid?delete_appointment=true&delete_contact=true
```

---

## Request Body Examples

### Minimal Create (Required Fields Only)

```json
{
  "ticket": {
    "work_type_id": "work-type-uuid",
    "assigner_id": "employee-uuid",
    "status_id": "status-uuid"
  }
}
```

### Create with Company and Site

```json
{
  "ticket": {
    "details": "ซ่อมเครื่องปรับอากาศ",
    "work_type_id": "work-type-uuid",
    "assigner_id": "employee-uuid",
    "status_id": "status-uuid"
  },
  "company": {
    "tax_id": "0123456789012",
    "name_th": "บริษัท ABC จำกัด"
  },
  "site": {
    "name": "สำนักงานสาขา 1",
    "address_detail": "456 ถนนพระราม 9",
    "postal_code": 10310
  }
}
```

### Create with Existing Site

```json
{
  "ticket": {
    "details": "ซ่อมคอมพิวเตอร์",
    "work_type_id": "work-type-uuid",
    "assigner_id": "employee-uuid",
    "status_id": "status-uuid"
  },
  "site": {
    "id": "existing-site-uuid"  // Use existing site
  },
  "contact": {
    "person_name": "คุณสมหญิง",
    "phone": ["0898765432"]
  },
  "employee_ids": ["tech-uuid-1", "tech-uuid-2"]
}
```

### Create Backlog Ticket (No Appointment)

```json
{
  "ticket": {
    "details": "งานรอดำเนินการ",
    "work_type_id": "work-type-uuid",
    "assigner_id": "employee-uuid",
    "status_id": "pending-status-uuid"
  },
  "site": {
    "id": "site-uuid"
  },
  "employee_ids": ["tech-uuid-1"]
  // No appointment field - ticket will be in backlog
}
```

### Create with Merchandise

```json
{
  "ticket": {
    "details": "PM เครื่องปริ้นเตอร์",
    "work_type_id": "pm-work-type-uuid",
    "assigner_id": "employee-uuid",
    "status_id": "status-uuid"
  },
  "site": {
    "id": "site-uuid"
  },
  "merchandise_ids": [
    "printer-uuid-1",
    "printer-uuid-2"
  ],
  "appointment": {
    "appointment_date": "2025-11-25",
    "appointment_type": "scheduled"
  }
}
```

### Update Status Only

```json
{
  "ticket": {
    "status_id": "completed-status-uuid"
  }
}
```

### Update Appointment

```json
{
  "appointment": {
    "appointment_date": "2025-11-22",
    "appointment_time_start": "10:00:00",
    "appointment_time_end": "12:00:00"
  }
}
```

### Replace Technicians

```json
{
  "employee_ids": [
    "new-tech-uuid-1",
    "new-tech-uuid-2"
  ]
  // This replaces all existing employee assignments
}
```

### Update Multiple Fields

```json
{
  "ticket": {
    "details": "อัพเดทรายละเอียด",
    "status_id": "in-progress-status-uuid"
  },
  "contact": {
    "id": "contact-uuid",
    "phone": ["0811111111"],
    "note": "ติดต่อหลัง 13:00"
  },
  "employee_ids": ["tech-uuid-1"]
}
```

---

## Field Update Behavior

Understanding how field updates work:

| Action | Example | Result |
|--------|---------|--------|
| **Omit field** | `{}` (no `contact` field) | Keeps existing contact unchanged |
| **Set to null** | `{ "contact": null }` | Clears/unlinks contact from ticket |
| **Provide data** | `{ "contact": { "id": "..." } }` | Links to specified contact |
| **Empty array** | `{ "employee_ids": [] }` | Removes all employee assignments |
| **Omit array** | `{}` (no `employee_ids`) | Keeps existing employees unchanged |

### Examples

```json
// Keep everything, only update status
{
  "ticket": { "status_id": "completed-uuid" }
}
// Result: Contact, site, appointment all remain unchanged
```

```json
// Clear contact but keep site
{
  "contact": null
}
// Result: Contact cleared, site unchanged
```

```json
// Clear all employees
{
  "employee_ids": []
}
// Result: All employee assignments removed
```

```json
// Replace employees
{
  "employee_ids": ["tech1-uuid", "tech2-uuid"]
}
// Result: Old employees removed, new ones assigned
```

---

## Common Use Cases

### Use Case 1: Create Ticket for New Customer

When a new customer calls for service:

```json
{
  "ticket": {
    "details": "ลูกค้าใหม่ ต้องการบริการติดตั้งเครื่องปริ้นเตอร์",
    "work_type_id": "installation-work-type-uuid",
    "assigner_id": "call-center-employee-uuid",
    "status_id": "new-status-uuid"
  },
  "company": {
    "tax_id": "1234567890123",
    "name_th": "บริษัท ลูกค้าใหม่ จำกัด",
    "address_detail": "789 ถนนลาดพร้าว"
  },
  "site": {
    "name": "สำนักงานใหญ่",
    "address_detail": "789 ถนนลาดพร้าว",
    "postal_code": 10230
  },
  "contact": {
    "person_name": "คุณประกิต",
    "phone": ["0887654321"],
    "email": ["prakit@newcustomer.com"]
  },
  "appointment": {
    "appointment_type": "call_to_schedule"
  }
}
```

### Use Case 2: Create Ticket for Existing Customer Site

```json
{
  "ticket": {
    "details": "เครื่องถ่ายเอกสารขัดข้อง",
    "work_type_id": "repair-work-type-uuid",
    "assigner_id": "employee-uuid",
    "status_id": "new-status-uuid"
  },
  "site": {
    "id": "existing-site-uuid"
  },
  "contact": {
    "id": "existing-contact-uuid"
  },
  "merchandise_ids": ["copier-uuid"],
  "appointment": {
    "appointment_date": "2025-11-21",
    "appointment_time_start": "09:00:00",
    "appointment_time_end": "11:00:00",
    "appointment_type": "scheduled"
  },
  "employee_ids": ["tech-uuid-1"]
}
```

### Use Case 3: Assign Technician and Schedule

Update a backlog ticket to assign technician and schedule:

```json
{
  "appointment": {
    "appointment_date": "2025-11-23",
    "appointment_time_start": "14:00:00",
    "appointment_time_end": "16:00:00",
    "appointment_type": "scheduled"
  },
  "employee_ids": ["tech-uuid-1", "tech-uuid-2"]
}
```

### Use Case 4: Complete Ticket

```json
{
  "ticket": {
    "status_id": "completed-status-uuid",
    "additional": "งานเสร็จสมบูรณ์ แก้ไขปัญหาเรียบร้อย"
  }
}
```

### Use Case 5: Reschedule Appointment

```json
{
  "appointment": {
    "appointment_date": "2025-11-25",
    "appointment_time_start": "10:00:00",
    "appointment_time_end": "12:00:00"
  }
}
```

### Use Case 6: Change Site

Move ticket to different site:

```json
{
  "site": {
    "id": "different-site-uuid"
  },
  "contact": {
    "id": "contact-at-different-site-uuid"
  },
  "merchandise_ids": []  // Clear merchandise (they were at old site)
}
```

---

## Error Handling

### Validation Errors (400)

```json
{
  "error": "กรุณาระบุประเภทงาน"
}
```

Common validation errors:
- Missing required fields (work_type_id, assigner_id, status_id)
- Invalid UUID format
- Merchandise not in same site as ticket
- Invalid appointment date/time format

### Not Found Errors (404)

```json
{
  "error": "ไม่พบตั๋วงาน"
}
```

Occurs when:
- Ticket ID doesn't exist (for update/delete)
- Referenced employee doesn't exist
- Referenced merchandise doesn't exist

### Authorization Errors (403)

```json
{
  "error": "ไม่มีสิทธิ์เข้าถึง"
}
```

Occurs when:
- User level insufficient for operation
- Create/Update requires level 1+
- Delete requires level 2+

### Database Errors (500)

```json
{
  "error": "ไม่สามารถสร้างตั๋วงานได้: <error details>"
}
```

Occurs when:
- Database connection issues
- Constraint violations
- Foreign key errors

---

## Best Practices

### 1. Use Existing IDs When Possible

```json
{
  "site": {
    "id": "existing-site-uuid"  // Use existing site
  },
  "contact": {
    "id": "existing-contact-uuid"  // Use existing contact
  }
}
```

### 2. Minimal Updates

Only include fields you want to change:

```json
{
  "ticket": {
    "status_id": "new-status-uuid"  // Only update status
  }
}
```

### 3. Validate Before Submit

- Ensure UUIDs are valid
- Check date formats (YYYY-MM-DD)
- Check time formats (HH:MM:SS)
- Verify merchandise belongs to same site

### 4. Handle Merchandise Carefully

If updating merchandise, include ALL desired merchandise:

```json
{
  "merchandise_ids": [
    "keep-this-uuid",
    "and-this-uuid",
    "add-this-new-uuid"
  ]
  // This replaces entire list
}
```

### 5. Use Query Parameters for Delete Options

```bash
# Clean delete with appointment
DELETE /master/ticket-uuid?delete_appointment=true

# Full cleanup (if contact unused)
DELETE /master/ticket-uuid?delete_appointment=true&delete_contact=true
```

---

## Comparison: Master API vs Individual APIs

### Before (Multiple API Calls)

```javascript
// 1. Create/find company
const company = await POST('/api-companies', companyData);

// 2. Create/find site
const site = await POST('/api-sites', { ...siteData, company_id: company.tax_id });

// 3. Create/find contact
const contact = await POST('/api-contacts', { ...contactData, site_id: site.id });

// 4. Create ticket
const ticket = await POST('/api-tickets', {
  ...ticketData,
  site_id: site.id,
  contact_id: contact.id
});

// 5. Create appointment
const appointment = await POST('/api-appointments', {
  ...appointmentData,
  ticket_id: ticket.id
});

// 6. Link employees
await POST(`/api-tickets/${ticket.id}/employees`, { employee_ids: [...] });

// 7. Link merchandise
for (const merchId of merchandiseIds) {
  await POST(`/api-tickets/${ticket.id}/merchandise`, { merchandise_id: merchId });
}

// Result: 7+ API calls with complex error handling
```

### After (Single API Call)

```javascript
// Create everything at once
const ticket = await POST('/api-tickets/master', {
  ticket: ticketData,
  company: companyData,
  site: siteData,
  contact: contactData,
  appointment: appointmentData,
  employee_ids: [...],
  merchandise_ids: [...]
});

// Result: 1 API call, atomic operation, complete response
```

### Benefits

✅ **Simpler code** - One API call instead of many  
✅ **Better performance** - Reduced network overhead  
✅ **Atomic operations** - All-or-nothing transaction-like behavior  
✅ **Less error handling** - Single error handling point  
✅ **Complete data** - Returns all relationships in one response  
✅ **Find-or-create** - Automatic deduplication of companies/sites/contacts  

---

## Notes

- All master operations return complete ticket data with all relationships expanded
- Find-or-create logic prevents duplicate companies, sites, and contacts
- Merchandise must belong to the same site as the ticket (enforced at database level)
- Employee and merchandise associations use **replacement** logic when updated
- Deleting a ticket automatically cascades to ticket_employees and ticket_merchandise
- The master API is transactional - if any step fails, no data is created/modified
- Use individual APIs (GET /api-tickets/:id, etc.) for reading individual tickets
- Master API is optimized for **write operations** (create/update/delete)

---

## Related Documentation

- [Regular Tickets API](./README.md) - Individual ticket operations
- [Appointments API](../api-appointments/README.md) - Appointment management
- [Sites API](../api-sites/README.md) - Site management
- [Companies API](../api-companies/README.md) - Company management
- [Contacts API](../api-contacts/README.md) - Contact management
- [Employees API](../api-employees/README.md) - Employee management

