# Master Ticket API - cURL & Postman Examples

This document provides ready-to-use cURL commands and Postman examples for the Master Ticket API.

---

## Prerequisites

Replace these variables with your actual values:

```bash
export API_URL="https://your-project.supabase.co/functions/v1"
export JWT_TOKEN="your-jwt-token-here"
```

---

## 1. Create Master Ticket - New Customer

### cURL

```bash
curl -X POST "${API_URL}/api-tickets/master" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "ticket": {
      "details": "ลูกค้าใหม่ รายงานปัญหาเครื่องปริ้นเตอร์เสีย ไม่สามารถพิมพ์เอกสารได้",
      "work_type_id": "123e4567-e89b-12d3-a456-426614174001",
      "assigner_id": "123e4567-e89b-12d3-a456-426614174002",
      "status_id": "123e4567-e89b-12d3-a456-426614174003",
      "additional": "ต้องการช่างด่วน วันนี้"
    },
    "company": {
      "tax_id": "0123456789012",
      "name_th": "บริษัท ทดสอบระบบ จำกัด",
      "name_en": "Test System Company Limited",
      "address_detail": "เลขที่ 123 ถนนสุขุมวิท แขวงคลองเตย เขตคลองเตย กรุงเทพฯ"
    },
    "site": {
      "name": "สำนักงานใหญ่",
      "address_detail": "เลขที่ 123 ถนนสุขุมวิท แขวงคลองเตย",
      "postal_code": 10110,
      "map_url": "https://maps.google.com/maps?q=13.7563,100.5018"
    },
    "contact": {
      "person_name": "คุณสมชาย ใจดี",
      "nickname": "ชาย",
      "phone": ["0812345678", "021234567"],
      "email": ["somchai@testcompany.com"],
      "line_id": "somchai123"
    },
    "appointment": {
      "appointment_date": "2025-11-20",
      "appointment_time_start": "09:00:00",
      "appointment_time_end": "12:00:00",
      "appointment_type": "scheduled"
    },
    "employee_ids": [
      "tech-uuid-1",
      "tech-uuid-2"
    ]
  }'
```

### Postman

```json
POST {{API_URL}}/api-tickets/master
Headers:
  Authorization: Bearer {{JWT_TOKEN}}
  Content-Type: application/json

Body (raw JSON):
{
  "ticket": {
    "details": "ลูกค้าใหม่ รายงานปัญหาเครื่องปริ้นเตอร์เสีย ไม่สามารถพิมพ์เอกสารได้",
    "work_type_id": "{{work_type_uuid}}",
    "assigner_id": "{{assigner_uuid}}",
    "status_id": "{{status_uuid}}",
    "additional": "ต้องการช่างด่วน วันนี้"
  },
  "company": {
    "tax_id": "0123456789012",
    "name_th": "บริษัท ทดสอบระบบ จำกัด",
    "name_en": "Test System Company Limited"
  },
  "site": {
    "name": "สำนักงานใหญ่",
    "address_detail": "123 ถนนสุขุมวิท",
    "postal_code": 10110
  },
  "contact": {
    "person_name": "คุณสมชาย ใจดี",
    "nickname": "ชาย",
    "phone": ["0812345678"],
    "email": ["somchai@test.com"]
  },
  "appointment": {
    "appointment_date": "2025-11-20",
    "appointment_time_start": "09:00:00",
    "appointment_time_end": "12:00:00",
    "appointment_type": "scheduled"
  },
  "employee_ids": ["{{tech_uuid_1}}", "{{tech_uuid_2}}"]
}
```

---

## 2. Create Master Ticket - Existing Customer

### cURL

```bash
curl -X POST "${API_URL}/api-tickets/master" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "ticket": {
      "details": "เครื่องถ่ายเอกสารขัดข้อง แจ้งปัญหาจากลูกค้าเก่า",
      "work_type_id": "repair-work-type-uuid",
      "assigner_id": "assigner-uuid",
      "status_id": "new-status-uuid"
    },
    "site": {
      "id": "existing-site-uuid"
    },
    "contact": {
      "id": "existing-contact-uuid"
    },
    "merchandise_ids": ["copier-uuid-1"],
    "appointment": {
      "appointment_date": "2025-11-21",
      "appointment_time_start": "14:00:00",
      "appointment_time_end": "16:00:00",
      "appointment_type": "scheduled"
    },
    "employee_ids": ["tech-uuid-1"]
  }'
```

---

## 3. Create Backlog Ticket (No Appointment)

### cURL

```bash
curl -X POST "${API_URL}/api-tickets/master" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "ticket": {
      "details": "งานรอดำเนินการ - PM เครื่องปริ้นเตอร์ประจำเดือน",
      "work_type_id": "pm-work-type-uuid",
      "assigner_id": "assigner-uuid",
      "status_id": "pending-status-uuid",
      "additional": "รอการนัดหมาย"
    },
    "site": {
      "id": "site-uuid"
    },
    "merchandise_ids": ["printer-uuid-1", "printer-uuid-2"],
    "employee_ids": ["tech-uuid-1"]
  }'
```

