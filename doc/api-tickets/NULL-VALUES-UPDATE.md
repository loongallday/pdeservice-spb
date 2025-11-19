# Master Ticket API - Null Values Support

## Overview

**Issue**: When sending `null` for optional fields like `contact`, `site`, or `appointment` in PUT requests, the API didn't clear these values.

**Fix**: Updated the Master Ticket API to properly handle explicit `null` values to clear/unlink optional fields.

**Date**: November 19, 2025

---

## What Changed

### Before

```json
PUT /api-tickets/master/:id
{
  "contact": null
}
```

**Result**: Field was ignored, existing contact remained unchanged ❌

### After

```json
PUT /api-tickets/master/:id
{
  "contact": null
}
```

**Result**: Contact is cleared/unlinked from ticket ✅

---

## Field Behavior

The API now supports three distinct behaviors for optional fields:

| Action | Syntax | Behavior |
|--------|--------|----------|
| **Keep unchanged** | Omit field from request | Existing value remains |
| **Clear/unlink** | Set field to `null` | Field is set to NULL |
| **Update/link** | Provide value/object | Field is updated/created |

### Examples

#### 1. Keep Contact Unchanged

```json
{
  "ticket": {
    "status_id": "completed-uuid"
  }
  // No "contact" field - existing contact remains
}
```

#### 2. Clear Contact

```json
{
  "contact": null
  // Explicit null - contact is cleared/unlinked
}
```

#### 3. Update/Link Contact

```json
{
  "contact": {
    "id": "contact-uuid"
  }
  // Links to specified contact
}
```

---

## Supported Fields

The following fields now support explicit `null` to clear:

### 1. site

```json
{
  "site": null  // Clear site link from ticket
}
```

**Effect**: `ticket.site_id` becomes `NULL`

### 2. contact

```json
{
  "contact": null  // Clear contact link from ticket
}
```

**Effect**: `ticket.contact_id` becomes `NULL`

### 3. appointment

```json
{
  "appointment": null  // Unlink appointment from ticket
}
```

**Effect**: `ticket.appointment_id` becomes `NULL` (ticket becomes backlog)

---

## Use Cases

### Use Case 1: Remove Contact from Ticket

**Scenario**: Customer contact is no longer valid, need to clear it.

```bash
curl -X PUT "${API_URL}/api-tickets/master/ticket-uuid" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "contact": null
  }'
```

### Use Case 2: Convert to Backlog Ticket

**Scenario**: Need to unschedule a ticket (remove appointment).

```bash
curl -X PUT "${API_URL}/api-tickets/master/ticket-uuid" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "appointment": null
  }'
```

### Use Case 3: Clear All Optional Relationships

**Scenario**: Reset ticket to minimal state.

```bash
curl -X PUT "${API_URL}/api-tickets/master/ticket-uuid" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "site": null,
    "contact": null,
    "appointment": null,
    "employee_ids": [],
    "merchandise_ids": []
  }'
```

---

## Technical Details

### Implementation

The fix uses JavaScript's `in` operator to distinguish between:
- Field not present in request object (`undefined`)
- Field present with `null` value
- Field present with data

**Code Pattern**:

```typescript
// Check if field exists in request
if ('contact' in input) {
  if (input.contact === null) {
    // Explicit null - clear it
    contactId = null;
  } else if (input.contact) {
    // Data provided - update/create
    contactId = await findOrCreateContact(input.contact);
  }
}
// If not in input, contactId remains unchanged
```

### Database Operations

When clearing a field:

**Site**:
```sql
UPDATE tickets SET site_id = NULL WHERE id = :ticket_id
```

**Contact**:
```sql
UPDATE tickets SET contact_id = NULL WHERE id = :ticket_id
```

**Appointment**:
```sql
UPDATE tickets SET appointment_id = NULL WHERE id = :ticket_id
```

---

## Type Definitions

Updated TypeScript interfaces to allow `null`:

```typescript
export interface MasterTicketUpdateInput {
  // ... other fields

  // Site - can be object or null to clear
  site?: {
    id?: string;
    name?: string;
    // ... other fields
  } | null;

  // Contact - can be object or null to clear
  contact?: {
    id?: string;
    person_name?: string;
    // ... other fields
  } | null;

  // Appointment - can be object or null to clear
  appointment?: {
    appointment_date?: string;
    appointment_time_start?: string;
    // ... other fields
  } | null;

  // ... other fields
}
```

---

## Comparison Table

| Scenario | Old Behavior | New Behavior |
|----------|-------------|-------------|
| Field omitted | Unchanged ✅ | Unchanged ✅ |
| Field = `null` | Ignored (unchanged) ❌ | Cleared ✅ |
| Field = `{}` | Unchanged ❌ | Unchanged ✅ |
| Field = data | Updated ✅ | Updated ✅ |
| Empty array | Cleared ✅ | Cleared ✅ |

---

## Testing

### Test Cases

1. **Clear contact with null**
   ```json
   PUT /api-tickets/master/:id
   { "contact": null }
   ```
   Expected: `ticket.contact_id` is NULL

2. **Keep contact by omitting**
   ```json
   PUT /api-tickets/master/:id
   { "ticket": { "status_id": "..." } }
   ```
   Expected: `ticket.contact_id` unchanged

3. **Clear multiple fields**
   ```json
   PUT /api-tickets/master/:id
   { "site": null, "contact": null, "appointment": null }
   ```
   Expected: All three IDs are NULL

4. **Mix update and clear**
   ```json
   PUT /api-tickets/master/:id
   {
     "ticket": { "status_id": "new-status" },
     "contact": null
   }
   ```
   Expected: Status updated, contact cleared

---

## Migration Notes

### For Existing Users

No breaking changes. Existing behavior preserved:
- Omitting fields still keeps them unchanged
- Providing data still updates/creates
- Only NEW behavior: `null` now clears fields

### Backward Compatibility

✅ 100% backward compatible
- Old clients that omit fields work as before
- Old clients that never send `null` work as before
- Only adds new capability

---

## Documentation Updates

Updated the following documentation:
- ✅ `MASTER-TICKET-API.md` - Added "Clearing fields with null" section
- ✅ `MASTER-API-QUICK-REFERENCE.md` - Added null clearing examples
- ✅ `EXAMPLES.md` - Added cURL examples for clearing fields
- ✅ `NULL-VALUES-UPDATE.md` - This document

---

## FAQ

### Q: What's the difference between omitting a field and setting it to null?

**A**: 
- **Omit field** (`{}` - no field in request): Keeps existing value unchanged
- **Set to null** (`{ "field": null }`): Explicitly clears the value

### Q: Can I clear employee_ids with null?

**A**: No, use empty array instead: `"employee_ids": []`

Employee IDs and merchandise IDs use array syntax, so:
- Omit field: Keeps existing
- Empty array `[]`: Clears all
- Array with values: Replaces all

### Q: What happens if I send null for site, but the ticket has merchandise linked to that site?

**A**: The site will be cleared. Merchandise associations are independent of the ticket's site_id field in the database.

### Q: Can I use null in the CREATE endpoint?

**A**: Yes, but it's not common. In CREATE, null and omitting the field have the same effect (field is not set).

### Q: What about the appointment? Is it deleted or just unlinked?

**A**: Just unlinked. The appointment record remains in the database, but `ticket.appointment_id` is set to NULL. The ticket becomes a backlog ticket.

---

## Examples Summary

### Clear Contact Only
```json
{ "contact": null }
```

### Clear Site and Contact
```json
{ "site": null, "contact": null }
```

### Unlink Appointment
```json
{ "appointment": null }
```

### Clear All Relationships
```json
{
  "site": null,
  "contact": null,
  "appointment": null,
  "employee_ids": [],
  "merchandise_ids": []
}
```

### Update Status and Clear Contact
```json
{
  "ticket": { "status_id": "completed-uuid" },
  "contact": null
}
```

---

## Related Documentation

- [Master Ticket API Documentation](./MASTER-TICKET-API.md)
- [Quick Reference](./MASTER-API-QUICK-REFERENCE.md)
- [Examples](./EXAMPLES.md)

---

## Summary

✅ **Fixed**: Sending `null` now properly clears optional fields  
✅ **Backward Compatible**: No breaking changes  
✅ **Well Documented**: Complete examples and use cases  
✅ **Type Safe**: TypeScript types updated to allow `null`  

The Master Ticket API now provides complete control over optional field management with three distinct behaviors: keep unchanged (omit), clear (null), or update (provide data).