---

## 4. Create Minimal Ticket (Required Fields Only)

### cURL

```bash
curl -X POST "${API_URL}/api-tickets/master" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "ticket": {
      "work_type_id": "work-type-uuid",
      "assigner_id": "assigner-uuid",
      "status_id": "new-status-uuid"
    }
  }'
```

---

## 5. Update Ticket Status

### cURL

```bash
curl -X PUT "${API_URL}/api-tickets/master/ticket-uuid-here" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "ticket": {
      "status_id": "completed-status-uuid",
      "additional": "งานเสร็จสมบูรณ์ แก้ไขปัญหาเรียบร้อย"
    }
  }'
```

### Postman

```json
PUT {{API_URL}}/api-tickets/master/{{ticket_id}}
Headers:
  Authorization: Bearer {{JWT_TOKEN}}
  Content-Type: application/json

Body:
{
  "ticket": {
    "status_id": "{{completed_status_uuid}}"
  }
}
```

---

## 6. Reschedule Appointment

### cURL

```bash
curl -X PUT "${API_URL}/api-tickets/master/ticket-uuid-here" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "appointment": {
      "appointment_date": "2025-11-25",
      "appointment_time_start": "10:00:00",
      "appointment_time_end": "12:00:00"
    }
  }'
```

---

## 7. Assign/Reassign Technicians

### cURL

```bash
curl -X PUT "${API_URL}/api-tickets/master/ticket-uuid-here" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "employee_ids": ["tech-uuid-1", "tech-uuid-2", "tech-uuid-3"]
  }'
```

**⚠️ Note**: This **replaces** all existing employee assignments.

---

## 8. Add/Replace Merchandise

### cURL

```bash
curl -X PUT "${API_URL}/api-tickets/master/ticket-uuid-here" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "merchandise_ids": [
      "merchandise-uuid-1",
      "merchandise-uuid-2",
      "merchandise-uuid-3"
    ]
  }'
```

**⚠️ Note**: This **replaces** all existing merchandise associations.

---

## 9. Update Contact Information

### cURL

```bash
curl -X PUT "${API_URL}/api-tickets/master/ticket-uuid-here" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "contact": {
      "id": "contact-uuid",
      "phone": ["0899999999", "021111111"],
      "note": "ติดต่อเวลาทำการเท่านั้น 9:00-17:00"
    }
  }'
```

---

## 10. Update Multiple Fields

### cURL

```bash
curl -X PUT "${API_URL}/api-tickets/master/ticket-uuid-here" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "ticket": {
      "details": "อัพเดทรายละเอียด: แก้ไขปัญหาเครื่องปริ้นเตอร์เสร็จแล้ว",
      "status_id": "completed-status-uuid",
      "additional": "เปลี่ยนหมึกพิมพ์และทำความสะอาดหัวพิมพ์"
    },
    "appointment": {
      "appointment_date": "2025-11-22"
    },
    "employee_ids": ["tech-uuid-1"]
  }'
```

---

## 11. Change Site and Contact

### cURL

```bash
curl -X PUT "${API_URL}/api-tickets/master/ticket-uuid-here" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "site": {
      "id": "different-site-uuid"
    },
    "contact": {
      "id": "contact-at-different-site-uuid"
    },
    "merchandise_ids": []
  }'
```

**Note**: Clear merchandise when changing site (they may belong to old site).

---

## 11a. Clear Contact from Ticket

### cURL

```bash
curl -X PUT "${API_URL}/api-tickets/master/ticket-uuid-here" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "contact": null
  }'
```

**Note**: Setting `contact: null` clears/unlinks the contact from the ticket. This is different from omitting the field (which keeps existing contact unchanged).

---

## 11b. Clear Site and Contact

### cURL

```bash
curl -X PUT "${API_URL}/api-tickets/master/ticket-uuid-here" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "site": null,
    "contact": null
  }'
```

---

## 11c. Unlink Appointment (Make Backlog)

### cURL

```bash
curl -X PUT "${API_URL}/api-tickets/master/ticket-uuid-here" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "appointment": null
  }'
```

**Note**: This unlinks the appointment from the ticket, effectively making it a backlog ticket (no scheduled date/time).

---

## 12. Delete Ticket Only

### cURL

```bash
curl -X DELETE "${API_URL}/api-tickets/master/ticket-uuid-here" \
  -H "Authorization: Bearer ${JWT_TOKEN}"
```

### Postman

```
DELETE {{API_URL}}/api-tickets/master/{{ticket_id}}
Headers:
  Authorization: Bearer {{JWT_TOKEN}}
```

---

## 13. Delete Ticket with Appointment

### cURL

```bash
curl -X DELETE "${API_URL}/api-tickets/master/ticket-uuid-here?delete_appointment=true" \
  -H "Authorization: Bearer ${JWT_TOKEN}"
```

---

## 14. Delete Ticket with Full Cleanup

### cURL

```bash
curl -X DELETE "${API_URL}/api-tickets/master/ticket-uuid-here?delete_appointment=true&delete_contact=true" \
  -H "Authorization: Bearer ${JWT_TOKEN}"
```

**Note**: Contact will only be deleted if no other tickets use it.

---

## Postman Collection

### Environment Variables

Set these in your Postman environment:

```json
{
  "API_URL": "https://your-project.supabase.co/functions/v1",
  "JWT_TOKEN": "your-jwt-token",
  "work_type_uuid": "uuid-here",
  "assigner_uuid": "uuid-here",
  "status_uuid": "uuid-here",
  "tech_uuid_1": "uuid-here",
  "tech_uuid_2": "uuid-here",
  "site_uuid": "uuid-here",
  "contact_uuid": "uuid-here",
  "ticket_id": "uuid-here"
}
```

### Pre-request Script (for all requests)

```javascript
// Automatically add Authorization header
pm.request.headers.add({
  key: 'Authorization',
  value: 'Bearer ' + pm.environment.get('JWT_TOKEN')
});
```

### Test Script (for success responses)

```javascript
// Check status code
pm.test("Status code is 200 or 201", function () {
  pm.expect(pm.response.code).to.be.oneOf([200, 201]);
});

// Parse response
const jsonData = pm.response.json();

// Check response structure
pm.test("Response has data", function () {
  pm.expect(jsonData).to.have.property('data');
});

// Save ticket ID for next requests
if (jsonData.data && jsonData.data.id) {
  pm.environment.set('ticket_id', jsonData.data.id);
  console.log('Ticket ID saved:', jsonData.data.id);
}
```

---

## Testing Workflow

### Complete Ticket Lifecycle

```bash
# 1. Create ticket
TICKET_ID=$(curl -X POST "${API_URL}/api-tickets/master" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{ "ticket": { ... } }' \
  | jq -r '.data.id')

echo "Created ticket: $TICKET_ID"

# 2. Assign technicians
curl -X PUT "${API_URL}/api-tickets/master/${TICKET_ID}" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{ "employee_ids": ["tech-uuid"] }'

# 3. Update status
curl -X PUT "${API_URL}/api-tickets/master/${TICKET_ID}" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{ "ticket": { "status_id": "completed-uuid" } }'

# 4. Get ticket details
curl -X GET "${API_URL}/api-tickets/${TICKET_ID}" \
  -H "Authorization: Bearer ${JWT_TOKEN}"

# 5. Delete ticket
curl -X DELETE "${API_URL}/api-tickets/master/${TICKET_ID}?delete_appointment=true" \
  -H "Authorization: Bearer ${JWT_TOKEN}"
```

---

## Common Issues & Solutions

### Issue: 400 - Missing required fields

**Solution**: Ensure ticket object has `work_type_id`, `assigner_id`, and `status_id`:

```json
{
  "ticket": {
    "work_type_id": "uuid",
    "assigner_id": "uuid",
    "status_id": "uuid"
  }
}
```

### Issue: 400 - Invalid UUID format

**Solution**: Verify all UUIDs are in format: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`

### Issue: 400 - Merchandise not in same site

**Solution**: Ensure all merchandise belong to the same site as the ticket.

### Issue: 401 - Unauthorized

**Solution**: Check JWT token is valid and not expired.

### Issue: 403 - Forbidden

**Solution**: Check user level (create/update requires level 1+, delete requires level 2+).

### Issue: 404 - Not found

**Solution**: Verify ticket/site/contact ID exists in database.

---

## Response Examples

### Success Response (Create)

```json
{
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "details": "เครื่องปริ้นเตอร์เสีย",
    "work_type_id": "work-type-uuid",
    "assigner_id": "assigner-uuid",
    "status_id": "status-uuid",
    "site_id": "site-uuid",
    "contact_id": "contact-uuid",
    "appointment_id": "appointment-uuid",
    "created_at": "2025-11-19T10:30:00Z",
    "updated_at": "2025-11-19T10:30:00Z",
    "work_type": { "id": "...", "name": "ซ่อม" },
    "assigner": { "id": "...", "name_th": "..." },
    "status": { "id": "...", "name": "ใหม่" },
    "site": {
      "id": "...",
      "name": "สำนักงานใหญ่",
      "company": {
        "tax_id": "...",
        "name_th": "บริษัท..."
      }
    },
    "contact": {
      "id": "...",
      "person_name": "คุณสมชาย",
      "phone": ["0812345678"]
    },
    "appointment": {
      "id": "...",
      "appointment_date": "2025-11-20",
      "appointment_time_start": "09:00:00"
    },
    "employees": [
      { "id": "...", "name_th": "..." }
    ],
    "merchandise": [
      { "id": "...", "serial_no": "..." }
    ]
  }
}
```

### Error Response

```json
{
  "error": "กรุณาระบุประเภทงาน"
}
```

---

## Additional Resources

- [Master Ticket API Documentation](./MASTER-TICKET-API.md)
- [Quick Reference Card](./MASTER-API-QUICK-REFERENCE.md)
- [Individual Tickets API](./README.md)

